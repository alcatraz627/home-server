<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';

  type ActivityModule = 'note' | 'kanban' | 'reminder' | 'bookmark' | 'keeper';
  type ActivityAction = 'create' | 'update' | 'delete' | 'complete' | 'archive';

  interface ActivityEvent {
    id: string;
    type: ActivityAction;
    module: ActivityModule;
    itemId: string;
    itemTitle: string;
    details?: string;
    timestamp: string;
  }

  const MODULE_ICONS: Record<ActivityModule, string> = {
    note: 'file-text',
    kanban: 'trello',
    bookmark: 'bookmark',
    reminder: 'bell',
    keeper: 'star',
  };

  const MODULE_LABELS: Record<ActivityModule, string> = {
    note: 'Notes',
    kanban: 'Kanban',
    bookmark: 'Bookmarks',
    reminder: 'Reminders',
    keeper: 'Keeper',
  };

  const MODULE_HREFS: Record<ActivityModule, string> = {
    note: '/notes',
    kanban: '/kanban',
    bookmark: '/bookmarks',
    reminder: '/reminders',
    keeper: '/keeper',
  };

  const ACTION_ICONS: Record<ActivityAction, string> = {
    create: 'plus',
    update: 'pencil',
    delete: 'trash-2',
    complete: 'check-circle',
    archive: 'archive',
  };

  const ACTION_LABELS: Record<ActivityAction, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    complete: 'Completed',
    archive: 'Archived',
  };

  interface Suggestion {
    id: string;
    type: 'overdue' | 'stale' | 'stuck' | 'dead-link';
    module: 'kanban' | 'reminder' | 'note' | 'bookmark';
    title: string;
    detail: string;
    href: string;
  }

  const SUGGESTION_TYPE_ICONS: Record<Suggestion['type'], string> = {
    overdue: 'alert-triangle',
    stuck: 'clock',
    stale: 'archive',
    'dead-link': 'link',
  };
  const SUGGESTION_TYPE_COLORS: Record<Suggestion['type'], string> = {
    overdue: 'var(--danger)',
    stuck: 'var(--warning, #f59e0b)',
    stale: 'var(--text-muted)',
    'dead-link': 'var(--text-muted)',
  };

  let suggestions = $state<Suggestion[]>([]);
  let suggestionsOpen = $state(false);

  async function loadSuggestions() {
    try {
      const res = await fetchApi('/api/suggestions');
      if (res.ok) suggestions = await res.json();
    } catch {
      // non-fatal — suggestions are optional
    }
  }

  let events = $state<ActivityEvent[]>([]);
  let loading = $state(true);
  let error = $state('');
  let moduleFilter = $state<ActivityModule | ''>('');
  let search = $state('');

  const MODULES: { value: ActivityModule | ''; label: string }[] = [
    { value: '', label: 'All modules' },
    { value: 'note', label: 'Notes' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'bookmark', label: 'Bookmarks' },
    { value: 'reminder', label: 'Reminders' },
    { value: 'keeper', label: 'Keeper' },
  ];

  async function load() {
    try {
      const params = moduleFilter ? `?module=${moduleFilter}` : '';
      const res = await fetchApi(`/api/activity${params}`);
      if (!res.ok) throw new Error('Failed to load activity');
      events = await res.json();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  const autoRefresh = createAutoRefresh(load, 30000);

  onMount(() => {
    load();
    loadSuggestions();
    autoRefresh.restart();
  });

  $effect(() => {
    moduleFilter; // re-fetch when filter changes
    load();
  });

  let filtered = $derived.by(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e) => e.itemTitle.toLowerCase().includes(q) || (e.details ?? '').toLowerCase().includes(q));
  });

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function groupByDate(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
    const groups: Map<string, ActivityEvent[]> = new Map();
    for (const e of events) {
      const d = new Date(e.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      let label: string;
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(e);
    }
    return [...groups.entries()].map(([label, events]) => ({ label, events }));
  }

  let groups = $derived(groupByDate(filtered));
</script>

<svelte:head>
  <title>Activity | Home Server</title>
</svelte:head>

<PageHeader title="Activity" icon="activity" description="Recent changes across your productivity modules.">
  {#snippet titleExtra()}
    {#if suggestions.length > 0}
      <button class="suggestions-badge" onclick={() => (suggestionsOpen = !suggestionsOpen)} title="Smart suggestions">
        <Icon name="alert-triangle" size={11} />
        {suggestions.length}
      </button>
    {/if}
  {/snippet}
  {#snippet children()}
    <button class="refresh-btn" onclick={load} title="Refresh">
      <Icon name="refresh-cw" size={14} />
    </button>
  {/snippet}
</PageHeader>

<!-- Smart Suggestions panel -->
{#if suggestions.length > 0 && suggestionsOpen}
  <div class="suggestions-panel">
    <div class="suggestions-header">
      <Icon name="alert-triangle" size={13} />
      Smart Suggestions
      <span class="suggestions-count">{suggestions.length}</span>
      <button class="suggestions-close" onclick={() => (suggestionsOpen = false)}>
        <Icon name="close" size={12} />
      </button>
    </div>
    <div class="suggestions-list">
      {#each suggestions as s (s.id)}
        <a class="suggestion-row" href={s.href} style="--sc:{SUGGESTION_TYPE_COLORS[s.type]}">
          <Icon name={SUGGESTION_TYPE_ICONS[s.type]} size={12} />
          <span class="suggestion-title">{s.title}</span>
          <span class="suggestion-detail">{s.detail}</span>
          <span class="suggestion-module">{s.module}</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

<FilterBar search bind:searchValue={search} searchPlaceholder="Search activity...">
  <select class="module-select" bind:value={moduleFilter}>
    {#each MODULES as m}
      <option value={m.value}>{m.label}</option>
    {/each}
  </select>
</FilterBar>

<AsyncState {loading} {error} empty={filtered.length === 0}>
  {#each groups as group}
    <div class="group">
      <div class="group-label">{group.label}</div>
      <div class="event-list">
        {#each group.events as event (event.id)}
          <div class="event-row" class:delete={event.type === 'delete'} class:complete={event.type === 'complete'}>
            <span class="action-icon action-{event.type}">
              <Icon name={ACTION_ICONS[event.type]} size={13} />
            </span>
            <span class="module-icon">
              <Icon name={MODULE_ICONS[event.module]} size={13} />
            </span>
            <span class="event-body">
              <span class="event-title">{event.itemTitle}</span>
              {#if event.details}
                <span class="event-details">{event.details}</span>
              {/if}
            </span>
            <a class="event-module" href={MODULE_HREFS[event.module]}>
              {MODULE_LABELS[event.module]}
            </a>
            <span class="event-action">{ACTION_LABELS[event.type]}</span>
            <span class="event-time" title={new Date(event.timestamp).toLocaleString()}>
              {relativeTime(event.timestamp)}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</AsyncState>

<style>
  .refresh-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 8px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    font-family: inherit;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .refresh-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .module-select {
    font-size: 0.8rem;
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    cursor: pointer;
  }

  .group {
    margin-bottom: 24px;
  }

  .group-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding-bottom: 6px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .event-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .event-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 0.8rem;
    transition: background 0.1s;
  }

  .event-row:hover {
    background: var(--bg-hover);
  }

  .event-row.delete .event-title {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .event-row.complete .event-title {
    color: var(--success);
  }

  .action-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: var(--text-faint);
  }

  .action-create {
    color: var(--success);
  }

  .action-delete {
    color: var(--danger);
  }

  .action-complete {
    color: var(--success);
  }

  .action-archive {
    color: var(--text-muted);
  }

  .module-icon {
    flex-shrink: 0;
    display: flex;
    color: var(--text-faint);
  }

  .event-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .event-title {
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }

  .event-details {
    font-size: 0.72rem;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .event-module {
    font-size: 0.7rem;
    color: var(--accent);
    text-decoration: none;
    flex-shrink: 0;
    padding: 1px 5px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    opacity: 0.7;
    transition: opacity 0.1s;
  }

  .event-module:hover {
    opacity: 1;
  }

  .event-action {
    font-size: 0.7rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .event-time {
    font-size: 0.68rem;
    color: var(--text-faint);
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    min-width: 56px;
    text-align: right;
  }

  @media (max-width: 600px) {
    .event-action,
    .event-module {
      display: none;
    }

    .event-title {
      max-width: 180px;
    }
  }

  /* ── Smart Suggestions ── */
  .suggestions-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    border: none;
    background: color-mix(in srgb, var(--warning, #f59e0b) 15%, transparent);
    color: var(--warning, #f59e0b);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }
  .suggestions-badge:hover {
    background: color-mix(in srgb, var(--warning, #f59e0b) 25%, transparent);
  }

  .suggestions-panel {
    background: var(--bg-secondary);
    border: 1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, var(--border));
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .suggestions-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--warning, #f59e0b);
    background: color-mix(in srgb, var(--warning, #f59e0b) 6%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--warning, #f59e0b) 15%, var(--border));
  }
  .suggestions-count {
    background: var(--warning, #f59e0b);
    color: white;
    border-radius: 8px;
    padding: 1px 6px;
    font-size: 0.65rem;
  }
  .suggestions-close {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 4px;
    transition: color 0.1s;
  }
  .suggestions-close:hover {
    color: var(--text-primary);
  }

  .suggestions-list {
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .suggestion-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.78rem;
    text-decoration: none;
    color: var(--sc);
    transition: background 0.1s;
  }
  .suggestion-row:hover {
    background: var(--bg-hover);
  }
  .suggestion-title {
    color: var(--text-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .suggestion-detail {
    font-size: 0.7rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .suggestion-module {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sc);
    opacity: 0.8;
    flex-shrink: 0;
  }
</style>
