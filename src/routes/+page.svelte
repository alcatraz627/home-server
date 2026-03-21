<script lang="ts">
  import type { PageData } from './$types';
  import type { LayoutData } from './$types';

  let { data } = $props<{ data: PageData & LayoutData }>();
  const { dashboard, system } = $derived({ dashboard: data.dashboard, system: data.system });

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const memColor = $derived(
    system.memUsedPercent >= 90 ? 'var(--danger)' : system.memUsedPercent >= 70 ? 'var(--warning)' : 'var(--success)',
  );

  const loadColor = $derived(() => {
    const ratio = system.loadAvg / system.cpuCount;
    return ratio >= 0.9 ? 'var(--danger)' : ratio >= 0.7 ? 'var(--warning)' : 'var(--success)';
  });

  const widgets = [
    { href: '/files', icon: '⇄', label: 'Files' },
    { href: '/lights', icon: '◉', label: 'Lights' },
    { href: '/processes', icon: '⊞', label: 'Processes' },
    { href: '/tailscale', icon: '⊶', label: 'Tailscale' },
    { href: '/keeper', icon: '◈', label: 'Keeper' },
    { href: '/terminal', icon: '▶', label: 'Terminal' },
  ];
</script>

<svelte:head>
  <title>Dashboard | Home Server</title>
</svelte:head>

<h2>Dashboard</h2>

<!-- System Stats Row -->
<div class="stats-row">
  <div class="stat-card">
    <div class="stat-header">Memory</div>
    <div class="stat-value" style="color: {memColor}">{system.memUsedPercent}%</div>
    <div class="stat-bar">
      <div class="stat-fill" style="width: {system.memUsedPercent}%; background: {memColor}"></div>
    </div>
    <div class="stat-detail">{system.memTotal} GB total</div>
  </div>

  <div class="stat-card">
    <div class="stat-header">CPU Load</div>
    <div class="stat-value" style="color: {loadColor()}">{system.loadAvg}</div>
    <div class="stat-bar">
      <div
        class="stat-fill"
        style="width: {Math.min(100, (system.loadAvg / system.cpuCount) * 100)}%; background: {loadColor()}"
      ></div>
    </div>
    <div class="stat-detail">{system.cpuCount} cores</div>
  </div>

  <div class="stat-card">
    <div class="stat-header">Uptime</div>
    <div class="stat-value">{system.uptime}h</div>
    <div class="stat-detail">{Math.floor(system.uptime / 24)}d {system.uptime % 24}h</div>
  </div>

  {#each dashboard.disk as d}
    <div class="stat-card">
      <div class="stat-header">Disk <code>{d.mount}</code></div>
      <div
        class="stat-value"
        style="color: {parseInt(d.usePercent) > 90
          ? 'var(--danger)'
          : parseInt(d.usePercent) > 70
            ? 'var(--warning)'
            : 'var(--success)'}"
      >
        {d.usePercent}
      </div>
      <div class="stat-bar">
        <div
          class="stat-fill"
          style="width: {d.usePercent}; background: {parseInt(d.usePercent) > 90
            ? 'var(--danger)'
            : parseInt(d.usePercent) > 70
              ? 'var(--warning)'
              : 'var(--success)'}"
        ></div>
      </div>
      <div class="stat-detail">{d.used} / {d.total}</div>
    </div>
  {/each}
</div>

<!-- Status Cards -->
<div class="status-grid">
  <a href="/tasks" class="status-card">
    <div class="status-icon">⚙</div>
    <div class="status-body">
      <h3>Tasks</h3>
      <div class="status-metrics">
        {#if dashboard.tasks.running > 0}
          <span class="metric running">{dashboard.tasks.running} running</span>
        {/if}
        {#if dashboard.tasks.failed > 0}
          <span class="metric failed">{dashboard.tasks.failed} failed</span>
        {/if}
        <span class="metric">{dashboard.tasks.scheduled} scheduled</span>
        <span class="metric muted">{dashboard.tasks.total} total</span>
      </div>
    </div>
  </a>

  <a href="/backups" class="status-card">
    <div class="status-icon">⟲</div>
    <div class="status-body">
      <h3>Backups</h3>
      <div class="status-metrics">
        <span class="metric muted">{dashboard.backups.total} configs</span>
        {#if dashboard.backups.lastRun}
          <span
            class="metric"
            class:success={dashboard.backups.lastRun.status === 'success'}
            class:failed={dashboard.backups.lastRun.status === 'failed'}
          >
            {dashboard.backups.lastRun.name}: {dashboard.backups.lastRun.status}
          </span>
          <span class="metric muted">{formatRelativeTime(dashboard.backups.lastRun.time)}</span>
        {:else}
          <span class="metric muted">No runs yet</span>
        {/if}
      </div>
    </div>
  </a>

  <a href="/keeper" class="status-card">
    <div class="status-icon">◈</div>
    <div class="status-body">
      <h3>Keeper</h3>
      <div class="status-metrics">
        {#if dashboard.keeper['in-progress']}
          <span class="metric running">{dashboard.keeper['in-progress']} in progress</span>
        {/if}
        {#if dashboard.keeper.ready}
          <span class="metric accent">{dashboard.keeper.ready} ready</span>
        {/if}
        {#if dashboard.keeper.backlog}
          <span class="metric muted">{dashboard.keeper.backlog} backlog</span>
        {/if}
        {#if dashboard.keeper.done}
          <span class="metric success">{dashboard.keeper.done} done</span>
        {/if}
      </div>
    </div>
  </a>
</div>

<!-- Quick Nav -->
<h3 class="section-title">Quick Access</h3>
<div class="nav-grid">
  {#each widgets as w}
    <a href={w.href} class="nav-card">
      <span class="nav-icon">{w.icon}</span>
      <span>{w.label}</span>
    </a>
  {/each}
</div>

<style>
  h2 {
    font-size: 1.3rem;
    margin-bottom: 16px;
  }
  h3 {
    font-size: 1rem;
  }
  .section-title {
    margin: 20px 0 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* System Stats */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .stat-header {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  .stat-header code {
    font-size: 0.65rem;
    text-transform: none;
    letter-spacing: 0;
  }

  .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.2;
  }

  .stat-bar {
    height: 4px;
    background: var(--border-subtle);
    border-radius: 2px;
    margin: 8px 0 6px;
    overflow: hidden;
  }

  .stat-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .stat-detail {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Status Cards */
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    margin-bottom: 8px;
  }

  .status-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .status-card:hover {
    border-color: var(--accent);
  }

  .status-icon {
    font-size: 1.3rem;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .status-body {
    flex: 1;
    min-width: 0;
  }
  .status-body h3 {
    font-size: 0.9rem;
    margin-bottom: 6px;
  }

  .status-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .metric {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .metric.muted {
    color: var(--text-faint);
  }
  .metric.running {
    color: var(--warning);
  }
  .metric.failed {
    color: var(--danger);
  }
  .metric.success {
    color: var(--success);
  }
  .metric.accent {
    color: var(--accent);
  }

  /* Quick Nav */
  .nav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  .nav-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    text-decoration: none;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .nav-card:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .nav-icon {
    font-size: 1.1rem;
  }

  @media (max-width: 640px) {
    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }
    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
