import { onMount, onDestroy } from 'svelte';

/**
 * Creates an auto-refresh controller that polls a callback at a fixed interval.
 * Automatically starts on mount and clears on destroy.
 *
 * Detects offline/error states: if the callback throws, polling backs off
 * exponentially (up to 60s) and resumes normal interval on success.
 */
export function createAutoRefresh(callback: () => void | Promise<void>, intervalMs: number = 5000) {
  let enabled = $state(true);
  let online = $state(true);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveErrors = 0;
  const MAX_BACKOFF_MS = 60_000;

  function scheduleNext() {
    stop();
    const delay =
      consecutiveErrors > 0 ? Math.min(intervalMs * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS) : intervalMs;
    timer = setTimeout(tick, delay);
  }

  async function tick() {
    if (!enabled) {
      scheduleNext();
      return;
    }
    try {
      await callback();
      consecutiveErrors = 0;
      online = true;
    } catch {
      consecutiveErrors++;
      online = false;
    }
    scheduleNext();
  }

  function start() {
    stop();
    consecutiveErrors = 0;
    scheduleNext();
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function toggle() {
    enabled = !enabled;
  }

  onMount(() => start());
  onDestroy(() => stop());

  return {
    get enabled() {
      return enabled;
    },
    set enabled(v: boolean) {
      enabled = v;
    },
    get online() {
      return online;
    },
    toggle,
    restart: start,
  };
}
