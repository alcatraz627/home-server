<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types';
  import { APP } from '$lib/constants/app';
  import { navigating, page } from '$app/stores';
  import { onMount } from 'svelte';
  import { theme, THEMES, setTheme, initTheme } from '$lib/theme';
  import Toast from '$lib/components/Toast.svelte';
  import AiChat from '$lib/components/AiChat.svelte';
  import { browser } from '$app/environment';

  let { data, children } = $props<{ data: LayoutData; children: any }>();
  let sidebarOpen = $state(false);

  // ── Stats config ─────────────────────────────────────────────────────────────
  type CpuMode = 'percent' | 'load';
  type RefreshInterval = 2 | 5 | 10 | 30 | 0;

  const STATS_KEY = 'hs:stats-config';

  function loadStatsConfig() {
    if (!browser) return { cpuMode: 'load' as CpuMode, refreshInterval: 5 as RefreshInterval };
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw) as { cpuMode: CpuMode; refreshInterval: RefreshInterval };
    } catch {}
    return { cpuMode: 'load' as CpuMode, refreshInterval: 5 as RefreshInterval };
  }

  function saveStatsConfig() {
    if (!browser) return;
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ cpuMode: statsConfig.cpuMode, refreshInterval: statsConfig.refreshInterval }),
    );
  }

  let statsConfig = $state(loadStatsConfig());
  let statsDropdownOpen = $state(false);

  function setCpuMode(m: CpuMode) {
    statsConfig.cpuMode = m;
    saveStatsConfig();
  }

  function setRefreshInterval(v: RefreshInterval) {
    statsConfig.refreshInterval = v;
    saveStatsConfig();
  }

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const nav = [
    { href: '/', label: 'Dashboard', desc: 'System overview', icon: '◆' },
    { href: '/files', label: 'Files', desc: 'Transfer & manage', icon: '◫' },
    { href: '/lights', label: 'Lights', desc: 'Smart home', icon: '◉' },
    { href: '/processes', label: 'Processes', desc: 'System monitor', icon: '▦' },
    { href: '/tailscale', label: 'Tailscale', desc: 'VPN network', icon: '⬡' },
    { href: '/backups', label: 'Backups', desc: 'Data protection', icon: '⟲' },
    { href: '/tasks', label: 'Tasks', desc: 'Automation', icon: '⚙' },
    { href: '/keeper', label: 'Keeper', desc: 'Feature tracker', icon: '◈' },
    { href: '/terminal', label: 'Terminal', desc: 'Shell access', icon: '▶' },
    { href: '/docs', label: 'Docs', desc: 'Documentation', icon: '◧' },
    { href: '/showcase', label: 'Showcase', desc: 'Design system', icon: '◎' },
  ];

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
  });
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
</svelte:head>

<div class="app">
  <header>
    <button class="menu-toggle" onclick={() => (sidebarOpen = !sidebarOpen)} aria-label="Toggle menu">☰</button>
    <h1>Home Server</h1>

    <div class="system-stats">
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

      <span class="stat" title="CPU load" style="color: {cpuColor()}">
        {cpuLabel()}
      </span>

      <span class="stat" title="System uptime">{data.system.uptime}h up</span>

      <!-- Stats settings gear -->
      <div class="stats-gear-wrap">
        <button class="icon-btn" aria-label="Stats settings" onclick={() => (statsDropdownOpen = !statsDropdownOpen)}
          >⚙</button
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
          </div>
          <!-- click-away overlay -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="dropdown-overlay" onclick={() => (statsDropdownOpen = false)} role="presentation"></div>
        {/if}
      </div>
    </div>

    <!-- Theme selector -->
    <div class="theme-selector">
      <select
        value={$theme}
        onchange={(e) => setTheme((e.currentTarget as HTMLSelectElement).value as any)}
        aria-label="Select theme"
      >
        {#each THEMES as t}
          <option value={t.id}>{t.label}</option>
        {/each}
      </select>
    </div>

    <span class="device-info">{data.device.hostname}</span>
  </header>

  <div class="body">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class:open={sidebarOpen}>
      {#each nav as item}
        <a href={item.href} class:active={isActive(item.href)} onclick={() => (sidebarOpen = false)}>
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-text">
            <span class="nav-label">{item.label}</span>
            <span class="nav-desc">{item.desc}</span>
          </span>
        </a>
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

<Toast />
<AiChat />

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

  .device-info {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
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
    opacity: 0.9;
    transition: color 0.3s;
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

  /* ── Theme selector ──────────────────────────────────────────────────────────── */
  .theme-selector select {
    font-size: 0.78rem;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s;
    appearance: none;
    -webkit-appearance: none;
    padding-right: 22px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 7px center;
  }

  .theme-selector select:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .theme-selector select:focus {
    outline: none;
    border-color: var(--accent);
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
    }

    .system-stats {
      display: none;
    }

    nav {
      position: fixed;
      top: 49px;
      left: 0;
      bottom: 0;
      z-index: 10;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    nav.open {
      transform: translateX(0);
    }

    main {
      padding: 16px;
    }
  }
</style>
