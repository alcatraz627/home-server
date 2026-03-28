import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { PATHS } from '$lib/server/paths';
import type { LinkableModule } from '$lib/types/productivity';

interface ResolvedItem {
  type: LinkableModule;
  id: string;
  title: string;
}

/**
 * Resolve item titles from module type + id pairs.
 * GET /api/resolve?items=kanban:abc123,reminder:def456
 * Returns: [{ type, id, title }]
 */
export const GET: RequestHandler = async ({ url }) => {
  const itemsParam = url.searchParams.get('items');
  if (!itemsParam) return json([]);

  const pairs = itemsParam.split(',').map((pair) => {
    const [type, id] = pair.split(':');
    return { type: type as LinkableModule, id };
  });

  const results: ResolvedItem[] = [];

  for (const { type, id } of pairs) {
    const title = resolveTitle(type, id);
    results.push({ type, id, title });
  }

  return json(results);
};

function resolveTitle(type: LinkableModule, id: string): string {
  try {
    switch (type) {
      case 'kanban': {
        const cards = readJson(PATHS.kanban);
        const card = cards.find((c) => c.id === id);
        return (card?.title as string) ?? `Card ${id.slice(0, 6)}`;
      }
      case 'reminder': {
        const reminders = readJson(PATHS.reminders);
        const r = reminders.find((rem) => rem.id === id);
        return (r?.title as string) ?? `Reminder ${id.slice(0, 6)}`;
      }
      case 'bookmark': {
        const bookmarks = readJson(PATHS.bookmarks);
        const b = bookmarks.find((bm) => bm.id === id);
        return (b?.title as string) ?? (b?.url as string) ?? `Bookmark ${id.slice(0, 6)}`;
      }
      case 'note': {
        const notesDir = PATHS.notes;
        // Notes are individual files, try to find by id
        if (fs.existsSync(notesDir)) {
          const files = fs.readdirSync(notesDir).filter((f) => f.endsWith('.json'));
          for (const f of files) {
            try {
              const note = JSON.parse(fs.readFileSync(path.join(notesDir, f), 'utf-8'));
              if (note.id === id) return note.title ?? `Note ${id.slice(0, 6)}`;
            } catch {
              continue;
            }
          }
        }
        return `Note ${id.slice(0, 6)}`;
      }
      case 'keeper': {
        // Keeper stores feature requests — check keeper logs
        const keeperDir = PATHS.keeperLogs;
        if (fs.existsSync(keeperDir)) {
          const files = fs.readdirSync(keeperDir).filter((f) => f.endsWith('.json'));
          for (const f of files) {
            try {
              const feature = JSON.parse(fs.readFileSync(path.join(keeperDir, f), 'utf-8'));
              if (feature.id === id) return feature.title ?? `Feature ${id.slice(0, 6)}`;
            } catch {
              continue;
            }
          }
        }
        return `Feature ${id.slice(0, 6)}`;
      }
      default:
        return `${type} ${id.slice(0, 6)}`;
    }
  } catch {
    return `${type} ${id.slice(0, 6)}`;
  }
}

function readJson(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
