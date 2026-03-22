<script lang="ts">
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';
  import { createHistory } from '$lib/history';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';

  interface ScanResult {
    port: number;
    open: boolean;
    service: string;
  }

  let host = $state('127.0.0.1');
  let portInput = $state('');
  let preset = $state<'common' | 'custom' | 'all'>('common');
  let loading = $state(false);
  let results = $state<ScanResult[]>([]);
  let scanInfo = $state<{ host: string; total: number; open: number } | null>(null);
  let showOnlyOpen = $state(false);
  let search = $state('');
  let sortKey = $state<'port' | 'service' | 'open'>('port');
  let sortDir = $state<'asc' | 'desc'>('asc');

  // Streaming state
  let streamProgress = $state<{ scanned: number; total: number; open: number } | null>(null);

  const scanHistory = createHistory<{ host: string; preset: string; open: number; total: number; time: string }>(
    'hs:port-scan-history',
  );

  const displayed = $derived.by(() => {
    let arr = [...results];

    // Filter open
    if (showOnlyOpen) arr = arr.filter((r) => r.open);

    // Search
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (r) =>
          String(r.port).includes(q) || r.service.toLowerCase().includes(q) || (r.open ? 'open' : 'closed').includes(q),
      );
    }

    // Sort
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'port') {
        av = a.port;
        bv = b.port;
      } else if (sortKey === 'service') {
        av = a.service.toLowerCase();
        bv = b.service.toLowerCase();
      } else {
        av = a.open ? 1 : 0;
        bv = b.open ? 1 : 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'port' ? 'asc' : 'desc';
    }
  }

  function sortIcon(key: typeof sortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  async function scan() {
    if (!host.trim()) {
      toast.error('Enter a host');
      return;
    }
    loading = true;
    results = [];
    scanInfo = null;
    streamProgress = null;

    if (preset === 'all') {
      await scanStreaming();
      return;
    }

    try {
      const payload: any = { host: host.trim() };
      if (preset === 'common') {
        payload.preset = 'common';
      } else {
        payload.ports = portInput.trim();
      }

      const res = await fetchApi('/api/ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data = await res.json();
      results = data.results;
      scanInfo = { host: data.host, total: data.total, open: data.open };
      scanHistory.add({
        host: host.trim(),
        preset,
        open: data.open,
        total: data.total,
        time: new Date().toISOString(),
      });
      toast.success(`Scan complete: ${data.open} open port(s) found`);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      loading = false;
    }
  }

  async function scanStreaming() {
    try {
      const res = await fetchApi('/api/ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: host.trim(), preset: 'all' }),
      });

      if (!res.ok) throw new Error('Streaming scan failed');
      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data._progress) {
              streamProgress = { scanned: data.scanned, total: data.total, open: data.open };
            } else if (data._done) {
              scanInfo = { host: host.trim(), total: data.total, open: data.open };
              scanHistory.add({
                host: host.trim(),
                preset: 'all',
                open: data.open,
                total: data.total,
                time: new Date().toISOString(),
              });
              toast.success(`Full scan complete: ${data.open} open port(s)`);
            } else if (data.port) {
              results = [...results, data];
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Streaming scan failed');
    } finally {
      loading = false;
      streamProgress = null;
    }
  }
</script>

<svelte:head>
  <title>Port Scanner | Home Server</title>
</svelte:head>

<div class="page">
  <h2 class="page-title">Port Scanner</h2>
  <p class="page-desc">Scan open ports on any host. Choose common ports, a custom range, or scan all 65535 ports.</p>

  <div class="card config-card">
    <div class="form-row">
      <label class="host-label">
        <span>Target Host</span>
        <input
          type="text"
          bind:value={host}
          placeholder="IP or hostname"
          onkeydown={(e) => e.key === 'Enter' && scan()}
        />
      </label>
      <label class="preset-label">
        <span>Port Selection</span>
        <select bind:value={preset}>
          <option value="common">Common Ports</option>
          <option value="custom">Custom Range</option>
          <option value="all">All (1-65535)</option>
        </select>
      </label>
      {#if preset === 'custom'}
        <label class="ports-label">
          <span>Ports</span>
          <input type="text" bind:value={portInput} placeholder="e.g., 1-1024 or 80,443,8080" />
        </label>
      {/if}
    </div>
    {#if preset === 'all'}
      <p class="all-warning">
        <Icon name="alert-triangle" size={14} /> Full scan takes several minutes. Open ports stream back as discovered.
      </p>
    {/if}
    <Button variant="primary" onclick={scan} disabled={loading} {loading}>
      {loading ? 'Scanning...' : 'Scan'}
    </Button>
  </div>

  {#if loading && streamProgress}
    <div class="card progress-card">
      <div class="progress-bar">
        <div class="progress-fill-real" style="width: {(streamProgress.scanned / streamProgress.total) * 100}%"></div>
      </div>
      <p>
        Scanned {streamProgress.scanned.toLocaleString()} / {streamProgress.total.toLocaleString()} ports — {streamProgress.open}
        open found
      </p>
    </div>
  {:else if loading}
    <div class="card progress-card">
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <p>Scanning ports on {host}...</p>
    </div>
  {/if}

  {#if (scanInfo && !loading) || (loading && results.length > 0)}
    <div class="summary">
      <span class="summary-item">Host: <strong>{scanInfo?.host || host}</strong></span>
      <span class="summary-item">Scanned: <strong>{scanInfo?.total || streamProgress?.scanned || '...'}</strong></span>
      <span class="summary-item open"
        >Open: <strong>{scanInfo?.open || results.filter((r) => r.open).length}</strong></span
      >
    </div>

    <div class="filter-bar">
      <SearchInput bind:value={search} placeholder="Search ports or services..." size="sm" />
      <label class="toggle-label">
        <input type="checkbox" bind:checked={showOnlyOpen} />
        Open only
      </label>
    </div>
  {/if}

  {#if displayed.length > 0}
    <div class="card results-card">
      <table>
        <thead>
          <tr>
            <th class="sortable" onclick={() => toggleSort('port')}>Port{sortIcon('port')}</th>
            <th class="sortable" onclick={() => toggleSort('open')}>Status{sortIcon('open')}</th>
            <th class="sortable" onclick={() => toggleSort('service')}>Service{sortIcon('service')}</th>
          </tr>
        </thead>
        <tbody>
          {#each displayed as r (r.port)}
            <tr class:open-row={r.open}>
              <td class="port-num">{r.port}</td>
              <td>
                <Badge variant={r.open ? 'success' : 'default'}>
                  {r.open ? 'Open' : 'Closed'}
                </Badge>
              </td>
              <td class="service">{r.service || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="result-count">{displayed.length} result{displayed.length !== 1 ? 's' : ''} shown</p>
  {/if}

  {#if scanHistory.items.length > 0}
    <div class="history-section">
      <div class="history-header">
        <span class="history-label">Scan History</span>
        <button class="history-clear" onclick={() => scanHistory.clear()}>Clear</button>
      </div>
      {#each scanHistory.items as h}
        <button
          class="history-item"
          onclick={() => {
            host = h.host;
            scan();
          }}
        >
          <code>{h.host}</code>
          <Badge size="sm">{h.preset}</Badge>
          <span class="history-meta">{h.open}/{h.total} open</span>
          <span class="history-time">{new Date(h.time).toLocaleDateString()}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .config-card {
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .host-label {
    flex: 2;
  }

  .preset-label {
    flex: 1;
  }

  .ports-label {
    flex: 2;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  label span {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  input[type='text'],
  select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    font-family: inherit;
  }

  .all-warning {
    font-size: 0.78rem;
    color: var(--warning);
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }

  .progress-card {
    padding: 1.25rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .progress-card p {
    color: var(--text-secondary);
    margin: 0.75rem 0 0;
    font-size: 0.82rem;
  }

  .progress-bar {
    height: 6px;
    background: var(--bg-primary);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    width: 40%;
    background: var(--accent);
    border-radius: 3px;
    animation: indeterminate 1.5s ease-in-out infinite;
  }

  .progress-fill-real {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s;
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
      width: 40%;
    }
    50% {
      transform: translateX(100%);
      width: 60%;
    }
    100% {
      transform: translateX(300%);
      width: 40%;
    }
  }

  .summary {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.75rem 0;
    flex-wrap: wrap;
  }

  .summary-item {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .summary-item strong {
    color: var(--text-primary);
  }

  .summary-item.open strong {
    color: var(--success);
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .toggle-label {
    display: flex;
    flex-direction: row !important;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
  }

  .results-card {
    padding: 0;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    padding: 0.6rem 1rem;
    background: var(--table-header-bg);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--border);
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    color: var(--accent);
  }

  td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.82rem;
    color: var(--text-primary);
  }

  .port-num {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }

  .service {
    color: var(--text-muted);
  }

  .open-row {
    background: color-mix(in srgb, var(--success) 5%, transparent);
  }

  .result-count {
    font-size: 0.72rem;
    color: var(--text-faint);
    text-align: center;
    padding: 8px 0;
  }

  .history-section {
    margin-top: 20px;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .history-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
  }

  .history-clear {
    font-size: 0.65rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-faint);
    padding: 2px 8px;
    cursor: pointer;
    font-family: inherit;
  }

  .history-clear:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    margin-bottom: 4px;
    text-align: left;
  }

  .history-item:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .history-item code {
    font-size: 0.75rem;
  }

  .history-meta {
    font-size: 0.68rem;
    color: var(--text-faint);
  }

  .history-time {
    font-size: 0.65rem;
    color: var(--text-faint);
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
