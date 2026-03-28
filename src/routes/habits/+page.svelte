<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import type { Habit, HabitLog } from '$lib/server/habits';

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  let habits = $state<Habit[]>([]);
  let logs = $state<HabitLog[]>([]);
  let loading = $state(true);
  let error = $state('');

  // New habit form
  let showForm = $state(false);
  let newName = $state('');
  let newDesc = $state('');
  let newColor = $state(COLORS[3]);
  let saving = $state(false);

  // Selected habit for heatmap
  let selectedId = $state<string | null>(null);
  let selectedHabit = $derived(habits.find((h) => h.id === selectedId) ?? null);

  const pad = (n: number) => String(n).padStart(2, '0');

  function todayStr(): string {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }

  const today = todayStr();

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await fetchApi('/api/habits');
      if (!res.ok) throw new Error();
      const data = await res.json();
      habits = data.habits;
      logs = data.logs;
      if (!selectedId && habits.length > 0) selectedId = habits[0].id;
    } catch {
      error = 'Failed to load habits';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // ── Heatmap logic ──────────────────────────────────────────────────────────

  /** Build a 52-week (365 day) grid. Returns array of week-columns, each 7 days. */
  let heatmapGrid = $derived.by(() => {
    if (!selectedId) return [];

    // Set of dates logged for this habit
    const loggedDates = new Set(logs.filter((l) => l.habitId === selectedId).map((l) => l.date));

    // Start from the Sunday 52 weeks before today
    const end = new Date(today + 'T12:00:00');
    const start = new Date(end);
    start.setDate(end.getDate() - 364);
    // Rewind to previous Sunday
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: string; logged: boolean; future: boolean }[][] = [];
    const cur = new Date(start);

    while (cur <= end) {
      const week: { date: string; logged: boolean; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        week.push({ date: ds, logged: loggedDates.has(ds), future: ds > today });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  });

  // ── Streak computation ─────────────────────────────────────────────────────

  let streak = $derived.by(() => {
    if (!selectedId) return 0;
    const loggedDates = new Set(logs.filter((l) => l.habitId === selectedId).map((l) => l.date));
    let count = 0;
    const cur = new Date(today + 'T12:00:00');
    // If today is not logged, streak starts from yesterday
    if (!loggedDates.has(today)) cur.setDate(cur.getDate() - 1);
    while (true) {
      const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      if (!loggedDates.has(ds)) break;
      count++;
      cur.setDate(cur.getDate() - 1);
    }
    return count;
  });

  let totalLogged = $derived(selectedId ? logs.filter((l) => l.habitId === selectedId).length : 0);

  // ── Daily checklist ────────────────────────────────────────────────────────

  function isDoneToday(habitId: string): boolean {
    return logs.some((l) => l.habitId === habitId && l.date === today);
  }

  async function toggle(habit: Habit) {
    const done = isDoneToday(habit.id);
    const method = done ? 'DELETE' : 'POST';
    const res = await fetchApi(`/api/habits/${habit.id}/log`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today }),
    });
    if (!res.ok) {
      toast.error('Failed to update habit');
      return;
    }
    if (done) {
      logs = logs.filter((l) => !(l.habitId === habit.id && l.date === today));
    } else {
      logs = [...logs, { habitId: habit.id, date: today }];
    }
  }

  // ── Create habit ───────────────────────────────────────────────────────────

  async function createHabit() {
    if (!newName.trim()) return;
    saving = true;
    try {
      const res = await fetchApi('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc, color: newColor }),
      });
      if (!res.ok) throw new Error();
      const habit = await res.json();
      habits = [...habits, habit];
      selectedId = habit.id;
      newName = '';
      newDesc = '';
      newColor = COLORS[3];
      showForm = false;
    } catch {
      toast.error('Failed to create habit');
    } finally {
      saving = false;
    }
  }

  // ── Delete habit ───────────────────────────────────────────────────────────

  let deleteConfirm = $state<string | null>(null);

  async function deleteHabit(id: string) {
    const res = await fetchApi('/api/habits', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error('Failed to delete');
      return;
    }
    habits = habits.filter((h) => h.id !== id);
    logs = logs.filter((l) => l.habitId !== id);
    if (selectedId === id) selectedId = habits[0]?.id ?? null;
    deleteConfirm = null;
  }

  // ── Month labels for heatmap ───────────────────────────────────────────────

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let monthLabels = $derived.by(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    heatmapGrid.forEach((week, i) => {
      const month = new Date(week[0].date + 'T12:00:00').getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTH_ABBR[month], col: i });
        lastMonth = month;
      }
    });
    return labels;
  });

  const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
