<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';

  let { data } = $props<{ data: PageData }>();

  const MODULE_META: Record<string, { icon: string; label: string; href: string; color: string }> = {
    kanban: { icon: 'kanban', label: 'Kanban', href: '/kanban', color: 'var(--accent)' },
    reminder: { icon: 'bell', label: 'Reminders', href: '/reminders', color: 'var(--warning)' },
    note: { icon: 'file-text', label: 'Notes', href: '/notes', color: 'var(--success)' },
    bookmark: { icon: 'link', label: 'Bookmarks', href: '/bookmarks', color: 'var(--purple, #a855f7)' },
    keeper: { icon: 'bookmark', label: 'Keeper', href: '/keeper', color: 'var(--info, #3b82f6)' },
  };

  const QUICK_WORKFLOWS = [
    {
      label: 'New Task → Card',
      desc: 'Create a kanban card for a new task',
      icon: 'plus',
      href: '/kanban',
    },
    {
      label: 'Bookmark → Note',
      desc: 'Save a bookmark as a research note',
      icon: 'file-text',
      href: '/bookmarks',
    },
    {
      label: 'Feature → Card',
      desc: 'Turn a keeper request into a kanban card',
      icon: 'kanban',
      href: '/keeper',
    },
    {
      label: 'Set Reminder',
      desc: 'Quick reminder for any item',
      icon: 'bell',
      href: '/reminders',
    },
  ];

  function formatRelativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function actionIcon(type: string): string {
    switch (type) {
      case 'create':
        return 'plus';
      case 'update':
        return 'edit';
      case 'delete':
        return 'trash';
      case 'complete':
        return 'check';
      case 'archive':
        return 'archive';
      default:
        return 'activity';
    }
  }

  function actionColor(type: string): string {
    switch (type) {
      case 'create':
        return 'var(--success)';
      case 'delete':
        return 'var(--danger)';
      case 'complete':
        return 'var(--accent)';
      default:
        return 'var(--text-secondary)';
    }
  }
</script>

