<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { CalendarItem } from '../api/calendar/+server';

  const MODULE_COLORS: Record<string, string> = {
    kanban: 'var(--accent)',
    reminder: 'var(--warning, #f59e0b)',
  };

  const MODULE_ICONS: Record<string, string> = {
    kanban: 'kanban',
    reminder: 'bell',
  };

  let today = new Date();
  let viewYear = $state(today.getFullYear());
  let viewMonth = $state(today.getMonth()); // 0-based
  let viewMode = $state<'month' | 'week' | 'list'>('month');
  let items = $state<CalendarItem[]>([]);
  let loading = $state(false);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }

  function monthRange(year: number, month: number): { from: string; to: string } {
    const from = `${year}-${pad(month + 1)}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad(month + 1)}-${pad(last)}`;
    return { from, to };
  }

  function weekRange(d: Date): { from: string; to: string } {
    const day = d.getDay();
    const sun = new Date(d);
    sun.setDate(d.getDate() - day);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    const fmt = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    return { from: fmt(sun), to: fmt(sat) };
  }

  // The "anchor" date for week view
  let weekAnchor = $state(new Date(today));

  async function load() {
    loading = true;
    try {
      let range: { from: string; to: string };
      if (viewMode === 'month') range = monthRange(viewYear, viewMonth);
      else if (viewMode === 'week') range = weekRange(weekAnchor);
      else range = monthRange(viewYear, viewMonth); // list uses same month range
      const res = await fetchApi(`/api/calendar?from=${range.from}&to=${range.to}`);
      if (!res.ok) throw new Error();
      items = await res.json();
    } catch {
      toast.error('Failed to load calendar');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // re-load when view params change
    void viewMode;
    void viewYear;
    void viewMonth;
    void weekAnchor;
    load();
  });

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear--;
    } else {
      viewMonth--;
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear++;
    } else {
      viewMonth++;
    }
  }

  function prevWeek() {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() - 7);
    weekAnchor = d;
  }

  function nextWeek() {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + 7);
    weekAnchor = d;
  }

  function goToday() {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    weekAnchor = new Date(t);
  }

  function isToday(dateStr: string): boolean {
    return dateStr === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }

  // Build month grid: array of 6 rows × 7 days
  let monthGrid = $derived.by(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  });

  // Build week grid: 7 days starting from weekAnchor's Sunday
  let weekDays = $derived.by(() => {
    const { from } = weekRange(weekAnchor);
    const days: string[] = [];
    const start = new Date(from + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    return days;
  });

  function itemsForDate(date: string): CalendarItem[] {
    return items.filter((i) => i.date === date);
  }

  // List view: group items by date
  let groupedItems = $derived.by(() => {
    const groups = new Map<string, CalendarItem[]>();
    for (const item of items) {
      if (!groups.has(item.date)) groups.set(item.date, []);
      groups.get(item.date)!.push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  function formatListDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    if (dateStr === todayStr) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yd = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    if (dateStr === yd) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  let totalItems = $derived(items.length);
</script>

<svelte:head>
  <title>Calendar | Home Server</title>
</svelte:head>

<PageHeader title="Calendar" icon="calendar" description="Dated items across kanban and reminders.">
  {#snippet titleExtra()}
    <span class="total-badge">{totalItems}</span>
  {/snippet}
  {#snippet children()}
    <div class="view-toggle">
      <button class="view-btn" class:active={viewMode === 'month'} onclick={() => (viewMode = 'month')} title="Month">
        <Icon name="calendar" size={13} />
      </button>
      <button class="view-btn" class:active={viewMode === 'week'} onclick={() => (viewMode = 'week')} title="Week">
        <Icon name="columns-3" size={13} />
      </button>
      <button class="view-btn" class:active={viewMode === 'list'} onclick={() => (viewMode = 'list')} title="List">
        <Icon name="list" size={13} />
      </button>
    </div>
    <button class="today-btn" onclick={goToday}>Today</button>
  {/snippet}
</PageHeader>

<!-- Nav bar -->
<div class="cal-nav">
  <button class="nav-arrow" onclick={viewMode === 'week' ? prevWeek : prevMonth}>
    <Icon name="chevron-left" size={16} />
  </button>
  <span class="cal-title">
    {#if viewMode === 'week'}
      {@const { from, to } = weekRange(weekAnchor)}
      {new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –
      {new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
    {:else}
      {MONTHS[viewMonth]} {viewYear}
    {/if}
  </span>
  <button class="nav-arrow" onclick={viewMode === 'week' ? nextWeek : nextMonth}>
    <Icon name="chevron-right" size={16} />
  </button>
  {#if loading}
    <span class="loading-dot"></span>
  {/if}
</div>

<!-- Month view -->
{#if viewMode === 'month'}
  <div class="month-grid">
    <div class="month-header">
      {#each DAYS as day}
        <div class="day-label">{day}</div>
      {/each}
    </div>
    {#each monthGrid as row}
      <div class="month-row">
        {#each row as date}
          <div class="month-cell" class:today={date ? isToday(date) : false} class:empty={!date}>
            {#if date}
              <div class="cell-date">{parseInt(date.slice(8))}</div>
              <div class="cell-items">
                {#each itemsForDate(date) as item (item.id)}
                  <a class="cal-item" href={item.href} style="border-left: 3px solid {MODULE_COLORS[item.module]}">
                    {#if item.time}
                      <span class="item-time">{item.time}</span>
                    {/if}
                    <span class="item-title">{item.title}</span>
                    {#if item.meta}
                      <span class="item-meta">{item.meta}</span>
                    {/if}
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Week view -->
{:else if viewMode === 'week'}
  <div class="week-grid">
    {#each weekDays as date, i}
      <div class="week-col" class:today={isToday(date)}>
        <div class="week-col-header">
          <span class="week-day">{DAYS[i]}</span>
          <span class="week-date" class:today-num={isToday(date)}>{parseInt(date.slice(8))}</span>
        </div>
        <div class="week-col-items">
          {#each itemsForDate(date) as item (item.id)}
            <a class="cal-item" href={item.href} style="border-left: 3px solid {MODULE_COLORS[item.module]}">
              {#if item.time}
                <span class="item-time">{item.time}</span>
              {/if}
              <span class="item-title">{item.title}</span>
              {#if item.meta}
                <span class="item-meta">{item.meta}</span>
              {/if}
            </a>
          {/each}
          {#if itemsForDate(date).length === 0}
            <div class="week-empty"></div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- List view -->
{:else if viewMode === 'list'}
  {#if groupedItems.length === 0}
    <div class="list-empty">No items this month.</div>
  {:else}
    <div class="list-view">
      {#each groupedItems as [date, dayItems]}
        <div class="list-day">
          <div class="list-day-header" class:today={isToday(date)}>
            {formatListDate(date)}
          </div>
          {#each dayItems as item (item.id)}
            <a class="list-item" href={item.href} style="border-left: 3px solid {MODULE_COLORS[item.module]}">
              <Icon name={MODULE_ICONS[item.module]} size={12} />
              {#if item.time}
                <span class="item-time">{item.time}</span>
              {/if}
              <span class="item-title">{item.title}</span>
              {#if item.meta}
                <span class="item-meta">{item.meta}</span>
              {/if}
            </a>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .total-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .view-btn {
    background: none;
    border: none;
    padding: 5px 9px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    font-family: inherit;
    transition:
      background 0.1s,
      color 0.1s;
  }

  .view-btn:not(:last-child) {
    border-right: 1px solid var(--border);
  }

  .view-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .view-btn.active {
    background: var(--accent);
    color: white;
  }

  .today-btn {
    font-size: 0.78rem;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition:
      border-color 0.1s,
      color 0.1s;
  }

  .today-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ── Nav bar ── */
  .cal-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .nav-arrow {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 7px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    font-family: inherit;
    transition:
      border-color 0.1s,
      color 0.1s;
  }

  .nav-arrow:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .cal-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 180px;
    text-align: center;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1s ease infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }

  /* ── Month view ── */
  .month-grid {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .month-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .day-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    text-align: center;
    padding: 8px 0;
  }

  .month-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--border);
  }

  .month-row:last-child {
    border-bottom: none;
  }

  .month-cell {
    min-height: 90px;
    padding: 6px;
    border-right: 1px solid var(--border-subtle);
    vertical-align: top;
  }

  .month-cell:last-child {
    border-right: none;
  }

  .month-cell.empty {
    background: var(--bg-secondary);
    opacity: 0.4;
  }

  .month-cell.today {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }

  .cell-date {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .month-cell.today .cell-date {
    color: var(--accent);
  }

  .cell-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Week view ── */
  .week-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }

  @media (max-width: 700px) {
    .week-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .week-col {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    min-height: 120px;
  }

  .week-col.today {
    border-color: var(--accent);
  }

  .week-col-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border);
  }

  .week-day {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .week-date {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .week-date.today-num {
    color: white;
    background: var(--accent);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
  }

  .week-col-items {
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .week-empty {
    min-height: 40px;
  }

  /* ── Shared cal-item ── */
  .cal-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 5px;
    border-radius: 4px;
    font-size: 0.7rem;
    background: var(--bg-hover);
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.1s;
    overflow: hidden;
  }

  .cal-item:hover {
    background: var(--bg-secondary);
    filter: brightness(1.05);
  }

  .item-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .item-meta {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--danger);
    flex-shrink: 0;
  }

  /* ── List view ── */
  .list-empty {
    color: var(--text-faint);
    font-size: 0.82rem;
    padding: 20px 0;
  }

  .list-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .list-day-header {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }

  .list-day-header.today {
    color: var(--accent);
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-left-width: 3px;
    text-decoration: none;
    color: var(--text-primary);
    margin-bottom: 3px;
    transition: background 0.1s;
  }

  .list-item:hover {
    background: var(--bg-hover);
  }
</style>
