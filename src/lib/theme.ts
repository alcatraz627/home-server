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
  | 'tokyo-night'
  | 'one-dark'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'everforest'
  | 'rose-pine'
  | 'ayu-dark'
  | 'ayu-light'
  | 'material-dark'
  | 'kanagawa'
  | 'cyberpunk'
  | 'palenight'
  | 'horizon'
  | 'synthwave'
  | 'night-owl'
  | 'panda';

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
  { id: 'one-dark', label: 'One Dark', dark: true },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', dark: true },
  { id: 'gruvbox-light', label: 'Gruvbox Light', dark: false },
  { id: 'everforest', label: 'Everforest', dark: true },
  { id: 'rose-pine', label: 'Rosé Pine', dark: true },
  { id: 'ayu-dark', label: 'Ayu Dark', dark: true },
  { id: 'ayu-light', label: 'Ayu Light', dark: false },
  { id: 'material-dark', label: 'Material Dark', dark: true },
  { id: 'kanagawa', label: 'Kanagawa', dark: true },
  { id: 'cyberpunk', label: 'Cyberpunk', dark: true },
  { id: 'palenight', label: 'Palenight', dark: true },
  { id: 'horizon', label: 'Horizon Dark', dark: true },
  { id: 'synthwave', label: "Synthwave '84", dark: true },
  { id: 'night-owl', label: 'Night Owl', dark: true },
  { id: 'panda', label: 'Panda', dark: true },
];

export const THEME_SWATCHES: Record<Theme, { bg: string; accent: string; text: string }> = {
  dark: { bg: '#0f1117', accent: '#58a6ff', text: '#e1e4e8' },
  light: { bg: '#ffffff', accent: '#0969da', text: '#1f2328' },
  monokai: { bg: '#272822', accent: '#a6e22e', text: '#f8f8f2' },
  dracula: { bg: '#282a36', accent: '#50fa7b', text: '#f8f8f2' },
  'solarized-dark': { bg: '#002b36', accent: '#268bd2', text: '#eee8d5' },
  'solarized-light': { bg: '#fdf6e3', accent: '#268bd2', text: '#073642' },
  nord: { bg: '#2e3440', accent: '#88c0d0', text: '#eceff4' },
  'github-dark': { bg: '#22272e', accent: '#539bf5', text: '#adbac7' },
  catppuccin: { bg: '#1e1e2e', accent: '#89b4fa', text: '#cdd6f4' },
  'tokyo-night': { bg: '#1a1b2e', accent: '#7aa2f7', text: '#a9b1d6' },
  'one-dark': { bg: '#282c34', accent: '#61afef', text: '#abb2bf' },
  'gruvbox-dark': { bg: '#282828', accent: '#83a598', text: '#ebdbb2' },
  'gruvbox-light': { bg: '#fbf1c7', accent: '#076678', text: '#3c3836' },
  everforest: { bg: '#2d353b', accent: '#a7c080', text: '#d3c6aa' },
  'rose-pine': { bg: '#191724', accent: '#c4a7e7', text: '#e0def4' },
  'ayu-dark': { bg: '#0b0e14', accent: '#e6b450', text: '#bfbdb6' },
  'ayu-light': { bg: '#fafafa', accent: '#ff9940', text: '#575f66' },
  'material-dark': { bg: '#212121', accent: '#82aaff', text: '#eeffff' },
  kanagawa: { bg: '#1f1f28', accent: '#7e9cd8', text: '#dcd7ba' },
  cyberpunk: { bg: '#0a0a0f', accent: '#ff2a6d', text: '#e0e0ff' },
  palenight: { bg: '#292d3e', accent: '#82aaff', text: '#bfc7d5' },
  horizon: { bg: '#1c1e26', accent: '#e95678', text: '#e0e0e0' },
  synthwave: { bg: '#2b213a', accent: '#ff7edb', text: '#f5e1ff' },
  'night-owl': { bg: '#011627', accent: '#82aaff', text: '#d6deeb' },
  panda: { bg: '#292a2b', accent: '#19f9d8', text: '#e6e6e6' },
};

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
