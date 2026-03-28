import { onMount, onDestroy } from 'svelte';

/**
 * Creates an auto-refresh controller that polls a callback at a fixed interval.
 * Automatically starts on mount and clears on destroy.
 */
export function createAutoRefresh(callback: () => void | Promise<void>, intervalMs: number = 5000) {
  let enabled = $state(true);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    stop();
    timer = setInterval(() => {
      if (enabled) callback();
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
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
    toggle,
    restart: start,
  };
}
