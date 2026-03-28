<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  type Phase = 'work' | 'short-break' | 'long-break';

  // Config (minutes)
  let workMins = $state(25);
  let shortBreakMins = $state(5);
  let longBreakMins = $state(15);
  let longBreakAfter = $state(4); // pomodoros before long break

  // Timer state
  let phase = $state<Phase>('work');
  let secondsLeft = $state(25 * 60); // matches workMins default; kept in sync by $effect
  let running = $state(false);
  let pomodoroCount = $state(0); // completed work sessions
  let sessionLabel = $state(''); // optional task label

  let interval: ReturnType<typeof setInterval> | null = null;

  // Derived display values
  let displayMins = $derived(Math.floor(secondsLeft / 60));
  let displaySecs = $derived(secondsLeft % 60);
  let timeStr = $derived(`${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(2, '0')}`);

  let totalSecs = $derived(
    phase === 'work' ? workMins * 60 : phase === 'short-break' ? shortBreakMins * 60 : longBreakMins * 60,
  );

  let progressPct = $derived(totalSecs > 0 ? ((totalSecs - secondsLeft) / totalSecs) * 100 : 0);

  const PHASE_LABELS: Record<Phase, string> = {
    work: 'Focus',
    'short-break': 'Short Break',
    'long-break': 'Long Break',
  };

  const PHASE_COLORS: Record<Phase, string> = {
    work: 'var(--accent)',
    'short-break': 'var(--success, #22c55e)',
    'long-break': 'var(--warning, #f59e0b)',
  };

  function phaseColor() {
    return PHASE_COLORS[phase];
  }

  function tick() {
    if (secondsLeft <= 0) {
      completePhase();
      return;
    }
    secondsLeft--;
  }

  function completePhase() {
    stopInterval();
    running = false;
    notifyDone();
    if (phase === 'work') {
      pomodoroCount++;
      const nextBreak = pomodoroCount % longBreakAfter === 0 ? 'long-break' : 'short-break';
      switchPhase(nextBreak);
    } else {
      switchPhase('work');
    }
  }

  function notifyDone() {
    const msg =
      phase === 'work' ? `Pomodoro #${pomodoroCount + 1} complete! Time for a break.` : 'Break over — back to work!';
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro Timer', { body: msg, icon: '/favicon.png' });
    }
  }

  function switchPhase(next: Phase) {
    phase = next;
    secondsLeft = next === 'work' ? workMins * 60 : next === 'short-break' ? shortBreakMins * 60 : longBreakMins * 60;
  }

  function startStop() {
    if (running) {
      stopInterval();
      running = false;
    } else {
      requestNotificationPermission();
      interval = setInterval(tick, 1000);
      running = true;
    }
  }

  function reset() {
    stopInterval();
    running = false;
    switchPhase(phase);
  }

  function fullReset() {
    stopInterval();
    running = false;
    pomodoroCount = 0;
    phase = 'work';
    secondsLeft = workMins * 60;
    sessionLabel = '';
  }

  function stopInterval() {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function setPhase(p: Phase) {
    stopInterval();
    running = false;
    switchPhase(p);
  }

  // Update secondsLeft when config changes while not running
  $effect(() => {
    if (!running) {
      secondsLeft =
        phase === 'work' ? workMins * 60 : phase === 'short-break' ? shortBreakMins * 60 : longBreakMins * 60;
    }
  });

  onDestroy(() => stopInterval());
</script>

<div class="pomodoro">
  <!-- Phase tabs -->
  <div class="phase-tabs">
    {#each ['work', 'short-break', 'long-break'] as Phase[] as p}
      <button class="phase-tab" class:active={phase === p} onclick={() => setPhase(p)}>
        {PHASE_LABELS[p]}
      </button>
    {/each}
  </div>

  <!-- Timer ring -->
  <div class="timer-ring-wrap">
    <svg class="timer-svg" viewBox="0 0 120 120">
      <!-- Track -->
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-hover)" stroke-width="8" />
      <!-- Progress -->
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke={phaseColor()}
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray={2 * Math.PI * 52}
        stroke-dashoffset={2 * Math.PI * 52 * (1 - progressPct / 100)}
        transform="rotate(-90 60 60)"
        style="transition: stroke-dashoffset 0.8s linear"
      />
    </svg>
    <div class="timer-center">
      <div class="timer-phase">{PHASE_LABELS[phase]}</div>
      <div class="timer-time" style="color:{phaseColor()}">{timeStr}</div>
      {#if pomodoroCount > 0}
        <div class="timer-count">#{pomodoroCount}</div>
      {/if}
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <button class="ctrl-btn reset-btn" onclick={reset} title="Reset current phase">
      <Icon name="refresh" size={16} />
    </button>
    <button class="ctrl-btn start-btn" onclick={startStop} style="background:{phaseColor()}">
      <Icon name={running ? 'pause' : 'play'} size={20} />
    </button>
    <button class="ctrl-btn reset-btn" onclick={fullReset} title="Full reset">
      <Icon name="x" size={16} />
    </button>
  </div>

  <!-- Pomodoro dots -->
  <div class="pomo-dots">
    {#each Array(longBreakAfter) as _, i}
      <div
        class="pomo-dot"
        class:filled={i < pomodoroCount % longBreakAfter || (pomodoroCount > 0 && pomodoroCount % longBreakAfter === 0)}
      ></div>
    {/each}
  </div>

  <!-- Session label -->
  <div class="session-label-row">
    <input class="session-input" placeholder="What are you working on? (optional)" bind:value={sessionLabel} />
  </div>

  <!-- Config -->
  <details class="config-panel">
    <summary class="config-toggle">
      <Icon name="settings" size={13} />
      Timer settings
    </summary>
    <div class="config-grid">
      <label class="config-label">
        Focus (min)
        <input type="number" class="config-num" min="1" max="90" bind:value={workMins} />
      </label>
      <label class="config-label">
        Short break
        <input type="number" class="config-num" min="1" max="30" bind:value={shortBreakMins} />
      </label>
      <label class="config-label">
        Long break
        <input type="number" class="config-num" min="1" max="60" bind:value={longBreakMins} />
      </label>
      <label class="config-label">
        Long break after
        <input type="number" class="config-num" min="2" max="8" bind:value={longBreakAfter} />
      </label>
    </div>
  </details>
</div>

<style>
  .pomodoro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px 0;
    max-width: 360px;
    margin: 0 auto;
  }

  /* Phase tabs */
  .phase-tabs {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .phase-tab {
    background: none;
    border: none;
    padding: 6px 14px;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background 0.1s,
      color 0.1s;
  }
  .phase-tab:not(:last-child) {
    border-right: 1px solid var(--border);
  }
  .phase-tab.active {
    background: var(--accent);
    color: white;
  }

  /* Ring */
  .timer-ring-wrap {
    position: relative;
    width: 200px;
    height: 200px;
  }
  .timer-svg {
    width: 100%;
    height: 100%;
  }
  .timer-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .timer-phase {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .timer-time {
    font-size: 2.4rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .timer-count {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.1s,
      transform 0.1s;
  }
  .ctrl-btn:active {
    transform: scale(0.95);
  }
  .start-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    color: white;
  }
  .reset-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--bg-secondary);
    border: 1px solid var(--border) !important;
    color: var(--text-muted);
  }
  .reset-btn:hover {
    border-color: var(--accent) !important;
    color: var(--accent);
  }

  /* Pomo dots */
  .pomo-dots {
    display: flex;
    gap: 6px;
  }
  .pomo-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    background: none;
    transition: background 0.2s;
  }
  .pomo-dot.filled {
    background: var(--accent);
  }

  /* Session label */
  .session-label-row {
    width: 100%;
  }
  .session-input {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.82rem;
    font-family: inherit;
    text-align: center;
  }
  .session-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* Config panel */
  .config-panel {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .config-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 0.78rem;
    color: var(--text-muted);
    cursor: pointer;
    list-style: none;
    background: var(--bg-secondary);
    user-select: none;
  }
  .config-toggle::-webkit-details-marker {
    display: none;
  }
  .config-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 12px;
  }
  .config-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .config-num {
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-family: 'JetBrains Mono', monospace;
    width: 60px;
  }
  .config-num:focus {
    outline: none;
    border-color: var(--accent);
  }
</style>
