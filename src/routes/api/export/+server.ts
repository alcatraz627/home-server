import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import { PATHS } from '$lib/server/paths';
import { APP } from '$lib/constants/app';

/** Productivity data files to include in export bundle */
const EXPORTABLE_FILES: { key: string; path: string; label: string }[] = [
  { key: 'kanban', path: PATHS.kanban, label: 'Kanban cards' },
  { key: 'reminders', path: PATHS.reminders, label: 'Reminders' },
  { key: 'bookmarks', path: PATHS.bookmarks, label: 'Bookmarks' },
  { key: 'links', path: PATHS.links, label: 'Cross-module links' },
  { key: 'habits', path: PATHS.habits, label: 'Habits' },
  { key: 'habitLogs', path: PATHS.habitLogs, label: 'Habit logs' },
  { key: 'tags', path: PATHS.tags, label: 'Tags' },
  { key: 'notifications', path: PATHS.notifications, label: 'Notifications' },
];

function readJson(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function readNotesDir(): unknown[] {
  try {
    if (!fs.existsSync(PATHS.notes)) return [];
    return fs
      .readdirSync(PATHS.notes)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(`${PATHS.notes}/${f}`, 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** GET: Export all productivity data as a JSON bundle */
export const GET: RequestHandler = async ({ url }) => {
  const modules = url.searchParams.get('modules')?.split(',') ?? null;

  const bundle: Record<string, unknown> = {
    _meta: {
      version: APP.version,
      exportedAt: new Date().toISOString(),
      format: 'home-server-export-v1',
    },
  };

  // Notes (directory-based, special handling)
  if (!modules || modules.includes('notes')) {
    bundle.notes = readNotesDir();
  }

  // JSON file-based modules
  for (const file of EXPORTABLE_FILES) {
    if (!modules || modules.includes(file.key)) {
      bundle[file.key] = readJson(file.path);
    }
  }

  // Keeper requests (stored via keeper module)
  if (!modules || modules.includes('keeper')) {
    try {
      const { getRequests } = await import('$lib/server/keeper');
      bundle.keeper = await getRequests();
    } catch {
      bundle.keeper = [];
    }
  }

  return json(bundle);
};

/** POST: Import productivity data from a JSON bundle */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._meta?.format !== 'home-server-export-v1') {
    return json({ error: 'Invalid export format. Expected home-server-export-v1.' }, { status: 400 });
  }

  const mode = body._importMode ?? 'merge'; // 'merge' | 'replace'
  const imported: string[] = [];

  // Notes
  if (body.notes && Array.isArray(body.notes)) {
    if (!fs.existsSync(PATHS.notes)) fs.mkdirSync(PATHS.notes, { recursive: true });
    for (const note of body.notes) {
      if (!note.id) continue;
      const notePath = `${PATHS.notes}/${note.id}.json`;
      if (mode === 'merge' && fs.existsSync(notePath)) continue;
      fs.writeFileSync(notePath, JSON.stringify(note, null, 2));
    }
    imported.push('notes');
  }

  // JSON file-based modules
  for (const file of EXPORTABLE_FILES) {
    if (body[file.key] && Array.isArray(body[file.key])) {
      if (mode === 'replace') {
        fs.writeFileSync(file.path, JSON.stringify(body[file.key], null, 2));
      } else {
        // Merge: combine arrays, deduplicate by id
        const existing = readJson(file.path) as any[];
        const existingIds = new Set(existing.map((item: any) => item.id).filter(Boolean));
        const newItems = body[file.key].filter((item: any) => item.id && !existingIds.has(item.id));
        fs.writeFileSync(file.path, JSON.stringify([...existing, ...newItems], null, 2));
      }
      imported.push(file.key);
    }
  }

  // Keeper
  if (body.keeper && Array.isArray(body.keeper)) {
    try {
      const keeper = await import('$lib/server/keeper');
      if (mode === 'replace') {
        // Write directly via keeper's internal path
        const keeperPath = `${PATHS.config}/keeper.json`;
        fs.writeFileSync(keeperPath, JSON.stringify(body.keeper, null, 2));
      } else {
        const existing = await keeper.getRequests();
        const existingIds = new Set(existing.map((r: any) => r.id));
        for (const req of body.keeper) {
          if (req.id && !existingIds.has(req.id)) {
            await keeper.createRequest(req);
          }
        }
      }
      imported.push('keeper');
    } catch {}
  }

  return json({ ok: true, imported, mode });
};
