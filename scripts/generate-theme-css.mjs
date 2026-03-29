#!/usr/bin/env node
/**
 * Generates the theme CSS blocks in app.css from theme-data.ts.
 * Usage: node scripts/generate-theme-css.mjs
 *
 * Reads THEME_DATA from src/lib/constants/theme-data.ts,
 * regenerates the [data-theme] blocks in app.css between
 * the markers, and updates THEME_SWATCHES + Theme type in theme.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Parse theme-data.ts (simple regex extraction, no TS compiler needed) ---

const dataFile = fs.readFileSync(path.join(ROOT, 'src/lib/constants/theme-data.ts'), 'utf-8');

// Extract THEME_VARS array
const varsMatch = dataFile.match(/THEME_VARS\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
if (!varsMatch) throw new Error('Could not parse THEME_VARS');
const THEME_VARS = [...varsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Extract each theme entry
const themeBlocks = [
  ...dataFile.matchAll(
    /\{\s*id:\s*'([^']+)',\s*label:\s*(?:'([^']*)'|"([^"]*)"),\s*dark:\s*(true|false),\s*vars:\s*\{([\s\S]*?)\},?\s*\}/g,
  ),
];

const themes = themeBlocks.map((m) => {
  const id = m[1];
  const label = m[2] ?? m[3];
  const dark = m[4] === 'true';
  const varsBlock = m[5];
  const vars = {};
  for (const vm of varsBlock.matchAll(/(?:'([^']+)'|(\w[\w-]*))\s*:\s*'([^']+)'/g)) {
    vars[vm[1] ?? vm[2]] = vm[3];
  }
  return { id, label, dark, vars };
});

if (themes.length === 0) throw new Error('No themes found in theme-data.ts');
console.log(`Parsed ${themes.length} themes from theme-data.ts`);

// --- Generate CSS ---

function generateCSS(themes) {
  const lines = ['/* ===== Theme Variables ===== */'];

  for (let i = 0; i < themes.length; i++) {
    const t = themes[i];
    // First theme (dark) also sets :root
    const selector = i === 0 ? `:root,\n[data-theme='${t.id}']` : `[data-theme='${t.id}']`;
    lines.push(`${selector} {`);
    for (const v of THEME_VARS) {
      lines.push(`  --${v}: ${t.vars[v]};`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// --- Update app.css ---

const cssPath = path.join(ROOT, 'src/app.css');
const css = fs.readFileSync(cssPath, 'utf-8');

// Find the theme section: starts after fonts, ends before "/* ===== Reset & Base ===== */"
const resetMarker = '/* ===== Reset & Base ===== */';
const themeStart = css.indexOf('/* ===== Theme Variables ===== */');
const resetIdx = css.indexOf(resetMarker);

if (themeStart === -1 || resetIdx === -1) {
  throw new Error('Could not find theme section markers in app.css');
}

const before = css.slice(0, themeStart);
const after = css.slice(resetIdx);
const newCSS = before + generateCSS(themes) + after;

fs.writeFileSync(cssPath, newCSS);
console.log(`Updated app.css (${themes.length} theme blocks)`);

// --- Update theme.ts ---

const themeTsPath = path.join(ROOT, 'src/lib/theme.ts');
let themeTs = fs.readFileSync(themeTsPath, 'utf-8');

// Generate Theme type union
const typeUnion = themes.map((t) => `  | '${t.id}'`).join('\n');
themeTs = themeTs.replace(/export type Theme =[\s\S]*?;/, `export type Theme =\n${typeUnion};`);

// Generate THEMES array
const themesArray = themes
  .map((t) => {
    const label = t.label.includes("'") ? `"${t.label}"` : `'${t.label}'`;
    return `  { id: '${t.id}', label: ${label}, dark: ${t.dark} },`;
  })
  .join('\n');
themeTs = themeTs.replace(
  /export const THEMES: ThemeDef\[\] = \[[\s\S]*?\];/,
  `export const THEMES: ThemeDef[] = [\n${themesArray}\n];`,
);

// Generate THEME_SWATCHES
const swatchEntries = themes
  .map((t) => {
    const bg = t.vars['bg-primary'];
    const accent = t.vars['accent'];
    const text = t.vars['text-primary'];
    return `  '${t.id}': { bg: '${bg}', accent: '${accent}', text: '${text}' },`;
  })
  .join('\n');
themeTs = themeTs.replace(
  /export const THEME_SWATCHES: Record<Theme, \{ bg: string; accent: string; text: string \}> = \{[\s\S]*?\};/,
  `export const THEME_SWATCHES: Record<Theme, { bg: string; accent: string; text: string }> = {\n${swatchEntries}\n};`,
);

fs.writeFileSync(themeTsPath, themeTs);
console.log(`Updated theme.ts (Type union + THEMES + THEME_SWATCHES)`);

console.log('Done! Run prettier on changed files.');