<div class="page">
  <PageHeader title="Workflows" icon="zap" description="Unified productivity hub — all tools, linked and connected.">
    <a href="/activity"><Button icon="activity">Activity Feed</Button></a>
  </PageHeader>

  <!-- ── Module Overview Cards ───────────────────────────────────────── -->
  <section class="module-grid">
    <a href="/kanban" class="module-card card-stagger" style="animation-delay: 0ms">
      <div
        class="module-icon"
        style="background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent)"
      >
        <Icon name="kanban" size={20} />
      </div>
      <div class="module-body">
        <h3>Kanban</h3>
        <div class="module-stats">
          <span class="stat">{data.kanban.doing} doing</span>
          <span class="stat">{data.kanban.todo} todo</span>
          <span class="stat success">{data.kanban.done} done</span>
          {#if data.kanban.overdue > 0}
            <span class="stat danger">{data.kanban.overdue} overdue</span>
          {/if}
        </div>
      </div>
      {#if data.links.byModule.kanban}
        <Badge variant="default">{data.links.byModule.kanban} links</Badge>
      {/if}
    </a>

    <a href="/reminders" class="module-card card-stagger" style="animation-delay: 40ms">
      <div
        class="module-icon"
        style="background: color-mix(in srgb, var(--warning) 12%, transparent); color: var(--warning)"
      >
        <Icon name="bell" size={20} />
      </div>
      <div class="module-body">
        <h3>Reminders</h3>
        <div class="module-stats">
          <span class="stat">{data.reminders.upcoming} upcoming</span>
          {#if data.reminders.overdue > 0}
            <span class="stat danger">{data.reminders.overdue} overdue</span>
          {/if}
          {#if data.reminders.snoozed > 0}
            <span class="stat muted">{data.reminders.snoozed} snoozed</span>
          {/if}
        </div>
      </div>
      {#if data.links.byModule.reminder}
        <Badge variant="default">{data.links.byModule.reminder} links</Badge>
      {/if}
    </a>

    <a href="/notes" class="module-card card-stagger" style="animation-delay: 80ms">
      <div
        class="module-icon"
        style="background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success)"
      >
        <Icon name="file-text" size={20} />
      </div>
      <div class="module-body">
        <h3>Notes</h3>
        <div class="module-stats">
          <span class="stat">{data.notes.total} notes</span>
          {#if data.notes.withChildren > 0}
            <span class="stat muted">{data.notes.withChildren} nested</span>
          {/if}
        </div>
      </div>
      {#if data.links.byModule.note}
        <Badge variant="default">{data.links.byModule.note} links</Badge>
      {/if}
    </a>

    <a href="/bookmarks" class="module-card card-stagger" style="animation-delay: 120ms">
      <div
        class="module-icon"
        style="background: color-mix(in srgb, var(--purple, #a855f7) 12%, transparent); color: var(--purple, #a855f7)"
      >
        <Icon name="link" size={20} />
      </div>
      <div class="module-body">
        <h3>Bookmarks</h3>
        <div class="module-stats">
          <span class="stat">{data.bookmarks.total} saved</span>
          {#if data.bookmarks.tags > 0}
            <span class="stat muted">{data.bookmarks.tags} tags</span>
          {/if}
        </div>
      </div>
      {#if data.links.byModule.bookmark}
        <Badge variant="default">{data.links.byModule.bookmark} links</Badge>
      {/if}
    </a>

    <a href="/keeper" class="module-card card-stagger" style="animation-delay: 160ms">
      <div
        class="module-icon"
        style="background: color-mix(in srgb, var(--info, #3b82f6) 12%, transparent); color: var(--info, #3b82f6)"
      >
        <Icon name="bookmark" size={20} />
      </div>
      <div class="module-body">
        <h3>Keeper</h3>
        <div class="module-stats">
          <span class="stat">{data.keeper.open} open</span>
          <span class="stat success">{data.keeper.done} done</span>
        </div>
      </div>
      {#if data.links.byModule.keeper}
        <Badge variant="default">{data.links.byModule.keeper} links</Badge>
      {/if}
    </a>
  </section>

  <!-- ── Stats Summary Row ───────────────────────────────────────────── -->
  <section class="stats-row">
    <div class="stat-chip">
      <Icon name="link" size={14} />
      <span>{data.links.total} cross-links</span>
    </div>
    <div class="stat-chip">
      <Icon name="activity" size={14} />
      <span>{data.activity.total} events this week</span>
    </div>
    <div class="stat-chip">
      <Icon name="bell" size={14} />
      <span>{data.notifications} unread notifications</span>
    </div>
  </section>

  <div class="two-col">
    <!-- ── Quick Workflows ─────────────────────────────────────────── -->
    <section class="card section-card">
      <h2><Icon name="zap" size={16} /> Quick Workflows</h2>
      <p class="section-desc">Common cross-module actions — click to start.</p>
      <div class="workflow-list">
        {#each QUICK_WORKFLOWS as wf, i}
          <a href={wf.href} class="workflow-item card-stagger" style="animation-delay: {i * 30}ms">
            <div class="wf-icon"><Icon name={wf.icon} size={16} /></div>
            <div class="wf-body">
              <span class="wf-label">{wf.label}</span>
              <span class="wf-desc">{wf.desc}</span>
            </div>
            <Icon name="arrow-right" size={14} />
          </a>
        {/each}
      </div>
    </section>

    <!-- ── Recent Activity ─────────────────────────────────────────── -->
    <section class="card section-card">
      <h2><Icon name="clock" size={16} /> Recent Activity</h2>
      <p class="section-desc">Last 7 days across all modules.</p>
      {#if data.activity.recent.length > 0}
        <div class="activity-list">
          {#each data.activity.recent as event, i}
            <div class="activity-item card-stagger" style="animation-delay: {i * 25}ms">
              <span class="act-dot" style="background: {actionColor(event.type)}"></span>
              <div class="act-body">
                <span class="act-title">
                  <Icon name={MODULE_META[event.module]?.icon ?? 'activity'} size={12} />
                  {event.itemTitle}
                </span>
                <span class="act-meta">
                  {event.type} · {MODULE_META[event.module]?.label ?? event.module} · {formatRelativeTime(
                    event.timestamp,
                  )}
                </span>
              </div>
            </div>
          {/each}
        </div>
        <a href="/activity" class="view-all">View all activity →</a>
      {:else}
        <p class="empty-hint">No activity in the last 7 days.</p>
      {/if}
    </section>
  </div>

  <!-- ── Activity by Module ──────────────────────────────────────────── -->
  <section class="card section-card">
    <h2><Icon name="bar-chart" size={16} /> Activity by Module (7 days)</h2>
    <div class="module-bars">
      {#each Object.entries(MODULE_META) as [key, meta]}
        {@const count = data.activity.byModule[key] ?? 0}
        {@const maxCount = Math.max(1, ...(Object.values(data.activity.byModule) as number[]))}
        <div class="bar-row">
          <span class="bar-label">
            <Icon name={meta.icon} size={14} />
            {meta.label}
          </span>
          <div class="bar-track">
            <div class="bar-fill" style="width: {(count / maxCount) * 100}%; background: {meta.color}"></div>
          </div>
          <span class="bar-count">{count}</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Cross-Module Link Map ───────────────────────────────────────── -->
  <section class="card section-card">
    <h2><Icon name="link" size={16} /> Cross-Module Links</h2>
    <p class="section-desc">
      Items linked across productivity tools. Use the link button
      <Icon name="link" size={12} /> on any item to connect it.
    </p>
    {#if data.links.total > 0}
      <div class="link-summary">
        {#each Object.entries(data.links.byModule) as [mod, count]}
          <div class="link-chip">
            <Icon name={MODULE_META[mod]?.icon ?? 'link'} size={14} />
            <span>{MODULE_META[mod]?.label ?? mod}</span>
            <Badge variant="default">{count}</Badge>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty-hint">No cross-module links yet. Link items from their detail views.</p>
    {/if}
  </section>
</div>

<style>
  /* ── Module Grid ─────────────────────────────────────────────────── */
  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .module-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .module-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .module-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  .module-body {
    flex: 1;
    min-width: 0;
  }
  .module-body h3 {
    margin: 0 0 0.3rem;
    font-size: 0.95rem;
    color: var(--text-primary);
  }
  .module-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .stat {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .stat.success {
    color: var(--success);
  }
  .stat.danger {
    color: var(--danger);
  }
  .stat.muted {
    color: var(--text-muted);
  }

  /* ── Stats Row ───────────────────────────────────────────────────── */
  .stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .stat-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border-radius: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  /* ── Two Column Layout ───────────────────────────────────────────── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  @media (max-width: 768px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }

  /* ── Section Cards ───────────────────────────────────────────────── */
  .section-card {
    padding: 1.25rem;
  }
  .section-card h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.3rem;
    font-size: 1rem;
    color: var(--text-primary);
  }
  .section-desc {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .empty-hint {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    padding: 1.5rem 0;
  }

  /* ── Quick Workflows ─────────────────────────────────────────────── */
  .workflow-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .workflow-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-primary);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .workflow-item:hover {
    border-color: var(--accent);
    background: var(--bg-secondary);
  }
  .wf-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }
  .wf-body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .wf-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .wf-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* ── Activity List ───────────────────────────────────────────────── */
  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 340px;
    overflow-y: auto;
  }
  .activity-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem 0;
  }
  .act-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
  }
  .act-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .act-title {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .act-meta {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .view-all {
    display: block;
    margin-top: 0.75rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--accent);
    text-decoration: none;
  }
  .view-all:hover {
    text-decoration: underline;
  }

  /* ── Module Bars ─────────────────────────────────────────────────── */
  .module-bars {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .bar-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--bg-secondary);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
    min-width: 2px;
    transition: width 0.3s ease;
  }
  .bar-count {
    width: 30px;
    text-align: right;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* ── Link Summary ────────────────────────────────────────────────── */
  .link-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .link-chip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    border-radius: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
</style>
