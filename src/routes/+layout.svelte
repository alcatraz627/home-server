<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types';
  import { APP } from '$lib/constants/app';
  import { navigating, page } from '$app/stores';
  import { onMount } from 'svelte';
  import { theme, toggleTheme, initTheme } from '$lib/theme';
  import Toast from '$lib/components/Toast.svelte';

  let { data, children } = $props<{ data: LayoutData; children: any }>();
  let sidebarOpen = $state(false);

  onMount(() => {
    initTheme();
  });

  const nav = [
    { href: '/', label: 'Dashboard', icon: '⌂' },
    { href: '/files', label: 'Files', icon: '⇄' },
    { href: '/lights', label: 'Lights', icon: '◉' },
    { href: '/processes', label: 'Processes', icon: '⊞' },
    { href: '/tailscale', label: 'Tailscale', icon: '⊶' },
    { href: '/backups', label: 'Backups', icon: '⟲' },
    { href: '/tasks', label: 'Tasks', icon: '⚙' },
    { href: '/keeper', label: 'Keeper', icon: '◈' },
    { href: '/terminal', label: 'Terminal', icon: '▶' },
    { href: '/docs', label: 'Docs', icon: '📄' },
    { href: '/showcase', label: 'Showcase', icon: '◎' },
  ];

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
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
      <span
        class="stat"
        title="CPU load average (1m)"
        style="color: {data.system.loadAvg / data.system.cpuCount >= 0.9
          ? 'var(--danger)'
          : data.system.loadAvg / data.system.cpuCount >= 0.7
            ? 'var(--warning)'
            : 'var(--success)'}"
      >
        LOAD {data.system.loadAvg}
      </span>
      <span class="stat" title="System uptime">{data.system.uptime}h up</span>
    </div>
    <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
      {$theme === 'dark' ? '☀' : '☾'}
    </button>
    <span class="device-info">{data.device.hostname}</span>
  </header>

  <div class="body">
    <nav class:open={sidebarOpen}>
      {#each nav as item}
        <a href={item.href} class:active={isActive(item.href)} onclick={() => (sidebarOpen = false)}>
          <span class="nav-icon">{item.icon}</span>
          {item.label}
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

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  header h1 {
    font-size: 1.1rem;
    font-weight: 600;
    flex: 1;
  }

  .device-info {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .system-stats {
    display: flex;
    gap: 12px;
  }

  .stat {
    font-size: 0.75rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.02em;
    cursor: default;
    transition: color 0.3s;
  }

  .theme-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 8px;
    transition: border-color 0.15s;
  }

  .theme-toggle:hover {
    border-color: var(--accent);
  }

  .menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 1.3rem;
    cursor: pointer;
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  nav {
    width: 200px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition:
      background 0.15s,
      color 0.15s;
    border-left: 3px solid transparent;
  }

  nav a:hover {
    background: var(--bg-hover);
  }

  nav a.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-bg);
  }

  .version-tag {
    margin-top: auto;
    padding: 8px 20px;
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: monospace;
    letter-spacing: 0.03em;
  }

  .nav-icon {
    font-size: 1.1rem;
    width: 20px;
    text-align: center;
  }

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
