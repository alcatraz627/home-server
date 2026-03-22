import { browser } from '$app/environment';

/**
 * Reusable localStorage-backed history manager for tool pages.
 * Usage:
 *   const history = createHistory<T>('hs:dns-trace-history', 20);
 *   history.add({ ... });
 *   history.clear();
 */
export interface HistoryManager<T> {
  items: T[];
  add: (item: T) => void;
  remove: (index: number) => void;
  clear: () => void;
}

export function createHistory<T>(key: string, maxItems = 20): HistoryManager<T> {
  let items = $state<T[]>([]);

  function load() {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) items = JSON.parse(raw);
    } catch {}
  }

  function save() {
    if (!browser) return;
    try {
      localStorage.setItem(key, JSON.stringify(items.slice(0, maxItems)));
    } catch {}
  }

  load();

  return {
    get items() {
      return items;
    },
    add(item: T) {
      items = [item, ...items].slice(0, maxItems);
      save();
    },
    remove(index: number) {
      items = items.filter((_, i) => i !== index);
      save();
    },
    clear() {
      items = [];
      save();
    },
  };
}
