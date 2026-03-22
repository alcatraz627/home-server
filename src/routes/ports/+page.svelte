<script lang="ts">
  import { toast } from '$lib/toast';

  interface ScanResult {
    port: number;
    open: boolean;
    service: string;
  }

  let host = $state('127.0.0.1');
  let portInput = $state('');
  let preset = $state<'common' | 'custom'>('common');
  let loading = $state(false);
  let results = $state<ScanResult[]>([]);
  let scanInfo = $state<{ host: string; total: number; open: number } | null>(null);
  let showOnlyOpen = $state(false);

  const displayed = $derived(showOnlyOpen ? results.filter((r) => r.open) : results);

  async function scan() {
    if (!host.trim()) {
      toast.error('Enter a host');
      return;
    }
    loading = true;
    results = [];
    scanInfo = null;

    try {
      const payload: any = { host: host.trim() };
      if (preset === 'common') {
        payload.preset = 'common';
      } else {
        payload.ports = portInput.trim();
      }

      const res = await fetch('/api/ports', {
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
      toast.success(`Scan complete: ${data.open} open port(s) found`);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <h1>Port Scanner</h1>

  <div class="card config-card">
    <div class="form-row">
      <label class="host-label">
        <span>Target Host</span>
        <input type="text" bind:value={host} placeholder="IP or hostname" />
      </label>
      <label class="preset-label">
        <span>Port Selection</span>
        <select bind:value={preset}>
          <option value="common">Common Ports</option>
          <option value="custom">Custom Range</option>
        </select>
      </label>
      {#if preset === 'custom'}
        <label class="ports-label">
          <span>Ports</span>
          <input type="text" bind:value={portInput} placeholder="e.g., 1-1024 or 80,443,8080" />
        </label>
      {/if}
    </div>
    <button class="btn-primary" onclick={scan} disabled={loading}>
      {loading ? 'Scanning...' : 'Scan'}
    </button>
  </div>

  {#if loading}
    <div class="card progress-card">
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <p>Scanning ports on {host}...</p>
    </div>
  {/if}

  {#if scanInfo && !loading}
    <div class="summary">
      <span class="summary-item">Host: <strong>{scanInfo.host}</strong></span>
      <span class="summary-item">Scanned: <strong>{scanInfo.total}</strong></span>
      <span class="summary-item open">Open: <strong>{scanInfo.open}</strong></span>
      <label class="toggle-label">
        <input type="checkbox" bind:checked={showOnlyOpen} />
        Show open only
      </label>
    </div>
  {/if}

  {#if displayed.length > 0}
    <div class="card results-card">
      <table>
        <thead>
          <tr>
            <th>Port</th>
            <th>Status</th>
            <th>Service</th>
          </tr>
        </thead>
        <tbody>
          {#each displayed as r}
            <tr class:open-row={r.open}>
              <td class="port-num">{r.port}</td>
              <td>
                <span class="status-badge" class:open={r.open} class:closed={!r.open}>
                  {r.open ? 'Open' : 'Closed'}
                </span>
              </td>
              <td class="service">{r.service || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
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
  }
  .btn-primary {
    padding: 0.55rem 1.5rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    align-self: flex-start;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .progress-card {
    padding: 1.25rem;
    margin-bottom: 1rem;
    text-align: center;
  }
  .progress-card p {
    color: var(--text-secondary);
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
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
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  .summary-item {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .summary-item strong {
    color: var(--text-primary);
  }
  .summary-item.open strong {
    color: var(--success);
  }
  .toggle-label {
    display: flex;
    flex-direction: row !important;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    margin-left: auto;
  }
  .toggle-label input {
    accent-color: var(--accent);
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
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  .port-num {
    font-family: monospace;
    font-weight: 600;
  }
  .service {
    color: var(--text-muted);
  }
  .status-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-badge.open {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }
  .status-badge.closed {
    background: var(--bg-secondary);
    color: var(--text-muted);
  }
  .open-row {
    background: color-mix(in srgb, var(--success) 3%, transparent);
  }
</style>
