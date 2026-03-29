<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/toast';
  import { postJson } from '$lib/api';

  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import LinkedItems from '$lib/components/LinkedItems.svelte';
  import FilterQueryBar from '$lib/components/FilterQueryBar.svelte';
  import { parseFilterQuery, matchItem, type FilterNode } from '$lib/utils/filter-query';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import type { Reminder, ReminderPriority, Recurrence, RecurrencePattern } from '$lib/types/productivity';

  type Priority = ReminderPriority;

  const PRIORITIES: { value: Priority; label: string; icon: string; color: string }[] = [
    { value: 'urgent', label: 'Urgent', icon: 'alarm-clock', color: 'var(--danger)' },
    { value: 'high', label: 'High', icon: 'arrow-up', color: 'var(--warning)' },
    { value: 'normal', label: 'Normal', icon: 'bell', color: 'var(--accent)' },
    { value: 'low', label: 'Low', icon: 'arrow-down', color: 'var(--text-faint)' },
  ];

  let { data } = $props<{ data: PageData }>();
  let reminders = $state<Reminder[]>([]);
  $effect(() => {
    reminders = data.reminders ?? [];
  });

  // Form state
  let showForm = $state(false);
  let formTitle = $state('');
  let formDescription = $state('');
  let formDate = $state('');
  let formTime = $state('');
  let formPriority = $state<Priority>('normal');
  let formChannelBrowser = $state(true);
  let formChannelNtfy = $state(false);
  let formRecurring = $state(false);
  let formRecurrencePattern = $state<RecurrencePattern>('daily');
  let formRecurrenceInterval = $state(1);
  let formRecurrenceEndDate = $state('');

  // Notification permission state
  let notifPermission = $state<NotificationPermission>('default');
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let now = $state(Date.now());

  // Filter
  let filter = $state<'upcoming' | 'fired' | 'snoozed' | 'all'>('upcoming');

  // Filter Query Language
  let filterQuery = $state('');
  let parsedFilter = $derived<FilterNode | null>(parseFilterQuery(filterQuery));

  /** Map reminder priority to P1/P2/P3 for FQL compatibility */
  function reminderToFilterable(r: Reminder) {
    const pMap: Record<string, string> = { urgent: 'P1', high: 'P2', normal: 'P3', low: 'P3' };
    return {
      title: r.title,
      description: r.description,
      priority: pMap[r.priority] || '',
      dueDate: r.datetime,
      tags: [] as string[],
    };
  }

  let filtered = $derived(
    reminders
      .filter((r) => {
        if (filter === 'upcoming') return !r.fired;
        if (filter === 'fired') return r.fired && !r.snoozedUntil;
        if (filter === 'snoozed') return !!r.snoozedUntil && !r.fired;
        return true;
      })
      .filter((r) => matchItem(parsedFilter, reminderToFilterable(r)))
      .sort((a, b) => {
        // Overdue items first, then by datetime
        const aOverdue = isOverdue(a) ? 0 : 1;
        const bOverdue = isOverdue(b) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      }),
  );

  let stats = $derived({
    upcoming: reminders.filter((r) => !r.fired).length,
    fired: reminders.filter((r) => r.fired && !r.snoozedUntil).length,
    snoozed: reminders.filter((r) => !!r.snoozedUntil && !r.fired).length,
    overdue: reminders.filter((r) => isOverdue(r)).length,
  });

  let cleanupShortcuts: (() => void) | undefined;

  onMount(() => {
    if ('Notification' in window) {
      notifPermission = Notification.permission;
    }
    pollTimer = setInterval(pollPending, 15_000);
    pollPending();
    // Tick every 30s to update relative times
    tickTimer = setInterval(() => (now = Date.now()), 30_000);

    cleanupShortcuts = useShortcuts([
      {
        ...SHORTCUT_DEFAULTS.find((d) => d.id === 'reminders:new')!,
        handler: () => (showForm = true),
      },
      {
        ...SHORTCUT_DEFAULTS.find((d) => d.id === 'reminders:focus-search')!,
        handler: () => {
          const el = document.querySelector<HTMLInputElement>('.fq-input');
          el?.focus();
        },
      },
    ]);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    cleanupShortcuts?.();
  });

  async function requestPermission() {
    if (!('Notification' in window)) {
      toast.error('Browser does not support notifications');
      return;
    }
    const perm = await Notification.requestPermission();
    notifPermission = perm;
    if (perm === 'granted') {
      toast.success('Notifications enabled');
    } else if (perm === 'denied') {
      toast.error('Notifications blocked — enable in browser settings');
    }
  }

  async function pollPending() {
    try {
      const res = await fetch('/api/reminders?pending=1');
      if (!res.ok) return;
      const { pending } = await res.json();
      for (const r of pending as Reminder[]) {
        showBrowserNotification(r);
        reminders = reminders.map((existing) => (existing.id === r.id ? { ...existing, fired: true } : existing));
      }
    } catch {
      // Silently ignore poll failures
    }
  }

  function showBrowserNotification(r: Reminder) {
    if (notifPermission !== 'granted') return;
    try {
      new Notification(`⏰ ${r.title}`, {
        body: r.description || 'Reminder is due',
        icon: '/icons/icon-192.png',
        tag: `reminder-${r.id}`,
      });
    } catch {
      // SW notifications not available
    }
  }

  function resetForm() {
    formTitle = '';
    formDescription = '';
    formDate = '';
    formTime = '';
    formPriority = 'normal';
    formChannelBrowser = true;
    formChannelNtfy = false;
    formRecurring = false;
    formRecurrencePattern = 'daily';
    formRecurrenceInterval = 1;
    formRecurrenceEndDate = '';
    showForm = false;
  }

  // Quick preset helpers — offset in seconds for sub-minute, minutes for the rest
  function applyQuickSeconds(seconds: number) {
    const target = new Date(Date.now() + seconds * 1000);
    formDate = target.toISOString().slice(0, 10);
    formTime = target.toTimeString().slice(0, 5);
  }

  function applyQuickPreset(offsetMinutes: number) {
    const target = new Date(Date.now() + offsetMinutes * 60_000);
    formDate = target.toISOString().slice(0, 10);
    formTime = target.toTimeString().slice(0, 5);
  }

  function applyTomorrowPreset(hour: number) {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(hour, 0, 0, 0);
    formDate = target.toISOString().slice(0, 10);
    formTime = target.toTimeString().slice(0, 5);
  }

  function applyWeekendPreset() {
    const target = new Date();
    const day = target.getDay();
    const daysToSat = day === 0 ? 6 : 6 - day;
    target.setDate(target.getDate() + (daysToSat || 7));
    target.setHours(10, 0, 0, 0);
    formDate = target.toISOString().slice(0, 10);
    formTime = target.toTimeString().slice(0, 5);
  }

  function applyMondayPreset() {
    const target = new Date();
    const day = target.getDay();
    const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    target.setDate(target.getDate() + daysToMon);
    target.setHours(9, 0, 0, 0);
    formDate = target.toISOString().slice(0, 10);
    formTime = target.toTimeString().slice(0, 5);
  }

  async function createReminder() {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formDate || !formTime) {
      toast.error('Date and time are required');
      return;
    }
    const datetime = new Date(`${formDate}T${formTime}`).toISOString();
    const channels: ('browser' | 'ntfy')[] = [];
    if (formChannelBrowser) channels.push('browser');
    if (formChannelNtfy) channels.push('ntfy');

    const recurrence: Recurrence | null = formRecurring
      ? {
          pattern: formRecurrencePattern,
          interval: formRecurrenceInterval > 1 ? formRecurrenceInterval : undefined,
          endDate: formRecurrenceEndDate || undefined,
        }
      : null;

    try {
      const res = await postJson('/api/reminders', {
        title: formTitle.trim(),
        description: formDescription.trim(),
        datetime,
        channels,
        priority: formPriority,
        recurrence,
      });
      if (!res.ok) throw new Error();
      const reminder = await res.json();
      reminders = [...reminders, reminder];
      resetForm();
      toast.success('Reminder created');
    } catch {
      toast.error('Failed to create reminder');
    }
  }

  async function deleteReminder(id: string) {
    try {
      const res = await postJson('/api/reminders', { _action: 'delete', id });
      if (!res.ok) throw new Error();
      reminders = reminders.filter((r) => r.id !== id);
      toast.success('Reminder deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function refireReminder(id: string) {
    try {
      const res = await postJson('/api/reminders', { _action: 'update', id, fired: false });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      reminders = reminders.map((r) => (r.id === updated.id ? updated : r));
      toast.success('Reminder re-armed');
    } catch {
      toast.error('Failed to re-arm');
    }
  }

  let snoozeOpenId = $state<string | null>(null);

  function getSnoozePresets(): { label: string; icon: string; minutes: number }[] {
    const hour = new Date().getHours();
    const presets: { label: string; icon: string; minutes: number }[] = [
      { label: '5 min', icon: 'timer', minutes: 5 },
      { label: '15 min', icon: 'timer', minutes: 15 },
      { label: '30 min', icon: 'clock', minutes: 30 },
      { label: '1 hour', icon: 'clock', minutes: 60 },
      { label: '3 hours', icon: 'clock', minutes: 180 },
    ];
    if (hour < 12) {
      presets.push({ label: 'This afternoon', icon: 'sun', minutes: minutesUntilHour(14) });
    }
    if (hour < 17) {
      presets.push({ label: 'This evening', icon: 'moon', minutes: minutesUntilHour(18) });
    }
    if (hour < 21) {
      presets.push({ label: 'Tonight', icon: 'moon', minutes: minutesUntilHour(21) });
    }
    presets.push({ label: 'Tomorrow 9am', icon: 'calendar', minutes: minutesUntilTomorrow(9) });
    presets.push({ label: 'Next Monday', icon: 'calendar', minutes: minutesUntilNextMonday() });
    return presets.filter((p) => p.minutes > 0);
  }

  function minutesUntilHour(targetHour: number): number {
    const n = new Date();
    const target = new Date(n);
    target.setHours(targetHour, 0, 0, 0);
    return Math.max(0, Math.round((target.getTime() - n.getTime()) / 60_000));
  }

  function minutesUntilTomorrow(hour: number): number {
    const n = new Date();
    const target = new Date(n);
    target.setDate(target.getDate() + 1);
    target.setHours(hour, 0, 0, 0);
    return Math.round((target.getTime() - n.getTime()) / 60_000);
  }

  function minutesUntilNextMonday(): number {
    const n = new Date();
    const day = n.getDay();
    const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const target = new Date(n);
    target.setDate(target.getDate() + daysToMon);
    target.setHours(9, 0, 0, 0);
    return Math.round((target.getTime() - n.getTime()) / 60_000);
  }

  async function snoozeReminder(id: string, minutes: number) {
    snoozeOpenId = null;
    try {
      const res = await postJson('/api/reminders', { _action: 'snooze', id, minutes });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      reminders = reminders.map((r) => (r.id === updated.id ? updated : r));
      const label =
        minutes < 60
          ? `${minutes}m`
          : minutes < 1440
            ? `${Math.round(minutes / 60)}h`
            : `${Math.round(minutes / 1440)}d`;
      toast.success(`Snoozed for ${label}`);
    } catch {
      toast.error('Failed to snooze');
    }
  }

  function formatDatetime(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function isOverdue(r: Reminder): boolean {
    return !r.fired && new Date(r.datetime) < new Date();
  }

  function timeUntil(iso: string): string {
    const diff = new Date(iso).getTime() - now;
    if (diff < 0) {
      const ago = Math.abs(diff);
      const mins = Math.floor(ago / 60_000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'under 1m';
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }

  function priorityColor(p: Priority | undefined): string {
    return PRIORITIES.find((x) => x.value === (p ?? 'normal'))?.color ?? 'var(--accent)';
  }

  function priorityIcon(p: Priority | undefined): string {
    return PRIORITIES.find((x) => x.value === (p ?? 'normal'))?.icon ?? 'bell';
  }

  function handleClickOutsideSnooze(e: MouseEvent) {
    if (snoozeOpenId && !(e.target as HTMLElement).closest('.snooze-wrapper')) {
      snoozeOpenId = null;
    }
  }
</script>

<svelte:head>
  <title>Reminders | Home Server</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" onclick={handleClickOutsideSnooze}>
  <PageHeader title="Reminders" description="Timed alerts with browser push and ntfy.sh notifications." icon="bell">
    {#snippet titleExtra()}
      {#if stats.overdue > 0}
        <span class="overdue-badge">{stats.overdue} overdue</span>
      {/if}
    {/snippet}
    {#snippet children()}
      <button class="btn-primary" onclick={() => (showForm = !showForm)}>
        <Icon name="plus" size={16} />
        New
      </button>
    {/snippet}
  </PageHeader>

  <ErrorBoundary title="Reminders encountered an error" compact>
    {#if notifPermission !== 'granted'}
      <div class="permission-banner">
        <Icon name="bell-off" size={16} />
        <span>Browser notifications {notifPermission === 'denied' ? 'blocked' : 'not enabled'}.</span>
        {#if notifPermission === 'default'}
          <button class="btn-sm btn-accent" onclick={requestPermission}>
            <Icon name="bell" size={12} /> Enable
          </button>
        {:else}
          <span class="hint">Change in browser settings.</span>
        {/if}
      </div>
    {/if}

    {#if showForm}
      <div class="card form-card">
        <div class="form-header">
          <Icon name="plus" size={16} />
          <span>New Reminder</span>
        </div>

        <div class="form-grid">
          <input
            type="text"
            bind:value={formTitle}
            placeholder="What do you need to remember?"
            class="form-input title-input"
            onkeydown={(e) => e.key === 'Enter' && createReminder()}
          />

          <textarea bind:value={formDescription} placeholder="Notes (optional)" rows="2" class="form-input"></textarea>

          <!-- Quick presets grouped by category -->
          <div class="form-field">
            <label><Icon name="speed" size={11} /> Quick set</label>
            <div class="preset-groups">
              <div class="preset-group">
                <span class="preset-group-label">Test</span>
                <button type="button" class="preset-pill" onclick={() => applyQuickSeconds(5)}>5s</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickSeconds(30)}>30s</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(1)}>1m</button>
              </div>
              <div class="preset-group">
                <span class="preset-group-label">Soon</span>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(5)}>5m</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(15)}>15m</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(30)}>30m</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(60)}>1h</button>
                <button type="button" class="preset-pill" onclick={() => applyQuickPreset(180)}>3h</button>
              </div>
              <div class="preset-group">
                <span class="preset-group-label">Later</span>
                <button type="button" class="preset-pill" onclick={() => applyTomorrowPreset(9)}>Tomorrow 9am</button>
                <button type="button" class="preset-pill" onclick={() => applyTomorrowPreset(14)}>Tomorrow 2pm</button>
                <button type="button" class="preset-pill" onclick={() => applyWeekendPreset()}>Weekend</button>
                <button type="button" class="preset-pill" onclick={() => applyMondayPreset()}>Next Mon</button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label><Icon name="calendar" size={11} /> Date</label>
              <input type="date" bind:value={formDate} class="form-input" />
            </div>
            <div class="form-field">
              <label><Icon name="clock" size={11} /> Time</label>
              <input type="time" bind:value={formTime} class="form-input" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label><Icon name="arrow-up" size={11} /> Priority</label>
              <div class="priority-row">
                {#each PRIORITIES as p}
                  <button
                    type="button"
                    class="priority-chip"
                    class:selected={formPriority === p.value}
                    style="--chip-color: {p.color}"
                    onclick={() => (formPriority = p.value)}
                  >
                    <Icon name={p.icon} size={12} />
                    {p.label}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div class="form-field">
            <label><Icon name="send" size={11} /> Notify via</label>
            <div class="channel-row">
              <label class="channel-check">
                <input type="checkbox" bind:checked={formChannelBrowser} />
                <Icon name="monitor" size={14} />
                Browser
              </label>
              <label class="channel-check">
                <input type="checkbox" bind:checked={formChannelNtfy} />
                <Icon name="send" size={14} />
                ntfy.sh
              </label>
            </div>
          </div>

          <div class="form-field">
            <label class="recurrence-toggle">
              <input type="checkbox" bind:checked={formRecurring} />
              <Icon name="repeat" size={12} />
              Repeat
            </label>
            {#if formRecurring}
              <div class="recurrence-config">
                <div class="recurrence-row">
                  <span class="recurrence-label">Every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    bind:value={formRecurrenceInterval}
                    class="recurrence-interval"
                  />
                  <select bind:value={formRecurrencePattern} class="recurrence-select">
                    <option value="daily">{formRecurrenceInterval > 1 ? 'days' : 'day'}</option>
                    <option value="weekly">{formRecurrenceInterval > 1 ? 'weeks' : 'week'}</option>
                    <option value="monthly">{formRecurrenceInterval > 1 ? 'months' : 'month'}</option>
                    <option value="weekdays">weekday{formRecurrenceInterval > 1 ? 's' : ''}</option>
                    <option value="custom">{formRecurrenceInterval > 1 ? 'days (custom)' : 'day (custom)'}</option>
                  </select>
                </div>
                <div class="recurrence-row">
                  <span class="recurrence-label">Until</span>
                  <input type="date" bind:value={formRecurrenceEndDate} class="form-input recurrence-end" />
                  <span class="recurrence-hint">(optional — blank = forever)</span>
                </div>
              </div>
            {/if}
          </div>

          <div class="form-actions">
            <button class="btn-primary btn-sm" onclick={createReminder}>
              <Icon name="bell" size={14} /> Create Reminder
            </button>
            <button class="btn-sm" onclick={resetForm}>Cancel</button>
          </div>
        </div>
      </div>
    {/if}

    <div class="filter-row">
      {#each [{ key: 'upcoming', label: 'Upcoming', icon: 'clock', count: stats.upcoming }, { key: 'snoozed', label: 'Snoozed', icon: 'pause', count: stats.snoozed }, { key: 'fired', label: 'Fired', icon: 'check', count: stats.fired }, { key: 'all', label: 'All', icon: 'list', count: reminders.length }] as tab}
        <button
          class="filter-btn"
          class:active={filter === tab.key}
          onclick={() => (filter = tab.key as typeof filter)}
        >
          <Icon name={tab.icon} size={12} />
          {tab.label}
          <span class="filter-count">{tab.count}</span>
        </button>
      {/each}
    </div>

    <FilterQueryBar
      bind:query={filterQuery}
      placeholder="Filter: p1, overdue, today, or combine with & |"
      matchCount={parsedFilter ? filtered.length : null}
      storageKey="hs:reminders-saved-filters"
    />

    {#if filtered.length === 0}
      <div class="empty">
        <Icon name="bell-off" size={40} />
        <p>No {filter === 'all' ? '' : filter} reminders</p>
        {#if filter === 'upcoming'}
          <button class="btn-sm btn-accent" onclick={() => (showForm = true)}>
            <Icon name="plus" size={14} /> Create one
          </button>
        {/if}
      </div>
    {:else}
      <div class="reminder-list">
        {#each filtered as r (r.id)}
          <div
            class="card reminder-card"
            class:fired={r.fired}
            class:overdue={isOverdue(r)}
            style="--priority-color: {priorityColor(r.priority)}"
          >
            <div class="priority-stripe"></div>
            <div class="reminder-icon">
              <Icon name={r.fired ? 'check' : isOverdue(r) ? 'alarm-clock' : priorityIcon(r.priority)} size={18} />
            </div>
            <div class="reminder-main">
              <div class="reminder-header">
                <span class="reminder-title">{r.title}</span>
                {#if r.fired}
                  <span class="badge badge-muted"><Icon name="check" size={10} /> Fired</span>
                {:else if isOverdue(r)}
                  <span class="badge badge-danger"><Icon name="alarm-clock" size={10} /> {timeUntil(r.datetime)}</span>
                {:else}
                  <span class="badge badge-accent"><Icon name="clock" size={10} /> {timeUntil(r.datetime)}</span>
                {/if}
              </div>
              {#if r.description}
                <p class="reminder-desc">{r.description}</p>
              {/if}
              <div class="reminder-meta">
                <span class="reminder-time">
                  <Icon name="calendar" size={11} />
                  {formatDatetime(r.datetime)}
                </span>
                {#if r.recurrence}
                  <span class="reminder-recurrence">
                    <Icon name="repeat" size={11} />
                    {r.recurrence.pattern === 'weekdays'
                      ? 'Weekdays'
                      : r.recurrence.interval && r.recurrence.interval > 1
                        ? `Every ${r.recurrence.interval} ${r.recurrence.pattern.replace('ly', '').replace('dai', 'day')}s`
                        : r.recurrence.pattern.charAt(0).toUpperCase() + r.recurrence.pattern.slice(1)}
                  </span>
                {/if}
                {#if r.snoozedUntil}
                  <span class="reminder-snoozed">
                    <Icon name="pause" size={11} />
                    Snoozed → {formatDatetime(r.snoozedUntil)}
                  </span>
                {/if}
                <span class="reminder-channels">
                  {#each r.channels as ch}
                    <span class="channel-chip">
                      <Icon name={ch === 'browser' ? 'monitor' : 'send'} size={10} />
                      {ch}
                    </span>
                  {/each}
                </span>
              </div>
              <LinkedItems itemType="reminder" itemId={r.id} />
            </div>
            <div class="reminder-actions">
              <div class="snooze-wrapper">
                <button
                  class="action-btn"
                  title="Snooze"
                  onclick={() => (snoozeOpenId = snoozeOpenId === r.id ? null : r.id)}
                >
                  <Icon name="clock" size={14} />
                </button>
                {#if snoozeOpenId === r.id}
                  <div class="snooze-dropdown">
                    <div class="snooze-header">Snooze for...</div>
                    {#each getSnoozePresets() as preset}
                      <button class="snooze-option" onclick={() => snoozeReminder(r.id, preset.minutes)}>
                        <Icon name={preset.icon} size={12} />
                        {preset.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              {#if r.fired}
                <button class="action-btn" title="Re-arm" onclick={() => refireReminder(r.id)}>
                  <Icon name="repeat" size={14} />
                </button>
              {/if}
              <button class="action-btn action-danger" title="Delete" onclick={() => deleteReminder(r.id)}>
                <Icon name="delete" size={14} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </ErrorBoundary>
</div>

<style>
  .overdue-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--danger);
    background: var(--danger-bg);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .permission-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--warning-bg);
    border: 1px solid var(--warning);
    border-radius: 8px;
    color: var(--warning);
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .permission-banner .hint {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  /* Form */
  .form-card {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .form-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .form-input {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-family: inherit;
  }

  .title-input {
    font-size: 0.95rem;
    font-weight: 500;
  }

  textarea.form-input {
    resize: vertical;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
  }

  .form-field label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Preset pills */
  .preset-groups {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preset-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }

  .preset-group-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 42px;
    flex-shrink: 0;
  }

  .preset-pill {
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 0.72rem;
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }

  .preset-pill:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  /* Priority selector */
  .priority-row {
    display: flex;
    gap: 6px;
  }

  .priority-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .priority-chip.selected {
    border-color: var(--chip-color);
    color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 10%, transparent);
  }

  .priority-chip:hover:not(.selected) {
    border-color: var(--chip-color);
    color: var(--chip-color);
  }

  .channel-row {
    display: flex;
    gap: 1rem;
  }

  .channel-check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  /* Filters */
  .filter-row {
    display: flex;
    gap: 4px;
    margin-bottom: 1rem;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .filter-count {
    font-size: 0.68rem;
    background: var(--bg-primary);
    padding: 0 5px;
    border-radius: 6px;
    color: var(--text-faint);
  }

  .filter-btn.active .filter-count {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  /* Empty state */
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-faint);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .empty p {
    font-size: 0.9rem;
    margin: 0;
  }

  /* Reminder cards */
  .reminder-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reminder-card {
    padding: 0.65rem 0.75rem 0.65rem 0;
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.15s,
      opacity 0.15s;
  }

  .priority-stripe {
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--priority-color);
    border-radius: 4px 0 0 4px;
  }

  .reminder-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--priority-color) 10%, transparent);
    color: var(--priority-color);
    flex-shrink: 0;
    margin-left: 0.75rem;
  }

  .reminder-card.fired {
    opacity: 0.55;
  }

  .reminder-card.fired:hover {
    opacity: 0.85;
  }

  .reminder-card.overdue {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 3%, var(--bg-secondary));
  }

  .reminder-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .reminder-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reminder-title {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.62rem;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge-accent {
    color: var(--accent);
    background: var(--accent-bg);
  }

  .badge-danger {
    color: var(--danger);
    background: var(--danger-bg);
  }

  .badge-muted {
    color: var(--text-muted);
    background: var(--bg-hover);
  }

  .reminder-desc {
    font-size: 0.76rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .reminder-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
  }

  .reminder-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .reminder-snoozed {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    color: var(--warning);
  }

  .reminder-channels {
    display: flex;
    gap: 6px;
  }

  .channel-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.65rem;
    color: var(--text-faint);
    background: var(--bg-hover);
    padding: 1px 6px;
    border-radius: 6px;
  }

  /* Actions */
  .reminder-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    align-items: flex-start;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  .action-btn.action-danger:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: var(--danger-bg);
  }

  .snooze-wrapper {
    position: relative;
  }

  .snooze-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px;
    min-width: 180px;
    z-index: 10;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
  }

  .snooze-header {
    padding: 6px 10px 4px;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .snooze-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.78rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .snooze-option:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Buttons */
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    padding: 0.4rem 0.8rem;
    font-size: 0.82rem;
  }

  .btn-sm {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .btn-sm.btn-accent {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* Recurrence */
  .recurrence-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    cursor: pointer;
    font-weight: 500;
  }

  .recurrence-config {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-hover);
    border-radius: 8px;
    margin-top: 4px;
  }

  .recurrence-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .recurrence-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    min-width: 40px;
  }

  .recurrence-interval {
    width: 52px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.82rem;
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
  }

  .recurrence-select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.82rem;
    cursor: pointer;
    font-family: inherit;
  }

  .recurrence-end {
    font-size: 0.8rem !important;
    padding: 4px 8px !important;
    flex: 0;
  }

  .recurrence-hint {
    font-size: 0.68rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .reminder-recurrence {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    color: var(--accent);
    background: var(--accent-bg);
    padding: 1px 7px;
    border-radius: 6px;
    font-weight: 500;
  }
</style>
