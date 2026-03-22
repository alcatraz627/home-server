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

  interface USBDevice {
    name: string;
    vendor: string;
    serial: string;
    speed: string;
  }

  interface AudioDevice {
    name: string;
    type: 'input' | 'output';
    sampleRate: string;
  }

  interface BatteryInfo {
    percentage: number;
    charging: boolean;
    timeRemaining: string;
    cycleCount: number | null;
  }

  let wifi = $state<WifiNetwork[]>([]);
  let bluetooth = $state<BluetoothDevice[]>([]);
  let currentWifi = $state<{ ssid: string; rssi: number } | null>(null);
  let usb = $state<USBDevice[]>([]);
  let audio = $state<AudioDevice[]>([]);
  let battery = $state<BatteryInfo | null>(null);
  let loading = $state(true);
  let activeTab = $state<'wifi' | 'bluetooth' | 'usb' | 'audio' | 'battery'>('wifi');
  let wifiSort = $state<'rssi' | 'ssid' | 'channel'>('rssi');

  async function refresh() {
    loading = true;
    try {
      const res = await fetch('/api/peripherals');
      const data = await res.json();
      wifi = data.wifi;
      bluetooth = data.bluetooth;
      currentWifi = data.currentWifi;
      usb = data.usb || [];
      audio = data.audio || [];
      battery = data.battery || null;
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
  <button class="tab" class:active={activeTab === 'usb'} onclick={() => (activeTab = 'usb')}>
    USB ({usb.length})
  </button>
  <button class="tab" class:active={activeTab === 'audio'} onclick={() => (activeTab = 'audio')}>
    Audio ({audio.length})
  </button>
  <button class="tab" class:active={activeTab === 'battery'} onclick={() => (activeTab = 'battery')}>
    Battery {battery ? `(${battery.percentage}%)` : ''}
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
{:else if activeTab === 'bluetooth'}
  {#if loading}
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
{:else if activeTab === 'usb'}
  {#if loading}
    <div class="loading">Scanning USB devices...</div>
  {:else if usb.length === 0}
    <div class="empty">No USB devices found</div>
  {:else}
    <div class="device-list">
      {#each usb as dev, i}
        <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
          <div class="device-icon">&#x1F50C;</div>
          <div class="device-info">
            <span class="device-name">{dev.name}</span>
            <span class="device-meta">
              {#if dev.vendor}Vendor: {dev.vendor}{/if}
              {#if dev.serial}
                | Serial: {dev.serial}{/if}
            </span>
          </div>
          {#if dev.speed}
            <span class="device-badge">{dev.speed}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'audio'}
  {#if loading}
    <div class="loading">Scanning audio devices...</div>
  {:else if audio.length === 0}
    <div class="empty">No audio devices found</div>
  {:else}
    <div class="device-list">
      {#each audio as dev, i}
        <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
          <div class="device-icon">{dev.type === 'input' ? '&#x1F3A4;' : '&#x1F50A;'}</div>
          <div class="device-info">
            <span class="device-name">{dev.name}</span>
            <span class="device-meta">
              {dev.type === 'input' ? 'Input' : 'Output'}
              {#if dev.sampleRate}
                | {dev.sampleRate}{/if}
            </span>
          </div>
          <span class="device-badge" class:input-badge={dev.type === 'input'}>
            {dev.type === 'input' ? 'IN' : 'OUT'}
          </span>
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'battery'}
  {#if loading}
    <div class="loading">Checking battery...</div>
  {:else if !battery}
    <div class="empty">No battery detected (desktop Mac or unavailable)</div>
  {:else}
    <div class="battery-card card">
      <div class="battery-header">
        <div class="battery-visual">
          <div class="battery-shell">
            <div
              class="battery-fill"
              style="width: {battery.percentage}%; background: {battery.percentage > 20
                ? 'var(--success)'
                : 'var(--danger)'}"
            ></div>
          </div>
          <div class="battery-nub"></div>
        </div>
        <span class="battery-pct">{battery.percentage}%</span>
        <span class="battery-status" class:charging={battery.charging}>
          {battery.charging ? 'Charging' : 'On Battery'}
        </span>
      </div>
      <div class="battery-details">
        <div class="battery-detail">
          <span class="battery-label">Time Remaining</span>
          <span class="battery-value">{battery.timeRemaining}</span>
        </div>
        {#if battery.cycleCount !== null}
          <div class="battery-detail">
            <span class="battery-label">Cycle Count</span>
            <span class="battery-value">{battery.cycleCount}</span>
          </div>
        {/if}
        <div class="battery-detail">
          <span class="battery-label">Power Source</span>
          <span class="battery-value">{battery.charging ? 'AC Power' : 'Battery'}</span>
        </div>
      </div>
    </div>
  {/if}
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

  /* USB / Audio device list */
  .device-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .device-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }
  .device-icon {
    font-size: 1.2rem;
    width: 28px;
    text-align: center;
  }
  .device-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .device-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  .device-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }
  .device-badge {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--accent-bg);
    color: var(--accent);
    white-space: nowrap;
  }
  .device-badge.input-badge {
    background: var(--warning-bg, rgba(255, 180, 0, 0.1));
    color: var(--warning);
  }

  /* Battery */
  .battery-card {
    padding: 20px;
    max-width: 400px;
  }
  .battery-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }
  .battery-visual {
    display: flex;
    align-items: center;
  }
  .battery-shell {
    width: 60px;
    height: 26px;
    border: 2px solid var(--text-muted);
    border-radius: 4px;
    padding: 2px;
    position: relative;
  }
  .battery-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }
  .battery-nub {
    width: 4px;
    height: 12px;
    background: var(--text-muted);
    border-radius: 0 2px 2px 0;
    margin-left: 1px;
  }
  .battery-pct {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  .battery-status {
    font-size: 0.78rem;
    padding: 2px 10px;
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--text-muted);
  }
  .battery-status.charging {
    background: var(--success-bg, rgba(0, 200, 100, 0.1));
    color: var(--success);
  }
  .battery-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .battery-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .battery-label {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .battery-value {
    font-size: 0.85rem;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  @media (max-width: 640px) {
    .network-row {
      flex-wrap: wrap;
    }
    .net-security {
      margin-left: auto;
    }
    .device-row {
      flex-wrap: wrap;
    }
  }
</style>
