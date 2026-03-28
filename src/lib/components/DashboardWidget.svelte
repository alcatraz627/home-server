<script lang="ts">
  import type { WidgetInstance, WidgetSize } from '$lib/widgets/registry';
  import { getWidgetType } from '$lib/widgets/registry';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import { goto } from '$app/navigation';

  interface DashboardData {
    tasks: { total: number; running: number; failed: number; scheduled: number };
    backups: { total: number; lastRun: { name: string; status: string; time: string } | null };
    keeper: Record<string, number>;
    disk: { mount: string; usePercent: string; used: string; total: string; fstype?: string; device?: string }[];
    recentRuns: { name: string; status: string; time: string; duration?: number }[];
    topProcesses: { name: string; cpu: number; mem: number }[];
    notifications: number;
    notes: number;
    docker: { running: number; total: number };
    services: { healthy: number; total: number };
  }

  interface SystemData {
    memUsedPercent: number;
    memTotal: number;
    loadAvg: number;
    cpuCount: number;
    uptime: number;
  }

  let {
    widget,
    dashboard,
    system,
    starredFiles = [],
    navWidgets = [],
    onrefresh,
  }: {
    widget: WidgetInstance;
    dashboard: DashboardData;
    system: SystemData;
    starredFiles?: string[];
    navWidgets?: { href: string; icon: string; label: string }[];
    onrefresh?: () => void;
  } = $props();

  const typeDef = $derived(getWidgetType(widget.typeId));
  const size = $derived(widget.size);

  // ── Color helpers ──────────────────────────────────────────────────────────
  const memColor = $derived(
    system.memUsedPercent >= 90 ? 'var(--danger)' : system.memUsedPercent >= 70 ? 'var(--warning)' : 'var(--success)',
  );

  const loadColor = $derived.by(() => {
    const ratio = system.loadAvg / system.cpuCount;
    return ratio >= 0.9 ? 'var(--danger)' : ratio >= 0.7 ? 'var(--warning)' : 'var(--success)';
  });

  function diskUsagePercent(d: { usePercent: string }): number {
    return parseInt(d.usePercent) || 0;
  }

  function diskColor(pct: number): string {
    return pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)';
  }

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

