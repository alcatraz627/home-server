<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from '$lib/toast';

  interface WifiNetwork {
    ssid: string;
    bssid: string;
    rssi: number;
    channel: number;
    security: string;
  }

  interface BluetoothDevice {
    name: string;
    address: string;
    connected: boolean;
    type: string;
  }

  let wifi = $state<WifiNetwork[]>([]);
  let bluetooth = $state<BluetoothDevice[]>([]);
  let currentWifi = $state<{ ssid: string; rssi: number } | null>(null);
  let loading = $state(true);
  let activeTab = $state<'wifi' | 'bluetooth'>('wifi');
  let wifiSort = $state<'rssi' | 'ssid' | 'channel'>('rssi');

  async function refresh() {
    loading = true;
    try {
      const res = await fetch('/api/peripherals');
      const data = await res.json();
      wifi = data.wifi;
      bluetooth = data.bluetooth;
      currentWifi = data.currentWifi;
    } catch (e: any) {
      toast.error(e.message || 'Failed to load peripherals');
    } finally {
      loading = false;
    }
  }

  onMount(refresh);

  let sortedWifi = $derived.by(() => {
    const sorted = [...wifi];
    if (wifiSort === 'rssi') sorted.sort((a, b) => b.rssi - a.rssi);
    else if (wifiSort === 'ssid') sorted.sort((a, b) => a.ssid.localeCompare(b.ssid));
    else sorted.sort((a, b) => a.channel - b.channel);
    return sorted;
  });

  function signalBars(rssi: number): number {
    if (rssi >= -50) return 5;
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    return 1;
  }

  function signalColor(rssi: number): string {
    if (rssi >= -50) return 'var(--success)';
    if (rssi >= -70) return 'var(--warning)';
    return 'var(--danger)';
  }

  function isOpenNetwork(security: string): boolean {
    return !security || security === 'Open' || security === 'NONE';
  }
</script>

<svelte:head>
  <title>Peripherals | Home Server</title>
</svelte:head>

<div class="header">
  <h2>Peripherals</h2>
  <button class="btn" onclick={refresh} disabled={loading}>
    {loading ? 'Scanning...' : 'Refresh'}
  </button>
</div>

<!-- Tabs -->
<div class="tabs">
  <button class="tab" class:active={activeTab === 'wifi'} onclick={() => (activeTab = 'wifi')}>
    WiFi ({wifi.length})
  </button>
  <button class="tab" class:active={activeTab === 'bluetooth'} onclick={() => (activeTab = 'bluetooth')}>
    Bluetooth ({bluetooth.length})
  </button>
</div>

{#if activeTab === 'wifi'}
  <!-- Current connection -->
  {#if currentWifi}
    <div class="current-connection card">
      <span class="current-label">Connected to</span>
      <span class="current-ssid">{currentWifi.ssid}</span>
      <span class="current-signal" style="color: {signalColor(currentWifi.rssi)}">
        {currentWifi.rssi} dBm
      </span>
    </div>
  {/if}

  <!-- Sort -->
  <div class="sort-row">
    <span class="sort-label">Sort:</span>
    <button class="sort-btn" class:active={wifiSort === 'rssi'} onclick={() => (wifiSort = 'rssi')}>Signal</button>
    <button class="sort-btn" class:active={wifiSort === 'ssid'} onclick={() => (wifiSort = 'ssid')}>Name</button>
    <button class="sort-btn" class:active={wifiSort === 'channel'} onclick={() => (wifiSort = 'channel')}
      >Channel</button
    >
  </div>

  {#if loading}
    <div class="loading">Scanning networks...</div>
  {:else if sortedWifi.length === 0}
    <div class="empty">No WiFi networks found</div>
  {:else}
    <div class="network-list">
      {#each sortedWifi as net, i}
        <div
          class="network-row card-stagger"
          style="animation-delay: {i * 30}ms"
          class:open-network={isOpenNetwork(net.security)}
        >
          <div class="net-signal">
            <div class="signal-bars">
              {#each [1, 2, 3, 4, 5] as bar}
                <span
                  class="bar"
                  class:active={bar <= signalBars(net.rssi)}
                  style="background: {bar <= signalBars(net.rssi) ? signalColor(net.rssi) : 'var(--border)'}"
                ></span>
              {/each}
            </div>
          </div>
          <div class="net-info">
            <span class="net-ssid">{net.ssid}</span>
            <span class="net-meta">{net.bssid} | Ch {net.channel} | {net.rssi} dBm</span>
          </div>
          <div class="net-security" class:insecure={isOpenNetwork(net.security)}>
            {isOpenNetwork(net.security) ? 'Open' : net.security}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{:else if loading}
  <div class="loading">Scanning devices...</div>
{:else if bluetooth.length === 0}
  <div class="empty">No Bluetooth devices found</div>
{:else}
  <div class="bt-list">
    {#each bluetooth as dev, i}
      <div class="bt-row card-stagger" style="animation-delay: {i * 30}ms">
        <span class="bt-status">
          <span class="dot" class:connected={dev.connected}></span>
        </span>
        <div class="bt-info">
          <span class="bt-name">{dev.name}</span>
          <span class="bt-meta">{dev.address} | {dev.type}</span>
        </div>
        <span class="bt-state">{dev.connected ? 'Connected' : 'Paired'}</span>
      </div>
    {/each}
  </div>
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
  .btn {
    padding: 6px 14px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn:disabled {
    opacity: 0.5;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }
  .tab {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.82rem;
    font-family: inherit;
    transition: all 0.15s;
  }
  .tab:hover {
    color: var(--text-primary);
  }
  .tab.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .current-connection {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 12px;
  }
  .current-label {
    font-size: 0.72rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .current-ssid {
    font-weight: 600;
    color: var(--text-primary);
  }
  .current-signal {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
  }

  .sort-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }
  .sort-label {
    font-size: 0.72rem;
    color: var(--text-faint);
  }
  .sort-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.72rem;
  }
  .sort-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  .loading,
  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
    font-size: 0.85rem;
  }

  .network-list,
  .bt-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .network-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }
  .network-row.open-network {
    border-left: 3px solid var(--danger);
  }

  .signal-bars {
    display: flex;
    gap: 2px;
    align-items: flex-end;
    height: 16px;
  }
  .bar {
    width: 4px;
    border-radius: 1px;
    transition: background 0.2s;
  }
  .bar:nth-child(1) {
    height: 4px;
  }
  .bar:nth-child(2) {
    height: 7px;
  }
  .bar:nth-child(3) {
    height: 10px;
  }
  .bar:nth-child(4) {
    height: 13px;
  }
  .bar:nth-child(5) {
    height: 16px;
  }

  .net-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .net-ssid {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  .net-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }
  .net-security {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--success-bg);
    color: var(--success);
  }
  .net-security.insecure {
    background: var(--danger-bg);
    color: var(--danger);
  }

  .bt-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }
  .dot.connected {
    background: var(--success);
  }
  .bt-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bt-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  .bt-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }
  .bt-state {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  @media (max-width: 640px) {
    .network-row {
      flex-wrap: wrap;
    }
    .net-security {
      margin-left: auto;
    }
  }
</style>
