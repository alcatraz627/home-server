<script lang="ts">
  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';
  import { getErrorMessage } from '$lib/errors';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { createTableSort } from '$lib/sort.svelte';
  import type { WifiNetwork, CurrentConnection } from '$lib/types/wifi';
  import { SK_WIFI_PRIVACY } from '$lib/constants/storage-keys';

  let showExtended = $state(false);
  let privacyMode = $state(
    typeof localStorage !== 'undefined' ? localStorage.getItem(SK_WIFI_PRIVACY) === 'true' : false,
  );

  function togglePrivacy() {
    privacyMode = !privacyMode;
    localStorage.setItem(SK_WIFI_PRIVACY, String(privacyMode));
  }

  let networks = $state<WifiNetwork[]>([]);
  let current = $state<CurrentConnection | null>(null);
  let error = $state('');
  let loading = $state(false);
  const sort = createTableSort<keyof WifiNetwork>('signal', 'desc');

  const sorted = $derived.by(() => {
    const arr = [...networks];
    const sk = sort.key;
    const sd = sort.dir;
    arr.sort((a, b) => {
      let av: any = a[sk];
      let bv: any = b[sk];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sd === 'asc' ? -1 : 1;
      if (av > bv) return sd === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  });

  function signalBars(dBm: number): number {
    if (dBm >= -30) return 5;
    if (dBm >= -50) return 4;
    if (dBm >= -60) return 3;
    if (dBm >= -70) return 2;
    if (dBm >= -80) return 1;
    return 0;
  }

  function signalLabel(dBm: number): string {
    if (dBm >= -30) return 'Excellent';
    if (dBm >= -50) return 'Great';
    if (dBm >= -60) return 'Good';
    if (dBm >= -70) return 'Fair';
    if (dBm >= -80) return 'Weak';
    return 'Very Weak';
  }

  async function scan() {
    loading = true;
    error = '';
    try {
      const res = await fetchApi('/api/wifi');
      const data = await res.json();
      if (data.error) {
        error = data.error;
        toast.warning(data.error);
      }
      networks = data.networks || [];
      current = data.current || null;
      if (!data.error) toast.success(`Found ${networks.length} networks`);
    } catch (e: unknown) {
      error = getErrorMessage(e, 'Scan failed');
      toast.error('WiFi scan failed');
    } finally {
      loading = false;
    }
  }

  const autoRefresh = createAutoRefresh(scan, 5000);
  // Start disabled — user opts in
  autoRefresh.enabled = false;

  function toggleAutoRefresh() {
    autoRefresh.toggle();
    if (autoRefresh.enabled) {
      toast.info('Auto-refresh enabled (5s)');
    } else {
      toast.info('Auto-refresh disabled');
    }
  }

  // Inline diagnostics
  interface DiagResult {
    test: string;
    status: 'pass' | 'fail' | 'warn';
    output: string;
    latency?: number;
  }

  let diagResults = $state<DiagResult[]>([]);
  let diagRunning = $state(false);
  let diagGateway = $state('');

  async function runDiagnostics() {
    diagRunning = true;
    diagResults = [];
    try {
      const res = await fetchApi('/api/wifi/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'all' }),
      });
      const data = await res.json();
      diagResults = data.results;
      diagGateway = data.gateway || '';
    } catch {
      toast.error('Diagnostics failed');
    }
    diagRunning = false;
  }

  onMount(() => {
    scan();
    return useShortcuts([{ ...SHORTCUT_DEFAULTS.find((d) => d.id === 'wifi:refresh')!, handler: () => scan() }]);
  });
</script>

<svelte:head>
  <title>WiFi Scanner | Home Server</title>
</svelte:head>

<PageHeader
  title="WiFi Scanner"
  description="Scan nearby WiFi networks. View signal strength, channels, and encryption details."
>
  <label class="auto-toggle">
    <input type="checkbox" bind:checked={showExtended} />
    Extended
  </label>
  <label class="auto-toggle" title="Blur SSIDs and BSSIDs for privacy">
    <input type="checkbox" checked={privacyMode} onchange={togglePrivacy} />
    Privacy
  </label>
  <label class="auto-toggle">
    <input type="checkbox" checked={autoRefresh.enabled} onchange={toggleAutoRefresh} />
    Auto-refresh
  </label>
  <Button icon="refresh" onclick={scan} disabled={loading} {loading}>
    {loading ? 'Scanning...' : 'Scan'}
  </Button>
</PageHeader>

{#if current}
  <div class="card current-info">
    <h3>Current Connection</h3>
    <div class="current-grid">
      <div class="current-item">
        <span class="label">SSID</span>
        <span class="value" class:redacted={privacyMode}>{current.ssid}</span>
      </div>
      {#if current.bssid}
        <div class="current-item">
          <span class="label">BSSID</span>
          <code class="value" class:redacted={privacyMode}>{current.bssid}</code>
        </div>
      {/if}
      {#if current.channel}
        <div class="current-item">
          <span class="label">Channel</span>
          <span class="value">{current.channel}</span>
        </div>
      {/if}
      <div class="current-item">
        <span class="label">Signal</span>
        <span class="value">{current.signal} dBm</span>
      </div>
      {#if current.ip}
        <div class="current-item">
          <span class="label">IP Address</span>
          <code class="value">{current.ip}</code>
        </div>
      {/if}
      <div class="current-item">
        <span class="label">Interface</span>
        <span class="value">{current.interface}</span>
      </div>
    </div>
  </div>
{/if}

{#if error}
  <p class="error-msg">{error}</p>
{/if}

{#if networks.length === 0 && !loading && !error}
  <p class="empty">No WiFi networks detected.</p>
{:else if networks.length > 0}
  <div class="table-wrapper">
    <table class="wifi-table">
      <thead>
        <tr>
          <th class="sortable" onclick={() => sort.toggle('ssid')}>SSID{sort.indicator('ssid')}</th>
          <th class="sortable" onclick={() => sort.toggle('bssid')}>BSSID{sort.indicator('bssid')}</th>
          <th class="sortable" onclick={() => sort.toggle('channel')}>Channel{sort.indicator('channel')}</th>
          <th class="sortable" onclick={() => sort.toggle('signal', 'desc')}>Signal{sort.indicator('signal')}</th>
          <th>Strength</th>
          {#if showExtended}
            <th>SNR</th>
            <th>Noise</th>
            <th>Band</th>
            <th>Width</th>
            <th>PHY</th>
            <th>Vendor</th>
          {/if}
          <th class="sortable" onclick={() => sort.toggle('security')}>Security{sort.indicator('security')}</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as net (net.bssid)}
          {@const bars = signalBars(net.signal)}
          <tr class:insecure={net.isInsecure}>
            <td class="ssid-col">
              <span class:redacted={privacyMode}>{net.ssid}</span>
              {#if current && net.ssid === current.ssid && net.bssid === current.bssid}
                <Badge variant="accent">Connected</Badge>
              {/if}
            </td>
            <td><code class:redacted={privacyMode}>{net.bssid}</code></td>
            <td class="center">{net.channel}</td>
            <td class="center">{net.signal} dBm</td>
            <td class="center">
              <div class="signal-bars" title="{signalLabel(net.signal)} ({net.signal} dBm)">
                {#each [1, 2, 3, 4, 5] as level}
                  <div class="bar" class:active={level <= bars} style="height: {level * 4 + 2}px"></div>
                {/each}
              </div>
            </td>
            {#if showExtended}
              <td class="center">{net.snr != null ? `${net.snr} dB` : '—'}</td>
              <td class="center">{net.noise != null ? `${net.noise} dBm` : '—'}</td>
              <td class="center">{net.channelBand || '—'}</td>
              <td class="center">{net.channelWidth || '—'}</td>
              <td class="center">{net.phyMode || '—'}</td>
              <td>{net.vendor || '—'}</td>
            {/if}
            <td>
              <Badge variant={net.isInsecure ? 'danger' : 'default'}>
                {net.security}
              </Badge>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="count">{networks.length} network{networks.length !== 1 ? 's' : ''} found</p>
{/if}

<!-- Network Diagnostics -->
{#if current}
  <div class="diag-section">
    <div class="diag-header">
      <h3>Network Diagnostics</h3>
      <Button size="sm" onclick={runDiagnostics} disabled={diagRunning} loading={diagRunning}>
        {diagRunning ? 'Running...' : 'Run All'}
      </Button>
    </div>
    {#if diagGateway}
      <p class="diag-gateway">Gateway: <code>{diagGateway}</code></p>
    {/if}
    {#if diagResults.length > 0}
      <div class="diag-results">
        {#each diagResults as result}
          <div class="diag-result" class:pass={result.status === 'pass'} class:fail={result.status === 'fail'}>
            <div class="diag-result-header">
              <Icon name={result.status === 'pass' ? 'check' : 'close'} size={14} />
              <span class="diag-test-name">{result.test}</span>
              {#if result.latency != null}
                <span class="diag-latency">{result.latency}ms</span>
              {/if}
            </div>
            <pre class="diag-output">{result.output}</pre>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .auto-toggle input {
    cursor: pointer;
  }

  .current-info {
    margin-bottom: 16px;
    padding: 16px;
  }

  .current-info h3 {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 10px;
  }

  .current-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
  }

  .current-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .current-item .label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .current-item .value {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .error-msg {
    color: var(--danger);
    font-size: 0.85rem;
    margin-bottom: 12px;
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  .table-wrapper {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: auto;
  }

  .wifi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .wifi-table thead {
    background: var(--bg-secondary);
  }

  .wifi-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    white-space: nowrap;
    user-select: none;
  }

  .wifi-table th.sortable {
    cursor: pointer;
  }

  .wifi-table th.sortable:hover {
    color: var(--accent);
  }

  .wifi-table td {
    padding: 8px 14px;
    border-top: 1px solid var(--border-subtle, var(--border));
  }

  .wifi-table tr:hover {
    background: var(--bg-secondary);
  }

  .wifi-table tr.insecure {
    background: color-mix(in srgb, var(--danger) 6%, transparent);
  }

  .wifi-table tr.insecure:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
  }

  .center {
    text-align: center;
  }

  .ssid-col {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .redacted {
    filter: blur(5px);
    transition: filter 0.15s ease;
    cursor: default;
    user-select: none;
  }

  .redacted:hover {
    filter: blur(0);
  }

  code {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .signal-bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 22px;
  }

  .bar {
    width: 4px;
    border-radius: 1px;
    background: var(--border);
    transition: background 0.2s;
  }

  .bar.active {
    background: var(--success);
  }

  .count {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 8px;
    text-align: right;
  }

  @media (max-width: 768px) {
    .wifi-table th:nth-child(2),
    .wifi-table td:nth-child(2) {
      display: none;
    }
  }
  /* Diagnostics */
  .diag-section {
    margin-top: 24px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    background: var(--bg-secondary);
  }

  .diag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .diag-header h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .diag-gateway {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .diag-gateway code {
    font-size: 0.72rem;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .diag-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .diag-result {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    background: var(--bg-primary);
  }

  .diag-result.pass {
    border-left: 3px solid var(--success);
  }

  .diag-result.fail {
    border-left: 3px solid var(--danger);
  }

  .diag-result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .diag-result.pass .diag-result-header {
    color: var(--success);
  }

  .diag-result.fail .diag-result-header {
    color: var(--danger);
  }

  .diag-test-name {
    font-weight: 600;
    font-size: 0.8rem;
  }

  .diag-latency {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-faint);
    margin-left: auto;
  }

  .diag-output {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow-y: auto;
  }
</style>
