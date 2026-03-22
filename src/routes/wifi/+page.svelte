<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/toast';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';

  interface WifiNetwork {
    ssid: string;
    bssid: string;
    channel: string;
    signal: number;
    security: string;
    isInsecure: boolean;
  }

  interface CurrentConnection {
    ssid: string;
    bssid: string;
    channel: string;
    signal: number;
    ip: string;
    interface: string;
  }

  let networks = $state<WifiNetwork[]>([]);
  let current = $state<CurrentConnection | null>(null);
  let error = $state('');
  let loading = $state(false);
  let autoRefresh = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let sortKey = $state<keyof WifiNetwork>('signal');
  let sortDir = $state<'asc' | 'desc'>('desc');

  const sorted = $derived.by(() => {
    const arr = [...networks];
    arr.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  });

  function toggleSort(key: keyof WifiNetwork) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'signal' ? 'desc' : 'asc';
    }
  }

  function sortIndicator(key: keyof WifiNetwork): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

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
      const res = await fetch('/api/wifi');
      const data = await res.json();
      if (data.error) {
        error = data.error;
        toast.warning(data.error);
      }
      networks = data.networks || [];
      current = data.current || null;
      if (!data.error) toast.success(`Found ${networks.length} networks`);
    } catch (e: any) {
      error = e.message || 'Scan failed';
      toast.error('WiFi scan failed');
    } finally {
      loading = false;
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(scan, 5000);
      toast.info('Auto-refresh enabled (5s)');
    } else {
      if (refreshInterval) clearInterval(refreshInterval);
      refreshInterval = null;
      toast.info('Auto-refresh disabled');
    }
  }

  onMount(() => {
    scan();
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
</script>

<svelte:head>
  <title>WiFi Scanner | Home Server</title>
</svelte:head>

<div class="header">
  <h2 class="page-title">WiFi Scanner</h2>
  <div class="header-actions">
    <label class="auto-toggle">
      <input type="checkbox" checked={autoRefresh} onchange={toggleAutoRefresh} />
      Auto-refresh
    </label>
    <Button onclick={scan} disabled={loading} {loading}>
      {loading ? 'Scanning...' : 'Scan'}
    </Button>
  </div>
</div>
<p class="page-desc">Scan nearby WiFi networks. View signal strength, channels, and encryption details.</p>

{#if current}
  <div class="card current-info">
    <h3>Current Connection</h3>
    <div class="current-grid">
      <div class="current-item">
        <span class="label">SSID</span>
        <span class="value">{current.ssid}</span>
      </div>
      {#if current.bssid}
        <div class="current-item">
          <span class="label">BSSID</span>
          <code class="value">{current.bssid}</code>
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
          <th class="sortable" onclick={() => toggleSort('ssid')}>SSID{sortIndicator('ssid')}</th>
          <th class="sortable" onclick={() => toggleSort('bssid')}>BSSID{sortIndicator('bssid')}</th>
          <th class="sortable" onclick={() => toggleSort('channel')}>Channel{sortIndicator('channel')}</th>
          <th class="sortable" onclick={() => toggleSort('signal')}>Signal{sortIndicator('signal')}</th>
          <th>Strength</th>
          <th class="sortable" onclick={() => toggleSort('security')}>Security{sortIndicator('security')}</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as net (net.bssid)}
          {@const bars = signalBars(net.signal)}
          <tr class:insecure={net.isInsecure}>
            <td class="ssid-col">
              {net.ssid}
              {#if current && net.ssid === current.ssid && net.bssid === current.bssid}
                <Badge variant="accent">Connected</Badge>
              {/if}
            </td>
            <td><code>{net.bssid}</code></td>
            <td class="center">{net.channel}</td>
            <td class="center">{net.signal} dBm</td>
            <td class="center">
              <div class="signal-bars" title="{signalLabel(net.signal)} ({net.signal} dBm)">
                {#each [1, 2, 3, 4, 5] as level}
                  <div class="bar" class:active={level <= bars} style="height: {level * 4 + 2}px"></div>
                {/each}
              </div>
            </td>
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

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 1.3rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

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
</style>
