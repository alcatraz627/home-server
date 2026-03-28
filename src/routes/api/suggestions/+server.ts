import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import { PATHS } from '$lib/server/paths';

export interface Suggestion {
  id: string;
  type: 'overdue' | 'stale' | 'stuck' | 'dead-link';
  module: 'kanban' | 'reminder' | 'note' | 'bookmark';
  title: string;
  detail: string;
  href: string;
  /** ISO timestamp of the item being referenced */
  itemDate?: string;
}

function readJson<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T[];
  } catch {
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const now = new Date();
  const suggestions: Suggestion[] = [];

  // ── Overdue reminders (fired=false, datetime < now) ──────────────────────
  const reminders = readJson<{ id: string; title: string; datetime: string; fired?: boolean }>(PATHS.reminders);
  for (const r of reminders) {
    if (r.fired) continue;
    const due = new Date(r.datetime);
    if (due < now) {
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
      suggestions.push({
        id: `reminder-overdue-${r.id}`,
        type: 'overdue',
        module: 'reminder',
        title: r.title,
        detail: `Overdue by ${daysOverdue === 0 ? 'less than a day' : `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`}`,
        href: '/reminders',
        itemDate: r.datetime,
      });
    }
  }

  // ── Kanban cards stuck in "doing" for >7 days ─────────────────────────────
  const kanban = readJson<{
    id: string;
    title: string;
    column?: string;
    updatedAt?: string;
    createdAt?: string;
    dueDate?: string | null;
  }>(PATHS.kanban);

  const STUCK_THRESHOLD_DAYS = 7;
  const OVERDUE_COLS = ['doing', 'in-progress', 'in_progress'];

  for (const card of kanban) {
    if (!card.column || !OVERDUE_COLS.includes(card.column.toLowerCase())) continue;
    const lastChange = card.updatedAt ?? card.createdAt;
    if (!lastChange) continue;
    const age = Math.floor((now.getTime() - new Date(lastChange).getTime()) / 86_400_000);
    if (age >= STUCK_THRESHOLD_DAYS) {
      suggestions.push({
        id: `kanban-stuck-${card.id}`,
        type: 'stuck',
        module: 'kanban',
        title: card.title,
        detail: `In "${card.column}" for ${age} day${age !== 1 ? 's' : ''}`,
        href: '/kanban',
        itemDate: lastChange,
      });
    }

    // Also flag overdue due dates on any non-archived/done card
    if (card.dueDate && card.column !== 'done' && card.column !== 'archive') {
      if (card.dueDate < now.toISOString().slice(0, 10)) {
        const daysDue = Math.floor((now.getTime() - new Date(card.dueDate + 'T23:59:59').getTime()) / 86_400_000);
        suggestions.push({
          id: `kanban-overdue-${card.id}`,
          type: 'overdue',
          module: 'kanban',
          title: card.title,
          detail: `Due date passed ${daysDue} day${daysDue !== 1 ? 's' : ''} ago`,
          href: '/kanban',
          itemDate: card.dueDate,
        });
      }
    }
  }

  // ── Notes not updated in 30+ days ─────────────────────────────────────────
  const NOTES_DIR = PATHS.notes;
  const STALE_NOTE_DAYS = 30;
  if (fs.existsSync(NOTES_DIR)) {
    const noteFiles = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith('.json'));
    for (const file of noteFiles) {
      try {
        const raw = JSON.parse(fs.readFileSync(`${NOTES_DIR}/${file}`, 'utf-8'));
        const title: string = raw.title ?? file.replace('.json', '');
        const updatedAt: string | undefined = raw.updatedAt ?? raw.createdAt;
        if (!updatedAt) continue;
        const age = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 86_400_000);
        if (age >= STALE_NOTE_DAYS) {
          suggestions.push({
            id: `note-stale-${file}`,
            type: 'stale',
            module: 'note',
            title,
            detail: `Not updated in ${age} days`,
            href: '/notes',
            itemDate: updatedAt,
          });
        }
      } catch {
        // skip unreadable notes
      }
    }
  }

  // Sort: overdue first, then stuck, then stale; within each type by oldest first
  const TYPE_ORDER: Record<Suggestion['type'], number> = {
    overdue: 0,
    stuck: 1,
    stale: 2,
    'dead-link': 3,
  };
  suggestions.sort((a, b) => {
    const typeOrder = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (typeOrder !== 0) return typeOrder;
    return (a.itemDate ?? '') < (b.itemDate ?? '') ? -1 : 1;
  });

  return json(suggestions);
};