</script>

<svelte:head>
  <title>Habits | Home Server</title>
</svelte:head>

<PageHeader title="Habits" icon="activity" description="Daily habit tracker with streak history.">
  {#snippet titleExtra()}
    <span class="habit-count">{habits.length} habit{habits.length !== 1 ? 's' : ''}</span>
  {/snippet}
  {#snippet children()}
    <button class="add-btn" onclick={() => (showForm = !showForm)}>
      <Icon name="plus" size={13} />
      Add habit
    </button>
  {/snippet}
</PageHeader>

<!-- Add habit form -->
{#if showForm}
  <div class="add-form">
    <div class="form-row">
      <input
        class="form-input"
        placeholder="Habit name"
        bind:value={newName}
        onkeydown={(e) => e.key === 'Enter' && createHabit()}
      />
      <input class="form-input desc-input" placeholder="Description (optional)" bind:value={newDesc} />
      <div class="color-row">
        {#each COLORS as c}
          <button
            class="color-dot"
            class:selected={newColor === c}
            style="background:{c}"
            onclick={() => (newColor = c)}
            aria-label={c}
          ></button>
        {/each}
      </div>
      <button class="save-btn" onclick={createHabit} disabled={saving || !newName.trim()}>
        {saving ? 'Saving…' : 'Add'}
      </button>
      <button class="cancel-btn" onclick={() => (showForm = false)}>Cancel</button>
    </div>
  </div>
{/if}

<AsyncState
  {loading}
  {error}
  empty={!loading && habits.length === 0}
  emptyIcon="flame"
  emptyTitle="No habits yet"
  emptyHint="Add a habit above to start tracking your daily streaks."
>
  <!-- Layout: sidebar + main -->
  <div class="habits-layout">
    <!-- Sidebar: habit list + today checklist -->
    <div class="sidebar">
      <div class="sidebar-section-label">
        Today — {new Date(today + 'T12:00:00').toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </div>
      <div class="habit-list">
        {#each habits as habit (habit.id)}
          {@const done = isDoneToday(habit.id)}
          <div class="habit-row" class:active={selectedId === habit.id}>
            <button
              class="check-btn"
              class:checked={done}
              style="--hc:{habit.color || '#22c55e'}"
              onclick={() => toggle(habit)}
              title={done ? 'Mark undone' : 'Mark done'}
            >
              {#if done}
                <Icon name="check" size={12} />
              {/if}
            </button>
            <button class="habit-name-btn" class:done onclick={() => (selectedId = habit.id)}>
              {habit.name}
            </button>
            {#if deleteConfirm === habit.id}
              <span class="del-confirm">
                Delete?
                <button class="del-yes" onclick={() => deleteHabit(habit.id)}>Yes</button>
                <button class="del-no" onclick={() => (deleteConfirm = null)}>No</button>
              </span>
            {:else}
              <button class="del-btn" onclick={() => (deleteConfirm = habit.id)} title="Delete habit">
                <Icon name="trash-2" size={12} />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Main: heatmap + stats for selected habit -->
    <div class="main-panel">
      {#if selectedHabit}
        <div class="habit-header">
          <span class="habit-color-dot" style="background:{selectedHabit.color || '#22c55e'}"></span>
          <span class="habit-title">{selectedHabit.name}</span>
          {#if selectedHabit.description}
            <span class="habit-desc">{selectedHabit.description}</span>
          {/if}
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-value">{streak}</div>
            <div class="stat-label">day streak</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">{totalLogged}</div>
            <div class="stat-label">total days</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">{isDoneToday(selectedHabit.id) ? '✓' : '—'}</div>
            <div class="stat-label">today</div>
          </div>
        </div>

        <!-- Heatmap -->
        <div class="heatmap-wrap">
          <!-- Month labels -->
          <div class="month-labels" style="grid-template-columns: 24px repeat({heatmapGrid.length}, 1fr)">
            <div></div>
            <!-- spacer for day labels -->
            {#each heatmapGrid as _, i}
              {@const found = monthLabels.find((m) => m.col === i)}
              <div class="month-label">{found ? found.label : ''}</div>
            {/each}
          </div>

          <div class="heatmap-body">
            <!-- Day labels -->
            <div class="day-labels">
              {#each DAYS_SHORT as d, i}
                <div class="day-label" class:show={i % 2 === 1}>{i % 2 === 1 ? d : ''}</div>
              {/each}
            </div>

            <!-- Grid -->
            <div class="heatmap-grid" style="grid-template-columns: repeat({heatmapGrid.length}, 1fr)">
              {#each heatmapGrid as week}
                <div class="heatmap-col">
                  {#each week as cell}
                    <div
                      class="heatmap-cell"
                      class:logged={cell.logged}
                      class:future={cell.future}
                      class:is-today={cell.date === today}
                      style={cell.logged ? `background:${selectedHabit.color || '#22c55e'}` : ''}
                      title={cell.date}
                    ></div>
                  {/each}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="heatmap-legend">
          <span class="legend-label">Less</span>
          <div class="legend-cell" style="background:var(--bg-hover)"></div>
          <div
            class="legend-cell"
            style="background:color-mix(in srgb, {selectedHabit.color || '#22c55e'} 30%, transparent)"
          ></div>
          <div
            class="legend-cell"
            style="background:color-mix(in srgb, {selectedHabit.color || '#22c55e'} 60%, transparent)"
          ></div>
          <div class="legend-cell" style="background:{selectedHabit.color || '#22c55e'}"></div>
          <span class="legend-label">More</span>
        </div>
      {/if}
    </div>
  </div>
</AsyncState>

<style>
  .habit-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 5px;
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
  .add-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ── Add form ── */
  .add-form {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .form-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .form-input {
    flex: 1;
    min-width: 140px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.82rem;
    font-family: inherit;
  }
  .form-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .desc-input {
    flex: 1.5;
  }
  .color-row {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .color-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition:
      border-color 0.1s,
      transform 0.1s;
  }
  .color-dot.selected {
    border-color: var(--text-primary);
    transform: scale(1.2);
  }
  .save-btn {
    padding: 6px 14px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    font-family: inherit;
  }
  .save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .cancel-btn {
    padding: 6px 10px;
    background: none;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    font-family: inherit;
  }

  /* ── Layout ── */
  .habits-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 20px;
    align-items: start;
  }

  @media (max-width: 700px) {
    .habits-layout {
      grid-template-columns: 1fr;
    }
  }

  /* ── Sidebar ── */
  .sidebar {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .sidebar-section-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 8px 12px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border);
  }
  .habit-list {
    padding: 4px;
  }
  .habit-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .habit-row:hover {
    background: var(--bg-hover);
  }
  .habit-row.active {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .check-btn {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 2px solid var(--hc);
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .check-btn.checked {
    background: var(--hc);
  }

  .habit-name-btn {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    font-size: 0.8rem;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: color 0.1s;
  }
  .habit-name-btn.done {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .del-btn {
    opacity: 0;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    transition:
      color 0.1s,
      opacity 0.1s;
  }
  .habit-row:hover .del-btn {
    opacity: 1;
  }
  .del-btn:hover {
    color: var(--danger);
  }

  .del-confirm {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: var(--danger);
  }
  .del-yes,
  .del-no {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
    padding: 0 3px;
  }
  .del-yes {
    color: var(--danger);
    font-weight: 600;
  }
  .del-no {
    color: var(--text-muted);
  }

  /* ── Main panel ── */
  .main-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }

  .habit-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .habit-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .habit-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .habit-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  /* ── Stats ── */
  .stats-row {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  .stat-box {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    text-align: center;
    min-width: 70px;
  }
  .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  .stat-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }

  /* ── Heatmap ── */
  .heatmap-wrap {
    overflow-x: auto;
  }
  .month-labels {
    display: grid;
    margin-bottom: 2px;
    padding-left: 0;
  }
  .month-label {
    font-size: 0.62rem;
    color: var(--text-faint);
    text-align: left;
  }
  .heatmap-body {
    display: flex;
    gap: 3px;
  }
  .day-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 0;
  }
  .day-label {
    width: 18px;
    height: 11px;
    font-size: 0.58rem;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 3px;
  }
  .heatmap-grid {
    display: grid;
    gap: 2px;
  }
  .heatmap-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .heatmap-cell {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: var(--bg-hover);
    transition: background 0.1s;
    cursor: default;
  }
  .heatmap-cell.logged {
    opacity: 0.9;
  }
  .heatmap-cell.future {
    opacity: 0.25;
  }
  .heatmap-cell.is-today {
    outline: 1.5px solid var(--text-muted);
    outline-offset: 1px;
  }

  /* ── Legend ── */
  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 8px;
    justify-content: flex-end;
  }
  .legend-label {
    font-size: 0.62rem;
    color: var(--text-faint);
    margin: 0 3px;
  }
  .legend-cell {
    width: 11px;
    height: 11px;
    border-radius: 2px;
  }
</style>