{#if !typeDef}
  <div class="widget-error">Unknown widget: {widget.typeId}</div>
{:else if widget.typeId === 'system-stats'}
  <!-- ── System Stats ──────────────────────────────────────────────────── -->
  {#if size === 'small'}
    <div class="stats-compact">
      <div class="stat-compact-item">
        <span class="stat-compact-label">MEM</span>
        <span class="stat-compact-value" style="color: {memColor}">{system.memUsedPercent}%</span>
      </div>
      <div class="stat-compact-item">
        <span class="stat-compact-label">CPU</span>
        <span class="stat-compact-value" style="color: {loadColor}">{system.loadAvg}</span>
      </div>
      <div class="stat-compact-item">
        <span class="stat-compact-label">UP</span>
        <span class="stat-compact-value">{system.uptime}h</span>
      </div>
    </div>
  {:else if size === 'large'}
    <div class="stats-row">
      <div class="stat-card card-stagger" style="animation-delay: 0ms">
        <div class="stat-header">Memory</div>
        <div class="stat-value" style="color: {memColor}">{system.memUsedPercent}%</div>
        <div class="stat-bar">
          <div class="stat-fill" style="width: {system.memUsedPercent}%; background: {memColor}"></div>
        </div>
        <svg class="stat-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
          <rect
            x="0"
            y={20 - (system.memUsedPercent / 100) * 20}
            width="60"
            height={(system.memUsedPercent / 100) * 20}
            fill={memColor}
            opacity="0.2"
            rx="2"
          />
          <line
            x1="0"
            y1={20 - (system.memUsedPercent / 100) * 20}
            x2="60"
            y2={20 - (system.memUsedPercent / 100) * 20}
            stroke={memColor}
            stroke-width="1.5"
          />
        </svg>
        <div class="stat-detail">{system.memTotal} GB total</div>
      </div>
      <div class="stat-card card-stagger" style="animation-delay: 40ms">
        <div class="stat-header">CPU Load</div>
        <div class="stat-value" style="color: {loadColor}">{system.loadAvg}</div>
        <div class="stat-bar">
          <div
            class="stat-fill"
            style="width: {Math.min(100, (system.loadAvg / system.cpuCount) * 100)}%; background: {loadColor}"
          ></div>
        </div>
        <svg class="stat-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
          <rect
            x="0"
            y={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
            width="60"
            height={(Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
            fill={loadColor}
            opacity="0.2"
            rx="2"
          />
          <line
            x1="0"
            y1={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
            x2="60"
            y2={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
            stroke={loadColor}
            stroke-width="1.5"
          />
        </svg>
        <div class="stat-detail">{system.cpuCount} cores</div>
      </div>
      <div class="stat-card card-stagger" style="animation-delay: 80ms">
        <div class="stat-header">Uptime</div>
        <div class="stat-value">{system.uptime}h</div>
        <div class="stat-detail">{Math.floor(system.uptime / 24)}d {system.uptime % 24}h</div>
      </div>
    </div>
  {:else}
    <div class="stats-row">
      <div class="stat-card card-stagger" style="animation-delay: 0ms">
        <div class="stat-header">Memory</div>
        <div class="stat-value" style="color: {memColor}">{system.memUsedPercent}%</div>
        <div class="stat-bar">
          <div class="stat-fill" style="width: {system.memUsedPercent}%; background: {memColor}"></div>
        </div>
        <div class="stat-detail">{system.memTotal} GB total</div>
      </div>
      <div class="stat-card card-stagger" style="animation-delay: 40ms">
        <div class="stat-header">CPU Load</div>
        <div class="stat-value" style="color: {loadColor}">{system.loadAvg}</div>
        <div class="stat-bar">
          <div
            class="stat-fill"
            style="width: {Math.min(100, (system.loadAvg / system.cpuCount) * 100)}%; background: {loadColor}"
          ></div>
        </div>
        <div class="stat-detail">{system.cpuCount} cores</div>
      </div>
      <div class="stat-card card-stagger" style="animation-delay: 80ms">
        <div class="stat-header">Uptime</div>
        <div class="stat-value">{system.uptime}h</div>
        <div class="stat-detail">{Math.floor(system.uptime / 24)}d {system.uptime % 24}h</div>
      </div>
    </div>
  {/if}
{:else if widget.typeId === 'disk'}
  <!-- ── Disk ──────────────────────────────────────────────────────────── -->
  {#if size === 'small'}
    <div class="stats-compact">
      {#each dashboard.disk as d}
        {@const pct = diskUsagePercent(d)}
        {@const color = diskColor(pct)}
        <div class="stat-compact-item">
          <span class="stat-compact-label">{d.mount}</span>
          <span class="stat-compact-value" style="color: {color}">{d.usePercent}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="stats-row">
      {#each dashboard.disk as d, i}
        {@const pct = diskUsagePercent(d)}
        {@const color = diskColor(pct)}
        <div class="stat-card card-stagger" style="animation-delay: {i * 40}ms">
          <div class="stat-header">Disk <code>{d.mount}</code></div>
          <div class="stat-value" style="color: {color}">{d.usePercent}</div>
          <div class="stat-bar"><div class="stat-fill" style="width: {d.usePercent}; background: {color}"></div></div>
          {#if size === 'large'}
            <svg class="disk-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
              <rect
                x="0"
                y={20 - (pct / 100) * 20}
                width="60"
                height={(pct / 100) * 20}
                fill={color}
                opacity="0.2"
                rx="2"
              />
              <line
                x1="0"
                y1={20 - (pct / 100) * 20}
                x2="60"
                y2={20 - (pct / 100) * 20}
                stroke={color}
                stroke-width="1.5"
              />
            </svg>
          {/if}
          <div class="stat-detail">
            {d.used} / {d.total}
            {#if d.fstype}<span class="disk-fstype">{d.fstype}</span>{/if}
          </div>
          {#if d.device}
            <div class="stat-device" title={d.device}>{d.device.split('/').pop()}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{:else if widget.typeId === 'tasks'}
  <!-- ── Tasks ─────────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/tasks" class="status-card card-stagger" style="animation-delay: 0ms">
      <div class="status-icon"><Icon name="settings" size={size === 'small' ? 14 : 18} /></div>
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
          {#if size !== 'small'}
            <span class="metric muted">{dashboard.tasks.total} total</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'backups'}
  <!-- ── Backups ───────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/backups" class="status-card card-stagger" style="animation-delay: 0ms">
      <div class="status-icon"><Icon name="rotate" size={size === 'small' ? 14 : 18} /></div>
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
              {#if size !== 'small'}{dashboard.backups.lastRun.name}:{/if}
              {dashboard.backups.lastRun.status}
            </span>
            {#if size !== 'small'}
              <span class="metric muted">{formatRelativeTime(dashboard.backups.lastRun.time)}</span>
            {/if}
          {:else}
            <span class="metric muted">No runs yet</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'keeper'}
  <!-- ── Keeper ────────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/keeper" class="status-card card-stagger" style="animation-delay: 0ms">
      <div class="status-icon"><Icon name="bookmark" size={size === 'small' ? 14 : 18} /></div>
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
          {#if size !== 'small' && dashboard.keeper.done}
            <span class="metric success">{dashboard.keeper.done} done</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'notifications'}
  <!-- ── Notifications ─────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/notifications" class="status-card card-stagger">
      <div class="status-icon"><Icon name="bell" size={size === 'small' ? 14 : 18} /></div>
      <div class="status-body">
        <h3>Notifications</h3>
        <div class="status-metrics">
          {#if dashboard.notifications > 0}
            <span class="metric accent">{dashboard.notifications} unread</span>
          {:else}
            <span class="metric muted">All caught up</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'notes'}
  <!-- ── Notes ─────────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/notes" class="status-card card-stagger">
      <div class="status-icon"><Icon name="file-text" size={size === 'small' ? 14 : 18} /></div>
      <div class="status-body">
        <h3>Notes</h3>
        <div class="status-metrics">
          <span class="metric">{dashboard.notes} note{dashboard.notes !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'docker'}
  <!-- ── Docker ────────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/docker" class="status-card card-stagger">
      <div class="status-icon"><Icon name="docker" size={size === 'small' ? 14 : 18} /></div>
      <div class="status-body">
        <h3>Docker</h3>
        <div class="status-metrics">
          {#if dashboard.docker.total > 0}
            <span class="metric success">{dashboard.docker.running} running</span>
            <span class="metric muted">{dashboard.docker.total} total</span>
          {:else}
            <span class="metric muted">No containers</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'services'}
  <!-- ── Services ──────────────────────────────────────────────────────── -->
  <div class="status-grid">
    <a href="/services" class="status-card card-stagger">
      <div class="status-icon"><Icon name="activity" size={size === 'small' ? 14 : 18} /></div>
      <div class="status-body">
        <h3>Services</h3>
        <div class="status-metrics">
          {#if dashboard.services.total > 0}
            <span class="metric success">{dashboard.services.healthy} healthy</span>
            <span class="metric muted">{dashboard.services.total} monitored</span>
          {:else}
            <span class="metric muted">None configured</span>
          {/if}
        </div>
      </div>
    </a>
  </div>
{:else if widget.typeId === 'activity-timeline'}
  <!-- ── Activity Timeline ─────────────────────────────────────────────── -->
  <div class="detail-card">
    <h3 class="section-title">Recent Activity</h3>
    {#if dashboard.recentRuns.length > 0}
      <div class="timeline">
        {#each size === 'small' ? dashboard.recentRuns.slice(0, 3) : dashboard.recentRuns as run}
          <div class="timeline-item">
            <span
              class="timeline-dot"
              style="background: {run.status === 'success'
                ? 'var(--success)'
                : run.status === 'failed' || run.status === 'timeout'
                  ? 'var(--danger)'
                  : 'var(--warning)'}"
            ></span>
            <div class="timeline-content">
              <span class="timeline-name">{run.name}</span>
              <span class="timeline-meta">
                {run.status}
                {#if run.duration}
                  · {run.duration < 1000 ? run.duration + 'ms' : (run.duration / 1000).toFixed(1) + 's'}
                {/if}
                · {formatRelativeTime(run.time)}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="detail-empty">No recent task runs</p>
    {/if}
  </div>
{:else if widget.typeId === 'top-processes'}
  <!-- ── Top Processes ─────────────────────────────────────────────────── -->
  <div class="detail-card">
    <h3 class="section-title">Top Processes</h3>
    {#if dashboard.topProcesses.length > 0}
      <div class="top-procs">
        {#each size === 'small' ? dashboard.topProcesses.slice(0, 3) : dashboard.topProcesses as proc}
          <div class="proc-row">
            <span class="proc-name">{proc.name}</span>
            {#if size !== 'small'}
              <div class="proc-bars">
                <div class="proc-bar">
                  <div class="proc-fill proc-cpu" style="width: {Math.min(100, proc.cpu)}%"></div>
                </div>
                <div class="proc-bar">
                  <div class="proc-fill proc-mem" style="width: {Math.min(100, proc.mem)}%"></div>
                </div>
              </div>
            {/if}
            <span class="proc-vals">{proc.cpu.toFixed(1)}% · {proc.mem.toFixed(1)}%</span>
          </div>
        {/each}
        {#if size !== 'small'}
          <div class="proc-legend">
            <span><span class="legend-dot" style="background: var(--accent)"></span> CPU</span>
            <span><span class="legend-dot" style="background: var(--purple)"></span> MEM</span>
          </div>
        {/if}
      </div>
    {:else}
      <p class="detail-empty">No process data</p>
    {/if}
  </div>
{:else if widget.typeId === 'quick-nav'}
  <!-- ── Quick Nav ─────────────────────────────────────────────────────── -->
  <h3 class="section-title">Quick Access</h3>
  <div class="nav-grid">
    {#each navWidgets as w, i}
      <a href={w.href} class="nav-card card-stagger" style="animation-delay: {i * 40}ms">
        <span class="nav-icon"><Icon name={w.icon} size={18} /></span>
        <span>{w.label}</span>
      </a>
    {/each}
  </div>
{:else if widget.typeId === 'quick-actions'}
  <!-- ── Quick Actions ─────────────────────────────────────────────────── -->
  <div class="quick-actions">
    <Button
      size="sm"
      onclick={() => {
        goto('/lights');
      }}
    >
      <Icon name="search" size={12} /> Scan Lights
    </Button>
    <Button
      size="sm"
      onclick={() => {
        goto('/backups');
      }}
    >
      <Icon name="save" size={12} /> Run Backup
    </Button>
    <Button
      size="sm"
      onclick={() => {
        goto('/terminal');
      }}
    >
      <Icon name="terminal" size={12} /> New Terminal
    </Button>
    <Button size="sm" onclick={onrefresh}>
      <Icon name="refresh" size={12} /> Refresh Stats
    </Button>
  </div>
{:else if widget.typeId === 'starred-files'}
  <!-- ── Starred Files ─────────────────────────────────────────────────── -->
  {#if starredFiles.length > 0}
    <h3 class="section-title">Starred Files</h3>
    <div class="starred-files">
      {#each size === 'small' ? starredFiles.slice(0, 4) : starredFiles as filePath, i}
        <a
          href="/files?path={encodeURIComponent(filePath)}"
          class="starred-file card-stagger"
          style="animation-delay: {i * 30}ms"
          title={filePath}
        >
          <span class="starred-icon">★</span>
          <span class="starred-name">{filePath.split('/').pop()}</span>
          {#if size !== 'small'}
            <span class="starred-path">{filePath.split('/').slice(0, -1).join('/')}</span>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .widget-error {
    padding: 12px;
    color: var(--danger);
    font-size: 0.82rem;
    text-align: center;
  }

  /* ── Section title ───────────────────────────────────────────────────── */
  h3 {
    font-size: 1rem;
  }

  .section-title {
    margin: 0 0 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── Quick Actions ──────────────────────────────────────────────────── */
  .quick-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ── System Stats ───────────────────────────────────────────────────── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
    gap: 12px;
  }

  .stats-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .stat-compact-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .stat-compact-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .stat-compact-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
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
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .stat-sparkline,
  .disk-sparkline {
    width: 60px;
    height: 20px;
    margin: 4px 0 2px;
  }

  .disk-fstype {
    font-size: 0.55rem;
    color: var(--text-faint);
    background: var(--bg-inset);
    padding: 1px 3px;
    border-radius: 3px;
  }

  .stat-device {
    font-size: 0.55rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }

  /* ── Status Cards ───────────────────────────────────────────────────── */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
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

  /* ── Activity & Processes ───────────────────────────────────────────── */
  .detail-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .detail-empty {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-align: center;
    padding: 16px;
  }

  /* Timeline */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .timeline-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .timeline-name {
    font-size: 0.78rem;
    color: var(--text-primary);
  }

  .timeline-meta {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Top Processes */
  .top-procs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .proc-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .proc-name {
    font-size: 0.75rem;
    width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .proc-bars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .proc-bar {
    height: 3px;
    background: var(--border-subtle);
    border-radius: 2px;
    overflow: hidden;
  }

  .proc-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .proc-cpu {
    background: var(--accent);
  }

  .proc-mem {
    background: var(--purple);
  }

  .proc-vals {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .proc-legend {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 4px;
    font-size: 0.6rem;
    color: var(--text-faint);
  }

  .legend-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 3px;
    vertical-align: middle;
  }

  /* ── Quick Nav ──────────────────────────────────────────────────────── */
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

  /* ── Starred Files ──────────────────────────────────────────────────── */
  .starred-files {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .starred-file {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 0.8rem;
    transition:
      border-color 0.15s,
      color 0.15s;
    max-width: 280px;
    overflow: hidden;
  }

  .starred-file:hover {
    border-color: var(--purple);
    color: var(--text-primary);
  }

  .starred-icon {
    color: var(--purple);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .starred-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .starred-path {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: none;
  }

  @media (min-width: 640px) {
    .starred-path {
      display: inline;
      max-width: 120px;
    }
  }

  @media (max-width: 767px) {
    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
