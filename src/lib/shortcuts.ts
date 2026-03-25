/**
 * Keyboard shortcut system.
 * - SHORTCUT_DEFAULTS: single source of truth for all shortcuts
 * - useShortcuts(): called in onMount, returns cleanup
 * - getKey(id): resolves custom override or default key
 * - setCustomKey / resetCustomKey: called from the /shortcuts page
 */

export interface ShortcutDef {
  id: string;
  page: string;
  description: string;
  defaultKey: string;
  category: string;
}

export const SHORTCUT_DEFAULTS: ShortcutDef[] = [
  // Global
  {
    id: 'global:shortcuts',
    page: 'Global',
    description: 'Open shortcuts page',
    defaultKey: '?',
    category: 'Navigation',
  },

  // Processes
  {
    id: 'processes:refresh',
    page: 'Processes',
    description: 'Refresh processes',
    defaultKey: 'r',
    category: 'Actions',
  },
  {
    id: 'processes:focus-filter',
    page: 'Processes',
    description: 'Focus filter input',
    defaultKey: '/',
    category: 'Navigation',
  },

  // Logs
  { id: 'logs:refresh', page: 'Logs', description: 'Refresh logs', defaultKey: 'r', category: 'Actions' },
  { id: 'logs:focus-search', page: 'Logs', description: 'Focus search', defaultKey: '/', category: 'Navigation' },

  // Status
  { id: 'status:refresh', page: 'Status', description: 'Refresh status', defaultKey: 'r', category: 'Actions' },

  // Keeper
  { id: 'keeper:new', page: 'Keeper', description: 'New request', defaultKey: 'n', category: 'Actions' },
  { id: 'keeper:refresh', page: 'Keeper', description: 'Refresh', defaultKey: 'r', category: 'Actions' },
  {
    id: 'keeper:navigate-down',
    page: 'Keeper',
    description: 'Select next item',
    defaultKey: 'j',
    category: 'Navigation',
  },
  {
    id: 'keeper:navigate-up',
    page: 'Keeper',
    description: 'Select previous item',
    defaultKey: 'k',
    category: 'Navigation',
  },
  { id: 'keeper:expand', page: 'Keeper', description: 'Expand selected', defaultKey: 'Enter', category: 'Actions' },
  { id: 'keeper:mark-ready', page: 'Keeper', description: 'Mark selected ready', defaultKey: 'r', category: 'Actions' },
  { id: 'keeper:mark-done', page: 'Keeper', description: 'Mark selected done', defaultKey: 'd', category: 'Actions' },
  { id: 'keeper:edit', page: 'Keeper', description: 'Edit selected', defaultKey: 'e', category: 'Actions' },

  // Notes
  { id: 'notes:new', page: 'Notes', description: 'New note', defaultKey: 'n', category: 'Actions' },

  // Bookmarks
  { id: 'bookmarks:new', page: 'Bookmarks', description: 'New bookmark', defaultKey: 'n', category: 'Actions' },
  {
    id: 'bookmarks:focus-search',
    page: 'Bookmarks',
    description: 'Focus search',
    defaultKey: '/',
    category: 'Navigation',
  },
];

const STORAGE_KEY = 'shortcuts-custom';

let customKeys: Record<string, string> = {};
let loaded = false;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    customKeys = raw ? JSON.parse(raw) : {};
  } catch {
    customKeys = {};
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customKeys));
  } catch {}
}

export function getKey(id: string): string {
  load();
  return customKeys[id] ?? SHORTCUT_DEFAULTS.find((d) => d.id === id)?.defaultKey ?? '';
}

export function isCustomized(id: string): boolean {
  load();
  return id in customKeys;
}

export function setCustomKey(id: string, key: string) {
  load();
  customKeys[id] = key;
  save();
}

export function resetCustomKey(id: string) {
  load();
  delete customKeys[id];
  save();
}

export function resetAllKeys() {
  customKeys = {};
  loaded = true;
  save();
}

export function getAllShortcuts(): Array<ShortcutDef & { currentKey: string; customized: boolean }> {
  load();
  return SHORTCUT_DEFAULTS.map((def) => ({
    ...def,
    currentKey: getKey(def.id),
    customized: isCustomized(def.id),
  }));
}

function isEditable(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

type BoundDef = ShortcutDef & { handler: () => void };

export function useShortcuts(defs: BoundDef[]): () => void {
  if (typeof window === 'undefined') return () => {};
  load();

  function onKeydown(e: KeyboardEvent) {
    if (isEditable(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    for (const def of defs) {
      const key = getKey(def.id);
      if (!key) continue;
      const pressed = e.key === '?' ? '?' : e.shiftKey && e.key === '/' ? '?' : e.key;
      if (pressed === key || pressed.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        def.handler();
        return;
      }
    }
  }

  window.addEventListener('keydown', onKeydown);
  return () => window.removeEventListener('keydown', onKeydown);
}
