import { writable } from 'svelte/store';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: number;
  key?: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastOptions {
  duration?: number;
  /** Unique key for deduplication — if a toast with the same key exists, it replaces the old one */
  key?: string;
}

let nextId = 0;
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add(type: ToastType, message: string, opts: ToastOptions = {}) {
    const { duration = 4000, key } = opts;
    const id = nextId++;

    update((toasts) => {
      let filtered = toasts;
      // Dedupe by key — remove existing toast with same key
      if (key) {
        const existing = toasts.find((t) => t.key === key);
        if (existing) {
          const timer = dismissTimers.get(existing.id);
          if (timer) clearTimeout(timer);
          dismissTimers.delete(existing.id);
          filtered = toasts.filter((t) => t.key !== key);
        }
      }
      return [...filtered, { id, key, type, message, duration }];
    });

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      dismissTimers.set(id, timer);
    }
  }

  function dismiss(id: number) {
    const timer = dismissTimers.get(id);
    if (timer) clearTimeout(timer);
    dismissTimers.delete(id);
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    success: (msg: string, opts?: ToastOptions | number) => add('success', msg, normalizeOpts(opts)),
    warning: (msg: string, opts?: ToastOptions | number) => add('warning', msg, normalizeOpts(opts)),
    error: (msg: string, opts?: ToastOptions | number) => add('error', msg, normalizeOpts(opts)),
    info: (msg: string, opts?: ToastOptions | number) => add('info', msg, normalizeOpts(opts)),
    dismiss,
  };
}

/** Accept either a number (legacy duration) or ToastOptions */
function normalizeOpts(opts?: ToastOptions | number): ToastOptions {
  if (opts === undefined) return {};
  if (typeof opts === 'number') return { duration: opts };
  return opts;
}

export const toast = createToastStore();
