import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme =
  | 'dark'
  | 'light'
  | 'monokai'
  | 'dracula'
  | 'solarized-dark'
  | 'solarized-light'
  | 'nord'
  | 'github-dark'
  | 'catppuccin'
  | 'tokyo-night';

export interface ThemeDef {
  id: Theme;
  label: string;
  dark: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', label: 'Dark', dark: true },
  { id: 'light', label: 'Light', dark: false },
  { id: 'monokai', label: 'Monokai', dark: true },
  { id: 'dracula', label: 'Dracula', dark: true },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true },
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
  { id: 'nord', label: 'Nord', dark: true },
  { id: 'github-dark', label: 'GitHub Dark', dark: true },
  { id: 'catppuccin', label: 'Catppuccin', dark: true },
  { id: 'tokyo-night', label: 'Tokyo Night', dark: true },
];

const VALID_THEMES = new Set(THEMES.map((t) => t.id));

function getInitialTheme(): Theme {
  if (!browser) return 'dark';
  const saved = localStorage.getItem('hs:theme');
  if (saved && VALID_THEMES.has(saved as Theme)) return saved as Theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const theme = writable<Theme>(getInitialTheme());

export function setTheme(id: Theme) {
  if (browser) {
    localStorage.setItem('hs:theme', id);
    document.documentElement.setAttribute('data-theme', id);
  }
  theme.set(id);
}

export function toggleTheme() {
  theme.update((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  });
}

/** Call on mount to sync the HTML attribute */
export function initTheme() {
  if (!browser) return;
  const t = getInitialTheme();
  document.documentElement.setAttribute('data-theme', t);
  theme.set(t);
}
