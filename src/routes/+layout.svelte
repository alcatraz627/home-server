<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types';
  import { APP } from '$lib/constants/app';
  import { navigating, page } from '$app/stores';
  import { onMount } from 'svelte';
  import { theme, THEMES, THEME_SWATCHES, setTheme, initTheme } from '$lib/theme';
  import type { Theme } from '$lib/theme';
  import { goto } from '$app/navigation';
  import Toast from '$lib/components/Toast.svelte';
  import AiChat from '$lib/components/AiChat.svelte';
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import { browser } from '$app/environment';
  import { targetDevice, remoteDevices, setTarget, addDevice, removeDevice, getApiBase } from '$lib/device-context';
  import { NAV_GROUPS } from '$lib/constants/nav';
  import type { NavItem } from '$lib/constants/nav';
  import Icon from '$lib/components/Icon.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';

  let { data, children } = $props<{ data: LayoutData; children: any }>();
  let sidebarOpen = $state(false);
  let navSearch = $state('');

  // ── Stats config ─────────────────────────────────────────────────────────────
  type CpuMode = 'percent' | 'load';
  type RefreshInterval = 2 | 5 | 10 | 30 | 0;

  type StatKey = 'mem' | 'cpu' | 'uptime' | 'swap' | 'procs' | 'net' | 'netSpeed' | 'diskIO';
  const ALL_STATS: { key: StatKey; label: string; desc: string }[] = [
    { key: 'mem', label: 'Memory', desc: 'RAM usage percentage' },
    { key: 'cpu', label: 'CPU', desc: 'Processor load or utilization' },
    { key: 'uptime', label: 'Uptime', desc: 'Time since last reboot' },
    { key: 'swap', label: 'Swap', desc: 'Virtual memory swap usage' },
    { key: 'procs', label: 'Processes', desc: 'Total running process count' },
    { key: 'net', label: 'Network', desc: 'Cumulative bytes in/out' },
    { key: 'netSpeed', label: 'Net Speed', desc: 'Live bytes/sec throughput' },
    { key: 'diskIO', label: 'Disk I/O', desc: 'Disk read/write throughput' },
  ];
  const DEFAULT_VISIBLE_STATS: StatKey[] = ['mem', 'cpu', 'uptime'];

  const STATS_KEY = 'hs:stats-config';

  function loadStatsConfig() {
    if (!browser)
      return {
        cpuMode: 'load' as CpuMode,
        refreshInterval: 5 as RefreshInterval,
        visibleStats: DEFAULT_VISIBLE_STATS,
      };
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          cpuMode: (parsed.cpuMode ?? 'load') as CpuMode,
          refreshInterval: (parsed.refreshInterval ?? 5) as RefreshInterval,
          visibleStats: (parsed.visibleStats ?? DEFAULT_VISIBLE_STATS) as StatKey[],
        };
      }
    } catch {}
    return {
      cpuMode: 'load' as CpuMode,
      refreshInterval: 5 as RefreshInterval,
      visibleStats: DEFAULT_VISIBLE_STATS,
    };
  }

  function saveStatsConfig() {
    if (!browser) return;
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({
        cpuMode: statsConfig.cpuMode,
        refreshInterval: statsConfig.refreshInterval,
        visibleStats: statsConfig.visibleStats,
      }),
    );
  }

  let statsConfig = $state(loadStatsConfig());
  let statsDropdownOpen = $state(false);
  let settingsOpen = $state(false);
  const currentSwatch = $derived(THEME_SWATCHES[$theme]);
  const currentThemeLabel = $derived(THEMES.find((t) => t.id === $theme)?.label ?? $theme);

  // Manage Devices modal
  let manageDevicesOpen = $state(false);
  let newDeviceHostname = $state('');
  let newDeviceIp = $state('');
  let newDevicePort = $state('5173');
  let newDeviceLabel = $state('');

  function isStatVisible(key: StatKey): boolean {
    return statsConfig.visibleStats.includes(key);
  }

  function toggleStatVisibility(key: StatKey) {
    if (statsConfig.visibleStats.includes(key)) {
      statsConfig.visibleStats = statsConfig.visibleStats.filter((k) => k !== key);
    } else {
      statsConfig.visibleStats = [...statsConfig.visibleStats, key];
    }
    saveStatsConfig();
  }

  function formatNetBytes(b: number): string {
    if (b < 1024) return `${b}B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)}K`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)}M`;
    return `${(b / 1073741824).toFixed(1)}G`;
  }

  // ── Net speed tracking ──────────────────────────────────────────────────
  let prevNetBytes = $state<{ bytesIn: number; bytesOut: number; time: number } | null>(null);
  let netSpeed = $state<{ inPerSec: number; outPerSec: number }>({ inPerSec: 0, outPerSec: 0 });

  function updateNetSpeed() {
    const now = Date.now();
    const cur = data.system.networkBytes;
    if (prevNetBytes && now > prevNetBytes.time) {
      const dt = (now - prevNetBytes.time) / 1000;
      netSpeed = {
        inPerSec: Math.max(0, (cur.bytesIn - prevNetBytes.bytesIn) / dt),
        outPerSec: Math.max(0, (cur.bytesOut - prevNetBytes.bytesOut) / dt),
      };
    }
    prevNetBytes = { bytesIn: cur.bytesIn, bytesOut: cur.bytesOut, time: now };
  }

  function netSpeedColor(bytesPerSec: number): string {
    const mb = bytesPerSec / 1048576;
    if (mb > 10) return 'var(--danger)';
    if (mb >= 1) return 'var(--warning)';
    return 'var(--success)';
  }

  function handleAddDevice() {
    if (!newDeviceIp.trim()) return;
    addDevice({
      hostname: newDeviceHostname.trim() || newDeviceIp.trim(),
      ip: newDeviceIp.trim(),
      port: parseInt(newDevicePort, 10) || 5173,
      label: newDeviceLabel.trim(),
    });
    newDeviceHostname = '';
    newDeviceIp = '';
    newDevicePort = '5173';
    newDeviceLabel = '';
  }

  function helpUrl(): string {
    const path = $page.url.pathname;
    if (path === '/') return '/docs#dashboard';
    const slug = path.replace(/^\//, '').replace(/\//g, '-');
    return `/docs#${slug}`;
  }

  // PWA install prompt
  let installPromptEvent = $state<any>(null);
  let showInstallBanner = $state(false);

  onMount(() => {
    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      installPromptEvent = e;
      // Show banner if not dismissed before
      if (!localStorage.getItem('hs:install-dismissed')) {
        showInstallBanner = true;
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  });

  function setCpuMode(m: CpuMode) {
    statsConfig.cpuMode = m;
    saveStatsConfig();
  }

  function setRefreshInterval(v: RefreshInterval) {
    statsConfig.refreshInterval = v;
    saveStatsConfig();
  }

  // ── Nav Groups ──────────────────────────────────────────────────────────────
  const NAV_GROUPS_KEY = 'hs:nav-groups';
  const NAV_PINNED_KEY = 'hs:nav-pinned';

  function loadExpandedGroups(): Record<string, boolean> {
    if (!browser) return {};
    try {
      const raw = localStorage.getItem(NAV_GROUPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Default: all groups expanded
    const defaults: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) defaults[g.id] = true;
    return defaults;
  }

  function loadPinnedItems(): string[] {
    if (!browser) return [];
    try {
      const raw = localStorage.getItem(NAV_PINNED_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  let expandedGroups = $state<Record<string, boolean>>(loadExpandedGroups());
  let pinnedHrefs = $state<string[]>(loadPinnedItems());

  function toggleGroup(id: string) {
    expandedGroups[id] = !expandedGroups[id];
    if (browser) localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(expandedGroups));
  }

  function togglePin(href: string) {
    if (pinnedHrefs.includes(href)) {
      pinnedHrefs = pinnedHrefs.filter((h) => h !== href);
    } else {
      pinnedHrefs = [...pinnedHrefs, href];
    }
    if (browser) localStorage.setItem(NAV_PINNED_KEY, JSON.stringify(pinnedHrefs));
  }

  function isPinned(href: string): boolean {
    return pinnedHrefs.includes(href);
  }

  // Build a flat lookup for pinned items
  let allNavItems = $derived(NAV_GROUPS.flatMap((g) => g.items));
  let pinnedItems = $derived(
    pinnedHrefs.map((h) => allNavItems.find((i) => i.href === h)).filter(Boolean) as NavItem[],
  );

  // Sidebar search filter
  let filteredGroups = $derived.by(() => {
    const q = navSearch.toLowerCase().trim();
    if (!q) return NAV_GROUPS;
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          group.label.toLowerCase().includes(q),
      ),
    })).filter((group) => group.items.length > 0);
  });

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }

  // ── CPU display ───────────────────────────────────────────────────────────────
  function cpuLabel(): string {
    if (statsConfig.cpuMode === 'percent') {
      const pct = Math.round((data.system.loadAvg / data.system.cpuCount) * 100);
      return `CPU ${pct}%`;
    }
    return `LOAD ${data.system.loadAvg}`;
  }

  function cpuColor(): string {
    const ratio = data.system.loadAvg / data.system.cpuCount;
    return ratio >= 0.9 ? 'var(--danger)' : ratio >= 0.7 ? 'var(--warning)' : 'var(--success)';
  }

  onMount(() => {
    initTheme();
    updateNetSpeed();
    const speedInterval = setInterval(updateNetSpeed, 5000);
    return () => clearInterval(speedInterval);
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (settingsOpen) {
        settingsOpen = false;
      } else if (manageDevicesOpen) {
        manageDevicesOpen = false;
      } else if (statsDropdownOpen) {
        statsDropdownOpen = false;
      } else if (sidebarOpen) {
        sidebarOpen = false;
      }
    }
  }
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="app">
  <header>
    <button class="menu-toggle" onclick={() => (sidebarOpen = !sidebarOpen)} aria-label="Toggle menu"
      ><Icon name="menu" size={18} /></button
    >
    <h1>Home Server</h1>

    <div class="system-stats">
      {#if isStatVisible('mem')}
        <span
          class="stat"
          title="Memory usage"
          style="color: {data.system.memUsedPercent >= 90
            ? 'var(--danger)'
            : data.system.memUsedPercent >= 70
              ? 'var(--warning)'
              : 'var(--success)'}"
        >
          MEM {data.system.memUsedPercent}%
        </span>
      {/if}

      {#if isStatVisible('cpu')}
        <span class="stat" title="CPU load" style="color: {cpuColor()}">
          {cpuLabel()}
        </span>
      {/if}

      {#if isStatVisible('uptime')}
        <span class="stat" title="System uptime">{data.system.uptime}h up</span>
      {/if}

      {#if isStatVisible('swap')}
        <span
          class="stat"
          title="Swap usage"
          style="color: {data.system.swapPercent >= 80
            ? 'var(--danger)'
            : data.system.swapPercent >= 50
              ? 'var(--warning)'
              : 'var(--text-muted)'}"
        >
          SWAP {data.system.swapPercent}%
        </span>
      {/if}

      {#if isStatVisible('procs')}
        <span class="stat" title="Process count">
          PROCS {data.system.processCount}
        </span>
      {/if}

      {#if isStatVisible('net')}
        <span class="stat" title="Network throughput (cumulative)">
          NET {formatNetBytes(data.system.networkBytes.bytesIn)}↓ {formatNetBytes(data.system.networkBytes.bytesOut)}↑
        </span>
      {/if}

      {#if isStatVisible('netSpeed')}
        <span class="stat" title="Network speed (bytes/sec)">
          <span style="color: {netSpeedColor(netSpeed.inPerSec)}"
            >{formatNetBytes(Math.round(netSpeed.inPerSec))}/s↓</span
          >
          <span style="color: {netSpeedColor(netSpeed.outPerSec)}"
            >{formatNetBytes(Math.round(netSpeed.outPerSec))}/s↑</span
          >
        </span>
      {/if}

      {#if isStatVisible('diskIO')}
        <span class="stat" title="Disk I/O (not available)"> DISK I/O n/a </span>
      {/if}

      <!-- Stats settings gear -->
      <div class="stats-gear-wrap">
        <button class="icon-btn" aria-label="Stats settings" onclick={() => (statsDropdownOpen = !statsDropdownOpen)}
          ><Icon name="settings" size={14} /></button
        >

        {#if statsDropdownOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="stats-dropdown" role="menu">
            <div class="dropdown-section">
              <span class="dropdown-label">CPU display</span>
              <div class="dropdown-options">
                <button class:selected={statsConfig.cpuMode === 'load'} onclick={() => setCpuMode('load')}
                  >Load avg</button
                >
                <button class:selected={statsConfig.cpuMode === 'percent'} onclick={() => setCpuMode('percent')}
                  >Percent</button
                >
              </div>
            </div>
            <div class="dropdown-section">
              <span class="dropdown-label">Refresh</span>
              <div class="dropdown-options">
                {#each [2, 5, 10, 30, 0] as const as interval}
                  <button
                    class:selected={statsConfig.refreshInterval === interval}
                    onclick={() => setRefreshInterval(interval)}>{interval === 0 ? 'Off' : `${interval}s`}</button
                  >
                {/each}
              </div>
            </div>
            <div class="dropdown-section">
              <span class="dropdown-label">Visible stats</span>
              <div class="dropdown-stats-list">
                {#each ALL_STATS as s}
                  <label class="stat-toggle-item">
                    <input
                      type="checkbox"
                      checked={isStatVisible(s.key)}
                      onchange={() => toggleStatVisibility(s.key)}
                    />
                    <span class="stat-toggle-text">
                      <span class="stat-toggle-label">{s.label}</span>
                      <span class="stat-toggle-desc">{s.desc}</span>
                    </span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
          <!-- click-away overlay -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="dropdown-overlay" onclick={() => (statsDropdownOpen = false)} role="presentation"></div>
        {/if}
      </div>
    </div>

    <!-- Theme indicator -->
    <Tooltip text="Change theme" position="bottom">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="theme-indicator" onclick={() => (settingsOpen = true)} role="button" tabindex="0">
        <span class="theme-label">{currentThemeLabel}</span>
        <span class="theme-dots">
          <span class="theme-dot" style="background: {currentSwatch.bg}"></span>
          <span class="theme-dot" style="background: {currentSwatch.accent}"></span>
          <span class="theme-dot" style="background: {currentSwatch.text}"></span>
        </span>
      </div>
    </Tooltip>

    <!-- Help button -->
    <Tooltip text="Help" position="bottom">
      <button class="icon-btn" aria-label="Help" onclick={() => goto(helpUrl())}><Icon name="help" size={16} /></button>
    </Tooltip>

    <Tooltip text="Settings" position="bottom">
      <button class="icon-btn" aria-label="Settings" onclick={() => (settingsOpen = true)}
        ><Icon name="settings" size={16} /></button
      >
    </Tooltip>

    <div class="device-selector">
      <select
        value={$targetDevice}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value;
          if (v === '__manage__') {
            manageDevicesOpen = true;
            // Reset the select back to current value
            (e.currentTarget as HTMLSelectElement).value = $targetDevice;
          } else {
            setTarget(v);
          }
        }}
        aria-label="Target device"
        class="device-select"
      >
        <option value="local">{data.device.hostname} (local)</option>
        {#each $remoteDevices as d}
          <option value={d.ip}>{d.label || d.hostname} ({d.ip})</option>
        {/each}
        <option value="__manage__">Manage Devices...</option>
      </select>
    </div>
  </header>

  <div class="body">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class:open={sidebarOpen}>
      <div class="nav-search">
        <SearchInput bind:value={navSearch} placeholder="Search..." size="sm" clearable />
      </div>
      {#if pinnedItems.length > 0 && !navSearch}
        <div class="nav-group">
          <button class="nav-group-header" onclick={() => {}}>
            <span class="nav-group-label">Pinned</span>
          </button>
          <div class="nav-group-items" style="max-height: none;">
            {#each pinnedItems as item (item.href)}
              <a
                href={item.href}
                class="nav-link"
                class:active={isActive(item.href)}
                onclick={() => (sidebarOpen = false)}
              >
                <span class="nav-icon">{item.icon}</span>
                <span class="nav-text">
                  <span class="nav-label">{item.label}</span>
                  <span class="nav-desc">{item.desc}</span>
                </span>
                <button
                  class="pin-btn pinned"
                  onclick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    togglePin(item.href);
                  }}
                  aria-label="Unpin {item.label}"
                  title="Unpin"><Icon name="star-filled" size={12} /></button
                >
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#each filteredGroups as group (group.id)}
        {@const isExpanded = expandedGroups[group.id] !== false}
        <div class="nav-group">
          <button class="nav-group-header" onclick={() => toggleGroup(group.id)}>
            <span class="nav-group-chevron" class:expanded={isExpanded}><Icon name="chevron-right" size={12} /></span>
            <span class="nav-group-label">{group.label}</span>
          </button>
          <div class="nav-group-items" class:collapsed={!isExpanded}>
            {#each group.items as item (item.href)}
              <a
                href={item.href}
                class="nav-link"
                class:active={isActive(item.href)}
                onclick={() => (sidebarOpen = false)}
                ondblclick={(e) => {
                  e.preventDefault();
                  togglePin(item.href);
                }}
              >
                <span class="nav-icon">{item.icon}</span>
                <span class="nav-text">
                  <span class="nav-label">{item.label}</span>
                  <span class="nav-desc">{item.desc}</span>
                </span>
                <button
                  class="pin-btn"
                  class:pinned={isPinned(item.href)}
                  onclick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    togglePin(item.href);
                  }}
                  aria-label={isPinned(item.href) ? `Unpin ${item.label}` : `Pin ${item.label}`}
                  title={isPinned(item.href) ? 'Unpin' : 'Pin'}
                  >{#if isPinned(item.href)}<Icon name="star-filled" size={12} />{:else}<Icon
                      name="star"
                      size={12}
                    />{/if}</button
                >
              </a>
            {/each}
          </div>
        </div>
      {/each}
      <span class="version-tag">{APP.version}</span>
    </nav>

    <main>
      {#if $navigating}
        <div class="loading-bar"></div>
      {/if}
      {@render children()}
    </main>
  </div>
</div>

{#if showInstallBanner}
  <div class="install-banner">
    <span>Install Home Server as an app for quick access</span>
    <button
      class="install-btn"
      onclick={async () => {
        if (installPromptEvent) {
          installPromptEvent.prompt();
          const r = await installPromptEvent.userChoice;
          if (r.outcome === 'accepted') showInstallBanner = false;
        }
      }}>Install</button
    >
    <button
      class="dismiss-btn"
      onclick={() => {
        showInstallBanner = false;
        localStorage.setItem('hs:install-dismissed', '1');
      }}><Icon name="close" size={14} /></button
    >
  </div>
{/if}

{#if manageDevicesOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => (manageDevicesOpen = false)} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Manage Devices">
      <div class="modal-header">
        <h3>Manage Devices</h3>
        <button class="icon-btn" onclick={() => (manageDevicesOpen = false)}><Icon name="close" size={16} /></button>
      </div>

      <div class="modal-body">
        {#if $remoteDevices.length > 0}
          <div class="device-list-manage">
            {#each $remoteDevices as d}
              <div class="device-item">
                <div class="device-item-info">
                  <span class="device-item-label">{d.label || d.hostname}</span>
                  <span class="device-item-addr">{d.ip}:{d.port}</span>
                </div>
                <button class="btn-sm btn-danger" onclick={() => removeDevice(d.ip)}>Remove</button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="device-empty">No remote devices configured.</p>
        {/if}

        <div class="device-add-form">
          <span class="dropdown-label">Add Device</span>
          <div class="device-add-fields">
            <input type="text" bind:value={newDeviceLabel} placeholder="Label (optional)" class="device-input" />
            <input type="text" bind:value={newDeviceHostname} placeholder="Hostname" class="device-input" />
            <input type="text" bind:value={newDeviceIp} placeholder="IP address" class="device-input" required />
            <input type="text" bind:value={newDevicePort} placeholder="Port" class="device-input device-port-input" />
          </div>
          <button class="btn-add-device" onclick={handleAddDevice} disabled={!newDeviceIp.trim()}>Add</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<Toast />
<AiChat />
<SettingsPanel bind:open={settingsOpen} />

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  /* ── Header ─────────────────────────────────────────────────────────────────── */
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 20;
    position: relative;
  }

  header h1 {
    font-size: 1.05rem;
    font-weight: 600;
    flex: 1;
    font-family: 'Space Grotesk', sans-serif;
    letter-spacing: -0.01em;
  }

  .device-selector {
    display: flex;
    align-items: center;
  }

  .device-select {
    font-size: 0.72rem;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    max-width: 180px;
  }

  .device-select:hover {
    border-color: var(--accent);
    color: var(--text-secondary);
  }

  /* ── System stats ────────────────────────────────────────────────────────────── */
  .system-stats {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat {
    font-size: 0.72rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.04em;
    cursor: default;
    opacity: 0.6;
    transition:
      color 0.3s,
      opacity 0.2s;
  }

  .stat:hover {
    opacity: 1;
  }

  /* ── Stats gear dropdown ─────────────────────────────────────────────────────── */
  .stats-gear-wrap {
    position: relative;
  }

  .icon-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1.4;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }

  .icon-btn:hover {
    border-color: var(--border);
    color: var(--text-secondary);
    background: var(--bg-hover);
  }

  .stats-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 180px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    padding: 10px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dropdown-overlay {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .dropdown-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dropdown-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
  }

  .dropdown-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .dropdown-options button {
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .dropdown-options button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dropdown-options button.selected {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .dropdown-stats-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-toggle-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    cursor: pointer;
    padding: 2px 0;
  }

  .stat-toggle-item input[type='checkbox'] {
    accent-color: var(--accent);
    margin-top: 2px;
  }

  .stat-toggle-text {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .stat-toggle-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .stat-toggle-desc {
    font-size: 0.6rem;
    color: var(--text-faint);
    line-height: 1.3;
  }

  /* ── Theme indicator ────────────────────────────────────────────────────────── */
  .theme-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .theme-indicator:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .theme-label {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .theme-dots {
    display: flex;
    gap: 3px;
    align-items: center;
  }

  .theme-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }

  /* ── Mobile menu toggle ──────────────────────────────────────────────────────── */
  .menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 1.3rem;
    cursor: pointer;
  }

  /* ── Body / layout ───────────────────────────────────────────────────────────── */
  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Sidebar nav ─────────────────────────────────────────────────────────────── */
  nav {
    width: 210px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
  }

  nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    color: var(--text-secondary);
    text-decoration: none;
    border-left: 3px solid transparent;
    transition:
      background 0.18s ease,
      color 0.18s ease,
      transform 0.18s ease;
    position: relative;
  }

  nav a:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    transform: translateX(2px);
  }

  nav a.active {
    color: var(--accent);
    border-left: 3px solid var(--accent);
    background: var(--accent-bg);
    box-shadow:
      inset 0 0 0 0 transparent,
      inset 2px 0 12px rgba(88, 166, 255, 0.06);
  }

  /* ── Nav groups ──────────────────────────────────────────────────────────────── */
  .nav-group {
    display: flex;
    flex-direction: column;
  }

  /* Nav search */
  .nav-search {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .nav-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-faint);
    transition: color 0.15s;
  }

  .nav-group-header:hover {
    color: var(--text-muted);
  }

  .nav-group-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .nav-group-chevron {
    font-size: 0.6rem;
    transition: transform 0.2s ease;
    display: inline-block;
  }

  .nav-group-chevron.expanded {
    transform: rotate(90deg);
  }

  .nav-group-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 600px;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }

  .nav-group-items.collapsed {
    max-height: 0;
  }

  /* ── Pin button ──────────────────────────────────────────────────────────────── */
  .pin-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.7rem;
    color: var(--text-faint);
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;
    padding: 2px 4px;
    line-height: 1;
  }

  nav a:hover .pin-btn {
    opacity: 0.6;
  }

  nav a:hover .pin-btn:hover {
    opacity: 1;
    color: var(--accent);
  }

  .pin-btn.pinned {
    opacity: 0.7;
    color: var(--accent);
  }

  nav a:hover .pin-btn.pinned {
    opacity: 1;
  }

  /* ── Nav item content ────────────────────────────────────────────────────────── */
  .nav-icon {
    font-size: 1rem;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
    opacity: 0.85;
  }

  nav a.active .nav-icon {
    opacity: 1;
  }

  .nav-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .nav-label {
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
  }

  .nav-desc {
    font-size: 0.68rem;
    color: var(--text-faint);
    line-height: 1.2;
    white-space: nowrap;
    transition: color 0.18s;
  }

  nav a:hover .nav-desc {
    color: var(--text-muted);
  }

  nav a.active .nav-desc {
    color: var(--accent);
    opacity: 0.7;
  }

  /* ── Version tag ─────────────────────────────────────────────────────────────── */
  .version-tag {
    margin-top: auto;
    padding: 10px 16px;
    font-size: 0.68rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.04em;
  }

  /* ── Main content ────────────────────────────────────────────────────────────── */
  main {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    position: relative;
  }

  .loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    background-size: 200% 100%;
    animation: shimmer 1.2s ease-in-out infinite;
    z-index: 50;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* ── Responsive ──────────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .menu-toggle {
      display: block;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .system-stats {
      display: none;
    }

    .theme-indicator {
      display: none;
    }

    nav {
      position: fixed;
      top: 49px;
      left: 0;
      bottom: 0;
      z-index: 10;
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
      width: 240px;
    }

    nav.open {
      transform: translateX(0);
    }

    nav a {
      padding: 12px 16px;
      min-height: 44px;
    }

    main {
      padding: 12px;
    }

    header h1 {
      font-size: 0.95rem;
    }
  }

  /* ── Install banner ────────────────────────────────────────────────────────── */
  :global(.install-banner) {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 150;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--accent);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-size: 0.82rem;
    color: var(--text-secondary);
    animation: slideInRight 0.3s ease-out;
  }

  :global(.install-btn) {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    background: var(--accent);
    color: white;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  :global(.dismiss-btn) {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 6px;
  }

  /* ── Manage Devices modal ────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    width: 420px;
    max-width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h3 {
    font-size: 0.95rem;
    margin: 0;
  }

  .modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .device-list-manage {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .device-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--bg-hover);
    border-radius: 6px;
  }

  .device-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .device-item-label {
    font-size: 0.82rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .device-item-addr {
    font-size: 0.68rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  .device-empty {
    font-size: 0.78rem;
    color: var(--text-faint);
    text-align: center;
    padding: 12px;
  }

  .device-add-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .device-add-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .device-input {
    font-size: 0.78rem;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .device-port-input {
    max-width: 80px;
  }

  .btn-add-device {
    font-size: 0.78rem;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
    cursor: pointer;
    font-weight: 500;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .btn-add-device:hover:not(:disabled) {
    background: var(--accent);
    color: white;
  }

  .btn-add-device:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.btn-sm) {
    font-size: 0.72rem;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
  }

  :global(.btn-danger) {
    border-color: var(--danger);
    color: var(--danger);
  }

  /* Touch target minimum sizing for interactive elements */
  @media (pointer: coarse) {
    button,
    .btn,
    .icon-btn,
    a {
      min-height: 44px;
      min-width: 44px;
    }

    select {
      min-height: 44px;
    }
  }
</style>
