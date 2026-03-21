import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (!browser) return 'dark';
  const saved = localStorage.getItem('hs:theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const theme = writable<Theme>(getInitialTheme());

export function toggleTheme() {
  theme.update((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    if (browser) {
      localStorage.setItem('hs:theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
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
