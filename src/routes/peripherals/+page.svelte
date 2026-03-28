<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { toast } from '$lib/toast';
  import { fetchApi, postJson } from '$lib/api';
  import { getErrorMessage } from '$lib/errors';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { SK_PERIPHERALS_CACHE, SK_WIFI_PRIVACY } from '$lib/constants/storage-keys';

  interface WifiNetwork {
    ssid: string;
    bssid: string;
    rssi: number;
    channel: number;
    security: string;
    noise: number | null;
    phyMode: string;
  }

  interface BluetoothDevice {
    name: string;
    address: string;
    connected: boolean;
    type: string;
    batteryLevel: number | null;
  }

  interface USBDevice {
    name: string;
    vendor: string;
    serial: string;
    speed: string;
    bus: string;
    port: string;
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

  const CACHE_KEY = SK_PERIPHERALS_CACHE;

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
  let privacyMode = $state(
    typeof localStorage !== 'undefined' ? localStorage.getItem(SK_WIFI_PRIVACY) === 'true' : false,
  );

  function togglePrivacy() {
    privacyMode = !privacyMode;
    localStorage.setItem(SK_WIFI_PRIVACY, String(privacyMode));
  }

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
  let searchQuery = $state('');

  interface SearchResult {
    tab: TabKey;
    tabLabel: string;
    name: string;
    detail: string;
  }

  const searchResults = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    const results: SearchResult[] = [];
    for (const net of wifi) {
      if (net.ssid.toLowerCase().includes(q) || net.bssid.toLowerCase().includes(q)) {
        results.push({ tab: 'wifi', tabLabel: 'WiFi', name: net.ssid, detail: `${net.bssid} | Ch ${net.channel}` });
      }
    }
    for (const dev of bluetooth) {
      if (dev.name.toLowerCase().includes(q) || dev.address.toLowerCase().includes(q)) {
        results.push({ tab: 'bluetooth', tabLabel: 'Bluetooth', name: dev.name, detail: dev.address });
      }
    }
    for (const dev of usb) {
      if (dev.name.toLowerCase().includes(q) || dev.vendor.toLowerCase().includes(q)) {
        results.push({ tab: 'usb', tabLabel: 'USB', name: dev.name, detail: dev.vendor || dev.speed });
      }
    }
    for (const dev of audio) {
      if (dev.name.toLowerCase().includes(q)) {
        results.push({ tab: 'audio', tabLabel: 'Audio', name: dev.name, detail: dev.type });
      }
    }
    for (const disp of displays) {
      if (disp.name.toLowerCase().includes(q) || disp.gpu.toLowerCase().includes(q)) {
        results.push({ tab: 'displays', tabLabel: 'Display', name: disp.name, detail: disp.resolution });
      }
    }
    for (const iface of networkInterfaces) {
      if (
        iface.port.toLowerCase().includes(q) ||
        iface.device.toLowerCase().includes(q) ||
        iface.ip?.toLowerCase().includes(q)
      ) {
        results.push({ tab: 'network', tabLabel: 'Network', name: iface.port, detail: iface.ip || iface.device });
      }
    }
    return results;
  });

  let wifiSort = $state<'rssi' | 'ssid' | 'channel'>('rssi');
  let btToggling = $state<string | null>(null);

  async function refresh() {
    loading = true;
    try {
      const res = await fetchApi('/api/peripherals');
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
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load peripherals'));
    } finally {
      loading = false;
    }
  }

  async function toggleBtConnection(dev: BluetoothDevice) {
    btToggling = dev.address;
    const action = dev.connected ? 'bt-disconnect' : 'bt-connect';
    try {
      const res = await postJson('/api/peripherals', { action, address: dev.address });
      const result = await res.json();
      if (!result.ok) {
        toast.error(result.error || `Failed to ${dev.connected ? 'disconnect' : 'connect'}`);
      } else {
        toast.success(`${dev.connected ? 'Disconnected from' : 'Connected to'} ${dev.name}`);
        await refresh();
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Bluetooth action failed'));
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

<PageHeader
  title="Peripherals"
  description="Scan and inspect connected peripherals including WiFi adapters, Bluetooth devices, and USB hardware."
>
  {#snippet children()}
    <label class="privacy-toggle" title="Blur SSIDs and BSSIDs for privacy">
      <input type="checkbox" checked={privacyMode} onchange={togglePrivacy} />
      Privacy
    </label>
    <Button onclick={refresh} disabled={loading} {loading}>
      {loading ? 'Scanning...' : 'Refresh'}
    </Button>
  {/snippet}
</PageHeader>

<div class="search-bar">
  <SearchInput bind:value={searchQuery} placeholder="Search all peripherals..." size="sm" />
</div>

{#if searchQuery.trim()}
  <div class="search-results">
    {#if searchResults.length === 0}
      <div class="empty">No results for "{searchQuery}"</div>
    {:else}
      <div class="search-result-list">
        {#each searchResults as result, i}
          <button
            class="search-result-row card-stagger"
            style="animation-delay: {i * 20}ms"
            onclick={() => {
              activeTab = result.tab;
              searchQuery = '';
            }}
          >
            <Badge variant="default">{result.tabLabel}</Badge>
            <span class="search-result-name">{result.name}</span>
            <span class="search-result-detail">{result.detail}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <Tabs tabs={tabItems} bind:active={activeTab} syncHash />

  <ErrorBoundary title="This tab encountered an error" compact>
    {#if activeTab === 'wifi'}
      <!-- Current connection -->
      {#if currentWifi}
        <div class="current-connection card">
          <span class="current-label">Connected to</span>
          <span class="current-ssid" class:redacted={privacyMode}>{currentWifi.ssid}</span>
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

      <AsyncState
        loading={loading && wifi.length === 0}
        empty={sortedWifi.length === 0}
        emptyTitle="No WiFi networks found"
        emptyIcon="wifi"
        loadingCount={4}
        loadingHeight="52px"
      >
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
                <span class="net-ssid" class:redacted={privacyMode}>{net.ssid}</span>
                <span class="net-meta">
                  <span class:redacted={privacyMode}>{net.bssid}</span> | Ch {net.channel} | {net.rssi} dBm{#if net.noise != null}
                    | Noise: {net.noise} dBm{/if}{#if net.phyMode}
                    | {net.phyMode}{/if}
                </span>
              </div>
              <Badge variant={isOpenNetwork(net.security) ? 'danger' : 'success'}>
                {isOpenNetwork(net.security) ? 'Open' : net.security}
              </Badge>
            </div>
          {/each}
        </div>
      </AsyncState>
    {:else if activeTab === 'bluetooth'}
      <AsyncState
        loading={loading && bluetooth.length === 0}
        empty={bluetooth.length === 0}
        emptyTitle="No Bluetooth devices found"
        emptyIcon="bluetooth"
        loadingCount={3}
        loadingHeight="52px"
      >
        <div class="bt-list">
          {#each bluetooth as dev, i}
            <div class="bt-row card-stagger" style="animation-delay: {i * 30}ms">
              <span class="bt-status">
                <span class="dot" class:connected={dev.connected}></span>
              </span>
              <div class="bt-info">
                <span class="bt-name">{dev.name}</span>
                <span class="bt-meta"
                  >{dev.address} | {dev.type}{#if dev.batteryLevel != null}
                    | Battery: {dev.batteryLevel}%{/if}</span
                >
              </div>
              {#if dev.batteryLevel != null}
                <span class="bt-battery" class:low={dev.batteryLevel <= 20}>{dev.batteryLevel}%</span>
              {/if}
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
      </AsyncState>
    {:else if activeTab === 'usb'}
      <AsyncState
        loading={loading && usb.length === 0}
        empty={usb.length === 0}
        emptyTitle="No USB devices found"
        emptyIcon="usb"
        loadingCount={3}
        loadingHeight="52px"
      >
        <div class="device-list">
          {#each usb as dev, i}
            <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
              <div class="device-icon"><Icon name="usb" size={18} /></div>
              <div class="device-info">
                <span class="device-name">{dev.name}</span>
                <span class="device-meta">
                  {#if dev.vendor}Vendor: {dev.vendor}{/if}
                  {#if dev.serial}
                    | Serial: {dev.serial}{/if}
                  {#if dev.bus}
                    | Bus: {dev.bus}{/if}
                  {#if dev.port}
                    | Port: {dev.port}{/if}
                </span>
              </div>
              {#if dev.speed}
                <span class="device-badge">{dev.speed}</span>
              {/if}
            </div>
          {/each}
        </div>
      </AsyncState>
    {:else if activeTab === 'audio'}
      <AsyncState
        loading={loading && audio.length === 0}
        empty={audio.length === 0}
        emptyTitle="No audio devices found"
        emptyIcon="headphones"
        loadingCount={3}
        loadingHeight="52px"
      >
        <div class="device-list">
          {#each audio as dev, i}
            <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
              <div class="device-icon">
                {#if dev.type === 'input'}<Icon name="headphones" size={18} />{:else}<Icon
                    name="volume-high"
                    size={18}
                  />{/if}
              </div>
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
      </AsyncState>
    {:else if activeTab === 'battery'}
      <AsyncState
        loading={loading && !battery}
        empty={!battery}
        emptyTitle="No battery detected"
        emptyIcon="battery"
        emptyHint="Desktop Mac or unavailable"
        loadingCount={1}
        loadingHeight="140px"
      >
        {#if battery}
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
      </AsyncState>
    {:else if activeTab === 'displays'}
      <AsyncState
        loading={loading && displays.length === 0}
        empty={displays.length === 0}
        emptyTitle="No displays detected"
        emptyIcon="monitor"
        loadingCount={2}
        loadingHeight="52px"
      >
        <div class="device-list">
          {#each displays as disp, i}
            <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
              <div class="device-icon"><Icon name="monitor" size={18} /></div>
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
      </AsyncState>
    {:else if activeTab === 'network'}
      <AsyncState
        loading={loading && networkInterfaces.length === 0}
        empty={networkInterfaces.length === 0}
        emptyTitle="No network interfaces found"
        emptyIcon="globe"
        loadingCount={3}
        loadingHeight="52px"
      >
        <div class="device-list">
          {#each networkInterfaces as iface, i}
            <div class="device-row card-stagger" style="animation-delay: {i * 30}ms">
              <div class="device-icon"><Icon name="globe" size={18} /></div>
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
      </AsyncState>
    {:else if activeTab === 'system'}
      <AsyncState
        loading={loading && !systemInfo}
        empty={!systemInfo}
        emptyTitle="System info unavailable"
        emptyIcon="cpu"
        loadingCount={1}
        loadingHeight="200px"
      >
        {#if systemInfo}
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
      </AsyncState>
    {/if}
  </ErrorBoundary>
{/if}

<style>
  .privacy-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .privacy-toggle input {
    cursor: pointer;
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

  /* Search */
  .search-bar {
    margin-bottom: 12px;
  }

  .search-results {
    margin-bottom: 16px;
  }

  .search-result-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .search-result-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    width: 100%;
    transition: background 0.15s;
  }

  .search-result-row:hover {
    background: var(--bg-hover);
  }

  .search-result-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .search-result-detail {
    font-size: 0.72rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    margin-left: auto;
  }

  /* Bluetooth battery */
  .bt-battery {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--accent-bg);
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }

  .bt-battery.low {
    background: var(--danger-bg, rgba(255, 80, 80, 0.1));
    color: var(--danger);
  }

  @media (max-width: 640px) {
    .network-row {
      flex-wrap: wrap;
    }
    .device-row {
      flex-wrap: wrap;
    }
  }
</style>
