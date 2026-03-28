<script lang="ts">
  // ─── Types ───────────────────────────────────────────────────────────────────

  type Frequency = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

  interface Props {
    value: string | null;
    onchange: (value: string | null) => void;
  }

  // ─── Constants ───────────────────────────────────────────────────────────────

  const MINUTE_INTERVALS = [1, 5, 10, 15, 30] as const;

  const DAYS_OF_WEEK = [
    { label: 'Sunday', short: 'Sun', value: 0 },
    { label: 'Monday', short: 'Mon', value: 1 },
    { label: 'Tuesday', short: 'Tue', value: 2 },
    { label: 'Wednesday', short: 'Wed', value: 3 },
    { label: 'Thursday', short: 'Thu', value: 4 },
    { label: 'Friday', short: 'Fri', value: 5 },
    { label: 'Saturday', short: 'Sat', value: 6 },
  ];

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES_OF_HOUR = Array.from({ length: 60 }, (_, i) => i);
  const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

  // ─── Props & State ────────────────────────────────────────────────────────────

  let { value, onchange }: Props = $props();

  let enabled = $state(false);
  $effect(() => {
    enabled = value !== null;
  });
  let frequency = $state<Frequency>('daily');
  let minuteInterval = $state(5);
  let hourlyMinute = $state(0);
  let dailyHour = $state(8);
  let dailyMinute = $state(0);
  let weeklyDay = $state(0);
  let weeklyHour = $state(8);
  let weeklyMinute = $state(0);
  let monthlyDay = $state(1);
  let monthlyHour = $state(8);
  let monthlyMinute = $state(0);
  let customExpr = $state('* * * * *');

  // ─── Parse initial value ──────────────────────────────────────────────────────

  function parseInitialValue(expr: string | null) {
    if (!expr) return;
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
      frequency = 'custom';
      customExpr = expr;
      return;
    }
    const [min, hour, dom, , dow] = parts;

    if (min.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
      const interval = parseInt(min.slice(2));
      if (MINUTE_INTERVALS.includes(interval as (typeof MINUTE_INTERVALS)[number])) {
        frequency = 'minutes';
        minuteInterval = interval;
        return;
      }
    }
    if (min !== '*' && !min.includes('/') && !min.includes(',') && hour === '*' && dom === '*' && dow === '*') {
      frequency = 'hourly';
      hourlyMinute = parseInt(min);
      return;
    }
    if (min !== '*' && !min.includes('/') && hour !== '*' && !hour.includes('/') && dom === '*' && dow === '*') {
      frequency = 'daily';
      dailyHour = parseInt(hour);
      dailyMinute = parseInt(min);
      return;
    }
    if (
      min !== '*' &&
      !min.includes('/') &&
      hour !== '*' &&
      !hour.includes('/') &&
      dom === '*' &&
      dow !== '*' &&
      !dow.includes(',')
    ) {
      frequency = 'weekly';
      weeklyDay = parseInt(dow);
      weeklyHour = parseInt(hour);
      weeklyMinute = parseInt(min);
      return;
    }
    if (
      min !== '*' &&
      !min.includes('/') &&
      hour !== '*' &&
      !hour.includes('/') &&
      dom !== '*' &&
      !dom.includes(',') &&
      dow === '*'
    ) {
      frequency = 'monthly';
      monthlyDay = parseInt(dom);
      monthlyHour = parseInt(hour);
      monthlyMinute = parseInt(min);
      return;
    }
    frequency = 'custom';
    customExpr = expr;
  }

  $effect(() => {
    parseInitialValue(value);
  });

  // ─── Derived expression ───────────────────────────────────────────────────────

  let expression = $derived.by<string>(() => {
    switch (frequency) {
      case 'minutes':
        return `*/${minuteInterval} * * * *`;
      case 'hourly':
        return `${hourlyMinute} * * * *`;
      case 'daily':
        return `${dailyMinute} ${dailyHour} * * *`;
      case 'weekly':
        return `${weeklyMinute} ${weeklyHour} * * ${weeklyDay}`;
      case 'monthly':
        return `${monthlyMinute} ${monthlyHour} ${monthlyDay} * *`;
      case 'custom':
        return customExpr;
    }
  });

  // ─── Human-readable description ───────────────────────────────────────────────

  function pad2(n: number) {
    return String(n).padStart(2, '0');
  }

  function formatTime(h: number, m: number) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad2(m)} ${period}`;
  }

  let description = $derived.by<string>(() => {
    if (!enabled) return 'Disabled';
    switch (frequency) {
      case 'minutes':
        return minuteInterval === 1 ? 'Every minute' : `Every ${minuteInterval} minutes`;
      case 'hourly':
        return hourlyMinute === 0 ? 'Every hour, on the hour' : `Every hour at ${hourlyMinute} minutes past`;
      case 'daily':
        return `Daily at ${formatTime(dailyHour, dailyMinute)}`;
      case 'weekly': {
        const day = DAYS_OF_WEEK[weeklyDay]?.label ?? 'Sunday';
        return `Weekly on ${day} at ${formatTime(weeklyHour, weeklyMinute)}`;
      }
      case 'monthly':
        return `Monthly on day ${monthlyDay} at ${formatTime(monthlyHour, monthlyMinute)}`;
      case 'custom':
        return describeCustom(customExpr);
    }
  });

  function describeCustom(expr: string): string {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return 'Invalid cron expression';
    return `Custom: ${expr}`;
  }

  // ─── Next-run calculator ──────────────────────────────────────────────────────

  function getNextRuns(expr: string, count: number): Date[] {
    try {
      const parts = expr.trim().split(/\s+/);
      if (parts.length !== 5) return [];
      return computeNextRuns(parts, count);
    } catch {
      return [];
    }
  }

  function matchesCronField(value: number, field: string, min: number, max: number): boolean {
    if (field === '*') return true;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2));
      return value % step === 0;
    }
    const values = field.split(',').flatMap((part) => {
      if (part.includes('-')) {
        const [lo, hi] = part.split('-').map(Number);
        return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      }
      return [parseInt(part)];
    });
    return values.includes(value);
  }

  function computeNextRuns(parts: string[], count: number): Date[] {
    const [minF, hourF, domF, , dowF] = parts;
    const results: Date[] = [];
    const now = new Date();
    // Start one minute ahead
    const cursor = new Date(now);
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);

    const limit = 60 * 24 * 366; // max 1 year of minutes
    let iterations = 0;

    while (results.length < count && iterations < limit) {
      iterations++;
      const m = cursor.getMinutes();
      const h = cursor.getHours();
      const dom = cursor.getDate();
      const dow = cursor.getDay();

      if (
        matchesCronField(m, minF, 0, 59) &&
        matchesCronField(h, hourF, 0, 23) &&
        matchesCronField(dom, domF, 1, 31) &&
        matchesCronField(dow, dowF, 0, 6)
      ) {
        results.push(new Date(cursor));
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return results;
  }

  function formatRunDate(d: Date): string {
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const mins = Math.round(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    let relative = '';
    if (mins < 60) relative = `in ${mins}m`;
    else if (hours < 24) relative = `in ${hours}h ${mins % 60}m`;
    else relative = `in ${days}d`;

    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return `${d.toLocaleString(undefined, opts)} (${relative})`;
  }

  let nextRuns = $derived(enabled ? getNextRuns(expression, 3) : []);

  // ─── Emit changes ─────────────────────────────────────────────────────────────

  $effect(() => {
    const newValue = enabled ? expression : null;
    // Only call if different from current prop value
    if (newValue !== value) {
      onchange(newValue);
    }
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function isCustomValid(expr: string): boolean {
    const parts = expr.trim().split(/\s+/);
    return parts.length === 5;
  }
</script>

<div class="cron-builder">
  <!-- Header row: toggle + description -->
  <div class="cb-header">
    <label class="cb-toggle" title={enabled ? 'Disable schedule' : 'Enable schedule'}>
      <input type="checkbox" class="cb-toggle-input" bind:checked={enabled} />
      <span class="cb-toggle-track">
        <span class="cb-toggle-thumb"></span>
      </span>
      <span class="cb-toggle-label">{enabled ? 'Enabled' : 'Disabled'}</span>
    </label>

    {#if enabled}
      <span class="cb-description">{description}</span>
    {/if}
  </div>

  {#if enabled}
    <!-- Frequency picker -->
    <div class="cb-section">
      <span class="cb-label">Frequency</span>
      <div class="cb-freq-buttons">
        {#each ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom'] as Frequency[] as freq}
          <button class="cb-freq-btn" class:active={frequency === freq} onclick={() => (frequency = freq)}>
            {freq.charAt(0).toUpperCase() + freq.slice(1)}
          </button>
        {/each}
      </div>
    </div>

    <!-- Per-frequency controls -->
    {#if frequency === 'minutes'}
      <div class="cb-section">
        <span class="cb-label">Every</span>
        <div class="cb-chip-group">
          {#each MINUTE_INTERVALS as interval}
            <button
              class="cb-chip"
              class:active={minuteInterval === interval}
              onclick={() => (minuteInterval = interval)}
            >
              {interval === 1 ? '1 min' : `${interval} min`}
            </button>
          {/each}
        </div>
      </div>
    {:else if frequency === 'hourly'}
      <div class="cb-section">
        <div class="cb-row">
          <div class="cb-field">
            <label class="cb-label" for="hourly-minute">At minute</label>
            <select id="hourly-minute" class="cb-select" bind:value={hourlyMinute}>
              {#each MINUTES_OF_HOUR as m}
                <option value={m}>{pad2(m)}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    {:else if frequency === 'daily'}
      <div class="cb-section">
        <div class="cb-row">
          <div class="cb-field">
            <label class="cb-label" for="daily-hour">Hour</label>
            <select id="daily-hour" class="cb-select" bind:value={dailyHour}>
              {#each HOURS as h}
                <option value={h}>{pad2(h)}:00</option>
              {/each}
            </select>
          </div>
          <div class="cb-field">
            <label class="cb-label" for="daily-minute">Minute</label>
            <select id="daily-minute" class="cb-select" bind:value={dailyMinute}>
              {#each MINUTES_OF_HOUR as m}
                <option value={m}>{pad2(m)}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    {:else if frequency === 'weekly'}
      <div class="cb-section">
        <div class="cb-field">
          <span class="cb-label">Day of week</span>
          <div class="cb-chip-group">
            {#each DAYS_OF_WEEK as day}
              <button class="cb-chip" class:active={weeklyDay === day.value} onclick={() => (weeklyDay = day.value)}>
                {day.short}
              </button>
            {/each}
          </div>
        </div>
        <div class="cb-row" style="margin-top: 10px;">
          <div class="cb-field">
            <label class="cb-label" for="weekly-hour">Hour</label>
            <select id="weekly-hour" class="cb-select" bind:value={weeklyHour}>
              {#each HOURS as h}
                <option value={h}>{pad2(h)}:00</option>
              {/each}
            </select>
          </div>
          <div class="cb-field">
            <label class="cb-label" for="weekly-minute">Minute</label>
            <select id="weekly-minute" class="cb-select" bind:value={weeklyMinute}>
              {#each MINUTES_OF_HOUR as m}
                <option value={m}>{pad2(m)}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    {:else if frequency === 'monthly'}
      <div class="cb-section">
        <div class="cb-row">
          <div class="cb-field">
            <label class="cb-label" for="monthly-day">Day of month</label>
            <select id="monthly-day" class="cb-select" bind:value={monthlyDay}>
              {#each DAYS_OF_MONTH as d}
                <option value={d}>{d}</option>
              {/each}
            </select>
          </div>
          <div class="cb-field">
            <label class="cb-label" for="monthly-hour">Hour</label>
            <select id="monthly-hour" class="cb-select" bind:value={monthlyHour}>
              {#each HOURS as h}
                <option value={h}>{pad2(h)}:00</option>
              {/each}
            </select>
          </div>
          <div class="cb-field">
            <label class="cb-label" for="monthly-minute">Minute</label>
            <select id="monthly-minute" class="cb-select" bind:value={monthlyMinute}>
              {#each MINUTES_OF_HOUR as m}
                <option value={m}>{pad2(m)}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    {:else if frequency === 'custom'}
      <div class="cb-section">
        <label class="cb-label" for="custom-expr">Cron expression (minute hour dom month dow)</label>
        <input
          id="custom-expr"
          type="text"
          class="cb-input cb-mono"
          class:invalid={!isCustomValid(customExpr)}
          bind:value={customExpr}
          placeholder="* * * * *"
          spellcheck="false"
          autocomplete="off"
        />
        {#if !isCustomValid(customExpr)}
          <span class="cb-error">Must have exactly 5 fields separated by spaces</span>
        {/if}
      </div>
    {/if}

    <!-- Expression display -->
    <div class="cb-expr-row">
      <span class="cb-expr-label">Expression</span>
      <code class="cb-expr">{expression}</code>
    </div>

    <!-- Next runs -->
    {#if nextRuns.length > 0}
      <div class="cb-next-runs">
        <span class="cb-label">Next occurrences</span>
        <ul class="cb-run-list">
          {#each nextRuns as run, i}
            <li class="cb-run-item">
              <span class="cb-run-index">{i + 1}</span>
              <span class="cb-run-date">{formatRunDate(run)}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else if enabled && frequency === 'custom' && !isCustomValid(customExpr)}
      <div class="cb-next-runs">
        <span class="cb-run-none">Fix the expression to preview next runs</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .cron-builder {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    font-size: 0.85rem;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ── Header ── */
  .cb-header {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .cb-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }

  .cb-toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .cb-toggle-track {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    background: var(--btn-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    transition:
      background 0.2s,
      border-color 0.2s;
  }

  .cb-toggle-input:checked ~ .cb-toggle-track {
    background: var(--accent);
    border-color: var(--accent);
  }

  .cb-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--text-muted);
    transition:
      transform 0.2s,
      background 0.2s;
  }

  .cb-toggle-input:checked ~ .cb-toggle-track .cb-toggle-thumb {
    transform: translateX(16px);
    background: white;
  }

  .cb-toggle-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 52px;
  }

  .cb-toggle-input:checked ~ .cb-toggle-label {
    color: var(--text-secondary);
  }

  .cb-description {
    font-size: 0.85rem;
    color: var(--accent);
    font-weight: 500;
  }

  /* ── Section ── */
  .cb-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cb-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* ── Frequency buttons ── */
  .cb-freq-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cb-freq-btn {
    padding: 5px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
    font-family: inherit;
  }

  .cb-freq-btn:hover:not(.active) {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .cb-freq-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  /* ── Chips ── */
  .cb-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cb-chip {
    padding: 4px 10px;
    font-size: 0.78rem;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
    font-family: inherit;
  }

  .cb-chip:hover:not(.active) {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .cb-chip.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  /* ── Row / field layout ── */
  .cb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .cb-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  /* ── Selects ── */
  .cb-select {
    padding: 5px 28px 5px 10px;
    font-size: 0.82rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    font-family: inherit;
    min-width: 80px;
  }

  .cb-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* ── Custom input ── */
  .cb-input {
    padding: 7px 12px;
    font-size: 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    width: 100%;
    font-family: inherit;
  }

  .cb-mono {
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  }

  .cb-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .cb-input.invalid {
    border-color: var(--danger);
  }

  .cb-error {
    font-size: 0.75rem;
    color: var(--danger);
  }

  /* ── Expression display ── */
  .cb-expr-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
  }

  .cb-expr-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .cb-expr {
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.82rem;
    color: var(--cyan);
    letter-spacing: 0.04em;
  }

  /* ── Next runs ── */
  .cb-next-runs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cb-run-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cb-run-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
  }

  .cb-run-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-bg);
    color: var(--accent);
    font-size: 0.68rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .cb-run-date {
    color: var(--text-secondary);
  }

  .cb-run-none {
    font-size: 0.78rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
