import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { SK_STARRED } from '$lib/constants/storage-keys';

export type StarType = 'process' | 'file' | 'bulb' | 'backup' | 'task' | 'device';

interface StarredItems {
  [type: string]: string[];
}

const STORAGE_KEY = SK_STARRED;

function loadStarred(): StarredItems {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function createStarStore() {
  const { subscribe, update, set } = writable<StarredItems>(loadStarred());

  function persist(items: StarredItems) {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  return {
    subscribe,
    toggle(type: StarType, id: string) {
      update((items) => {
        const list = items[type] ?? [];
        const idx = list.indexOf(id);
        const next = { ...items };
        if (idx >= 0) {
          next[type] = list.filter((i) => i !== id);
        } else {
          next[type] = [...list, id];
        }
        persist(next);
        return next;
      });
    },
    isStarred(type: StarType, id: string): boolean {
      const items = get({ subscribe });
      return (items[type] ?? []).includes(id);
    },
    getStarred(type: StarType): string[] {
      const items = get({ subscribe });
      return items[type] ?? [];
    },
    /** Sort helper: starred items first, preserving original order within each group */
    sortStarred<T>(type: StarType, items: T[], getId: (item: T) => string): T[] {
      const starred = new Set(this.getStarred(type));
      const s: T[] = [];
      const u: T[] = [];
      for (const item of items) {
        if (starred.has(getId(item))) s.push(item);
        else u.push(item);
      }
      return [...s, ...u];
    },
  };
}

export const stars = createStarStore();
