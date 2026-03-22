<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { toast } from '$lib/toast';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import Loading from '$lib/components/Loading.svelte';

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

  interface DisplayInfo {
    name: string;
    resolution: string;
    refreshRate: string;
    gpu: string;
    builtIn: boolean;
  }

  interface NetworkInterface {
    port: string;
    device: string;
    mac: string;
    ip: string;
    status: string;
  }

  interface SystemInfo {
    cpuBrand: string;
    cpuCores: number;
    cpuThreads: number;
    ram: string;
    macosVersion: string;
    serial: string;
    model: string;
  }

  type TabKey = 'wifi' | 'bluetooth' | 'usb' | 'audio' | 'battery' | 'displays' | 'network' | 'system';

  const CACHE_KEY = 'hs:peripherals-cache';

  function loadCache(): any | null {
    if (!browser) return null;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function saveCache(data: any) {
    if (!browser) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  }

  const cached = loadCache();

  let wifi = $state<WifiNetwork[]>(cached?.wifi || []);
  let bluetooth = $state<BluetoothDevice[]>(cached?.bluetooth || []);
  let currentWifi = $state<{ ssid: string; rssi: number } | null>(cached?.currentWifi || null);
  let usb = $state<USBDevice[]>(cached?.usb || []);
  let audio = $state<AudioDevice[]>(cached?.audio || []);
  let battery = $state<BatteryInfo | null>(cached?.battery || null);
  let displays = $state<DisplayInfo[]>(cached?.displays || []);
  let networkInterfaces = $state<NetworkInterface[]>(cached?.networkInterfaces || []);
  let systemInfo = $state<SystemInfo | null>(cached?.systemInfo || null);
  let loading = $state(!cached);
  let activeTab = $state<TabKey>('wifi');

  const tabItems = $derived([
    { id: 'wifi', label: 'WiFi', count: wifi.length },
    { id: 'bluetooth', label: 'Bluetooth', count: bluetooth.length },
    { id: 'usb', label: 'USB', count: usb.length },
    { id: 'audio', label: 'Audio', count: audio.length },
    { id: 'battery', label: battery ? `Battery (${battery.percentage}%)` : 'Battery' },
    { id: 'displays', label: 'Displays', count: displays.length },
    { id: 'network', label: 'Network', count: networkInterfaces.length },
    { id: 'system', label: 'System Info' },
  ]);
  let wifiSort = $state<'rssi' | 'ssid' | 'channel'>('rssi');
  let btToggling = $state<string | null>(null);

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
      displays = data.displays || [];
      networkInterfaces = data.networkInterfaces || [];
      systemInfo = data.systemInfo || null;
      saveCache(data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load peripherals');
    } finally {
      loading = false;
    }
  }

  async function toggleBtConnection(dev: BluetoothDevice) {
    btToggling = dev.address;
    const action = dev.connected ? 'bt-disconnect' : 'bt-connect';
    try {
      const res = await fetch('/api/peripherals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, address: dev.address }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(result.error || `Failed to ${dev.connected ? 'disconnect' : 'connect'}`);
      } else {
        toast.success(`${dev.connected ? 'Disconnected from' : 'Connected to'} ${dev.name}`);
        await refresh();
      }
    } catch (e: any) {
      toast.error(e.message || 'Bluetooth action failed');
    } finally {
      btToggling = null;
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
  <h2 class="page-title">Peripherals</h2>
  <Button onclick={refresh} disabled={loading} {loading}>
    {loading ? 'Scanning...' : 'Refresh'}
  </Button>
</div>
<p class="page-desc">
  Scan and inspect connected peripherals including WiFi adapters, Bluetooth devices, and USB hardware.
</p>

<Tabs tabs={tabItems} bind:active={activeTab} />

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

  {#if loading && wifi.length === 0}
    <Loading count={4} height="52px" />
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
          <Badge variant={isOpenNetwork(net.security) ? 'danger' : 'success'}>
            {isOpenNetwork(net.security) ? 'Open' : net.security}
          </Badge>
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'bluetooth'}
  {#if loading && bluetooth.length === 0}
    <Loading count={3} height="52px" />
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
          <Badge variant={dev.connected ? 'success' : 'default'}>{dev.connected ? 'Connected' : 'Paired'}</Badge>
          <Button
            variant={dev.connected ? 'danger' : 'accent'}
            size="sm"
            onclick={() => toggleBtConnection(dev)}
            disabled={btToggling === dev.address}
            loading={btToggling === dev.address}
          >
            {dev.connected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'usb'}
  {#if loading && usb.length === 0}
    <Loading count={3} height="52px" />
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
  {#if loading && audio.length === 0}
    <Loading count={3} height="52px" />
  {:else if audio.length === 0}
    <div class="empty">No audio devices found</div>
  {:else}
    <div class="device-list">
      {#each audio as dev, i}
        <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
          <div class="device-icon">{dev.type === 'input' ? '🎤' : '🔊'}</div>
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
  {#if loading && !battery}
    <Loading count={1} height="140px" />
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
{:else if activeTab === 'displays'}
  {#if loading && displays.length === 0}
    <Loading count={2} height="52px" />
  {:else if displays.length === 0}
    <div class="empty">No displays detected</div>
  {:else}
    <div class="device-list">
      {#each displays as disp, i}
        <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
          <div class="device-icon">&#x1F5B5;</div>
          <div class="device-info">
            <span class="device-name">
              {disp.name}
              {#if disp.builtIn}
                <span class="built-in-tag">Built-in</span>
              {/if}
            </span>
            <span class="device-meta">
              {disp.resolution}
              {#if disp.refreshRate}
                | {disp.refreshRate}{/if}
              | GPU: {disp.gpu}
            </span>
          </div>
          {#if disp.refreshRate}
            <span class="device-badge">{disp.refreshRate}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'network'}
  {#if loading && networkInterfaces.length === 0}
    <Loading count={3} height="52px" />
  {:else if networkInterfaces.length === 0}
    <div class="empty">No network interfaces found</div>
  {:else}
    <div class="device-list">
      {#each networkInterfaces as iface, i}
        <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
          <div class="device-icon">&#x1F310;</div>
          <div class="device-info">
            <span class="device-name">{iface.port}</span>
            <span class="device-meta">
              {iface.device} | MAC: {iface.mac}
              {#if iface.ip}
                | IP: {iface.ip}{/if}
            </span>
          </div>
          <Badge variant={iface.status === 'active' ? 'success' : 'default'}>
            {iface.status}
          </Badge>
        </div>
      {/each}
    </div>
  {/if}
{:else if activeTab === 'system'}
  {#if loading && !systemInfo}
    <Loading count={1} height="200px" />
  {:else if !systemInfo}
    <div class="empty">System info unavailable</div>
  {:else}
    <div class="system-card card">
      <div class="system-details">
        <div class="system-detail">
          <span class="system-label">Model</span>
          <span class="system-value">{systemInfo.model}</span>
        </div>
        <div class="system-detail">
          <span class="system-label">CPU</span>
          <span class="system-value">{systemInfo.cpuBrand}</span>
        </div>
        <div class="system-detail">
          <span class="system-label">Cores / Threads</span>
          <span class="system-value">{systemInfo.cpuCores} cores / {systemInfo.cpuThreads} threads</span>
        </div>
        <div class="system-detail">
          <span class="system-label">Memory</span>
          <span class="system-value">{systemInfo.ram}</span>
        </div>
        <div class="system-detail">
          <span class="system-label">macOS Version</span>
          <span class="system-value">{systemInfo.macosVersion}</span>
        </div>
        <div class="system-detail">
          <span class="system-label">Serial Number</span>
          <span class="system-value">{systemInfo.serial}</span>
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
  /* USB / Audio / Display / Network device list */
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
    display: flex;
    align-items: center;
    gap: 8px;
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

  .built-in-tag {
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 400;
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

  /* System Info */
  .system-card {
    padding: 20px;
    max-width: 500px;
  }
  .system-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .system-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .system-label {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }
  .system-value {
    font-size: 0.85rem;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    text-align: right;
    word-break: break-word;
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
