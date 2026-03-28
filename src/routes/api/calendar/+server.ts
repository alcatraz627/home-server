import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import { PATHS } from '$lib/server/paths';
export interface CalendarItem {
  id: string;
  module: 'kanban' | 'reminder';
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM for reminders
  color?: string;
  href: string;
  meta?: string; // priority, status, etc.
  done?: boolean; // kanban done column, or fired reminder
}

function readJson<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T[];
  } catch {
    return [];
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to'); // YYYY-MM-DD

  const items: CalendarItem[] = [];

  // Kanban cards with due dates
  const kanban = readJson<{
    id: string;
    title: string;
    dueDate?: string | null;
    color?: string;
    priority?: string;
    column?: string;
  }>(PATHS.kanban);
  for (const card of kanban) {
    if (!card.dueDate || card.column === 'archive') continue;
    if (from && card.dueDate < from) continue;
    if (to && card.dueDate > to) continue;
    items.push({
      id: `kanban-${card.id}`,
      module: 'kanban',
      title: card.title,
      date: card.dueDate,
      color: card.color || undefined,
      href: '/kanban',
      meta: card.priority || undefined,
      done: card.column === 'done',
    });
  }

  // Reminders
  const reminders = readJson<{ id: string; title: string; datetime: string; fired?: boolean }>(PATHS.reminders);
  for (const r of reminders) {
    const d = new Date(r.datetime);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (from && dateStr < from) continue;
    if (to && dateStr > to) continue;
    items.push({
      id: `reminder-${r.id}`,
      module: 'reminder',
      title: r.title,
      date: dateStr,
      time: timeStr,
      href: '/reminders',
      done: !!r.fired,
    });
  }

  // Sort by date + time
  items.sort((a, b) => {
    const da = a.date + (a.time ?? '00:00');
    const db = b.date + (b.time ?? '00:00');
    return da.localeCompare(db);
  });

  return json(items);
};
