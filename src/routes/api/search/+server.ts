import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { PATHS } from '$lib/server/paths';

export interface SearchResult {
  id: string;
  module: 'note' | 'kanban' | 'bookmark' | 'reminder' | 'keeper';
  title: string;
  snippet: string;
  href: string;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function excerpt(text: string, q: string, maxLen = 80): string {
  const lc = text.toLowerCase();
  const idx = lc.indexOf(q);
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + q.length + 40);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function matches(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

export const GET: RequestHandler = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return json({ results: [] });

  const results: SearchResult[] = [];

  // ── Notes ────────────────────────────────────────────────────────
  try {
    if (fs.existsSync(PATHS.notes)) {
      const files = fs.readdirSync(PATHS.notes).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const note = readJson<{ id: string; title: string; icon: string; blocks: { content: string }[] }>(
          path.join(PATHS.notes, file),
          { id: '', title: '', icon: '', blocks: [] },
        );
        if (!note.id) continue;
        const text = note.blocks.map((b) => b.content).join(' ');
        if (matches(note.title, q) || matches(text, q)) {
          results.push({
            id: `note:${note.id}`,
            module: 'note',
            title: note.title || 'Untitled',
            snippet: excerpt(matches(note.title, q) ? note.title : text, q),
            href: '/notes',
          });
        }
      }
    }
  } catch {}

  // ── Kanban ───────────────────────────────────────────────────────
  try {
    const kanban = readJson<{ cards: { id: string; title: string; description: string; column: string }[] }>(
      PATHS.kanban,
      { cards: [] },
    );
    for (const card of kanban.cards ?? []) {
      if (matches(card.title, q) || matches(card.description ?? '', q)) {
        results.push({
          id: `kanban:${card.id}`,
          module: 'kanban',
          title: card.title,
          snippet: excerpt(matches(card.title, q) ? card.title : card.description, q),
          href: '/kanban',
        });
      }
    }
  } catch {}

  // ── Bookmarks ────────────────────────────────────────────────────
  try {
    const bookmarks = readJson<{ id: string; title: string; url: string; description: string }[]>(PATHS.bookmarks, []);
    for (const bm of bookmarks) {
      if (matches(bm.title, q) || matches(bm.url, q) || matches(bm.description ?? '', q)) {
        results.push({
          id: `bookmark:${bm.id}`,
          module: 'bookmark',
          title: bm.title || bm.url,
          snippet: excerpt(matches(bm.title, q) ? bm.title : bm.url, q),
          href: '/bookmarks',
        });
      }
    }
  } catch {}

  // ── Reminders ────────────────────────────────────────────────────
  try {
    const reminders = readJson<{ id: string; title: string; description: string }[]>(PATHS.reminders, []);
    for (const r of reminders) {
      if (matches(r.title, q) || matches(r.description ?? '', q)) {
        results.push({
          id: `reminder:${r.id}`,
          module: 'reminder',
          title: r.title,
          snippet: excerpt(matches(r.title, q) ? r.title : r.description, q),
          href: '/reminders',
        });
      }
    }
  } catch {}

  // ── Keeper ───────────────────────────────────────────────────────
  try {
    const keeper = readJson<{
      requests: { id: string; title: string; goal: string; details: string }[];
    }>(path.join(PATHS.config, 'keeper-requests.json'), { requests: [] });
    for (const req of keeper.requests ?? []) {
      if (matches(req.title, q) || matches(req.goal ?? '', q) || matches(req.details ?? '', q)) {
        results.push({
          id: `keeper:${req.id}`,
          module: 'keeper',
          title: req.title,
          snippet: excerpt(matches(req.title, q) ? req.title : (req.goal ?? req.details), q),
          href: '/keeper',
        });
      }
    }
  } catch {}

  return json({ results: results.slice(0, 20) });
};
