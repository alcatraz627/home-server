<script lang="ts">
  import type { PageData } from './$types';
  import type { AppNotification, NotificationType, NotificationSource } from '$lib/server/notifications';
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  let notifications = $state<AppNotification[]>(data.notifications ?? []);
  // svelte-ignore state_referenced_locally
  let unreadCount = $state(data.unreadCount ?? 0);

  let search = $state('');
  let filterType = $state<string>('all');
  let filterSource = $state<string>('all');

  const TYPE_TABS = [
    { id: 'all', label: 'All' },
    { id: 'error', label: 'Errors' },
    { id: 'warning', label: 'Warnings' },
    { id: 'success', label: 'Success' },
    { id: 'info', label: 'Info' },
  ];

  const SOURCES: { id: string; label: string }[] = [
    { id: 'all', label: 'All Sources' },
    { id: 'service', label: 'Service' },
    { id: 'backup', label: 'Backup' },
    { id: 'task', label: 'Task' },
    { id: 'system', label: 'System' },
    { id: 'agent', label: 'Agent' },
  ];

  let filtered = $derived.by(() => {
    let list = notifications;
    if (filterType !== 'all') {
      list = list.filter((n) => n.type === filterType);
    }
    if (filterSource !== 'all') {
      list = list.filter((n) => n.source === filterSource);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
    }
    return list;
  });

  async function refresh() {
    try {
      const res = await fetchApi('/api/notifications');
      const data = await res.json();
      notifications = data.notifications;
      unreadCount = data.unreadCount;
    } catch {
      // silent
    }
  }

  async function markRead(id: string) {
    try {
      await fetchApi('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', id }),
      });
      const n = notifications.find((n) => n.id === id);
      if (n) {
        n.read = true;
        notifications = [...notifications];
        unreadCount = Math.max(0, unreadCount - 1);
      }
    } catch {
      toast.error('Failed to mark as read');
    }
  }

  async function markAllRead() {
    try {
      await fetchApi('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      notifications = notifications.map((n) => ({ ...n, read: true }));
      unreadCount = 0;
      toast.success('All marked as read');
    } catch {
      toast.error('Failed');
    }
  }

  async function clearAll() {
    try {
      await fetchApi('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAll' }),
      });
      notifications = [];
      unreadCount = 0;
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed');
    }
  }

  function typeBadgeVariant(type: NotificationType): 'success' | 'danger' | 'warning' | 'info' | 'default' {
    const map: Record<NotificationType, 'success' | 'danger' | 'warning' | 'info'> = {
      success: 'success',
      error: 'danger',
      warning: 'warning',
      info: 'info',
    };
    return map[type] ?? 'default';
  }

  function typeIcon(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      success: 'check',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };
    return map[type] ?? 'info';
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="page-title">
      <Icon name="info" size={20} />
      <h1>Notifications</h1>
      {#if unreadCount > 0}
        <Badge variant="danger" size="sm">{unreadCount}</Badge>
      {/if}
    </div>
    <div class="header-actions">
      <Button variant="ghost" size="sm" icon="refresh" onclick={refresh}>Refresh</Button>
      {#if unreadCount > 0}
        <Button variant="default" size="sm" icon="check" onclick={markAllRead}>Mark all read</Button>
      {/if}
      {#if notifications.length > 0}
        <Button variant="danger" size="sm" icon="delete" confirm confirmText="Clear all?" onclick={clearAll}>
          Clear all
        </Button>
      {/if}
    </div>
  </header>

  <div class="filters">
    <Tabs tabs={TYPE_TABS} bind:active={filterType} size="sm" />
    <div class="filter-row">
      <select class="source-select" bind:value={filterSource}>
        {#each SOURCES as src}
          <option value={src.id}>{src.label}</option>
        {/each}
      </select>
      <SearchInput bind:value={search} placeholder="Search notifications..." size="sm" />
    </div>
  </div>

  {#if filtered.length === 0}
    <EmptyState
      icon="info"
      title={notifications.length === 0 ? 'No notifications yet' : 'No matching notifications'}
      hint={notifications.length === 0
        ? 'Notifications from services, backups, and tasks will appear here.'
        : 'Try adjusting your filters.'}
    />
  {:else}
    <div class="notification-list">
      {#each filtered as n (n.id)}
        <div class="notification-item" class:unread={!n.read}>
          <div class="notif-icon-wrap">
            <Icon name={typeIcon(n.type)} size={16} class="notif-type-icon notif-type-{n.type}" />
          </div>
          <div class="notif-body">
            <div class="notif-header">
              <span class="notif-title">{n.title}</span>
              <div class="notif-meta">
                <Badge variant={typeBadgeVariant(n.type)} size="sm">{n.type}</Badge>
                <Badge variant="default" size="sm">{n.source}</Badge>
                <span class="notif-time">{formatTime(n.timestamp)}</span>
              </div>
            </div>
            <p class="notif-message">{n.message}</p>
          </div>
          {#if !n.read}
            <button class="mark-read-btn" onclick={() => markRead(n.id)} title="Mark as read">
              <Icon name="check" size={12} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .page-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-title h1 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .source-select {
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .source-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .notification-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: background 0.15s;
  }

  .notification-item.unread {
    border-left: 3px solid var(--accent);
    background: color-mix(in srgb, var(--accent-bg) 30%, var(--bg-secondary));
  }

  .notif-icon-wrap {
    padding-top: 2px;
    flex-shrink: 0;
  }

  :global(.notif-type-success) {
    color: var(--success) !important;
  }
  :global(.notif-type-error) {
    color: var(--danger) !important;
  }
  :global(.notif-type-warning) {
    color: var(--warning) !important;
  }
  :global(.notif-type-info) {
    color: var(--accent) !important;
  }

  .notif-body {
    flex: 1;
    min-width: 0;
  }

  .notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .notif-title {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .notif-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .notif-time {
    font-size: 0.68rem;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .notif-message {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .mark-read-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .mark-read-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  @media (max-width: 600px) {
    .filter-row {
      flex-direction: column;
      align-items: stretch;
    }
    .notif-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
