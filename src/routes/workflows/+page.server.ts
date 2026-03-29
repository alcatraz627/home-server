import type { PageServerLoad } from './$types';
import { readActivity } from '$lib/server/activity';
import { readLinks } from '$lib/server/links';
import { getStats as getKeeperStats } from '$lib/server/keeper';
import { getUnreadCount as getNotifCount } from '$lib/server/notifications';
import fs from 'node:fs';
import { PATHS } from '$lib/server/paths';

export const load: PageServerLoad = async () => {
  const [keeperStats, notifCount] = await Promise.all([getKeeperStats(), getNotifCount()]);

  // Kanban
  let kanban = { todo: 0, doing: 0, done: 0, archive: 0, total: 0, overdue: 0 };
  try {
    if (fs.existsSync(PATHS.kanban)) {
      const cards = JSON.parse(fs.readFileSync(PATHS.kanban, 'utf-8'));
      if (Array.isArray(cards)) {
        const now = new Date();
        kanban.todo = cards.filter((c: any) => c.column === 'todo').length;
        kanban.doing = cards.filter((c: any) => c.column === 'doing').length;
        kanban.done = cards.filter((c: any) => c.column === 'done').length;
        kanban.archive = cards.filter((c: any) => c.column === 'archive').length;
        kanban.total = cards.length;
        kanban.overdue = cards.filter(
          (c: any) => c.dueDate && new Date(c.dueDate) < now && c.column !== 'done' && c.column !== 'archive',
        ).length;
      }
    }
  } catch {}

  // Reminders
  let reminders = { upcoming: 0, overdue: 0, snoozed: 0, fired: 0, total: 0 };
  try {
    if (fs.existsSync(PATHS.reminders)) {
      const items = JSON.parse(fs.readFileSync(PATHS.reminders, 'utf-8'));
      const now = new Date();
      if (Array.isArray(items)) {
        reminders.total = items.length;
        reminders.fired = items.filter((r: any) => r.fired).length;
        reminders.snoozed = items.filter((r: any) => r.snoozedUntil && !r.fired).length;
        reminders.overdue = items.filter((r: any) => !r.fired && new Date(r.datetime) < now).length;
        reminders.upcoming = items.filter((r: any) => !r.fired).length;
      }
    }
  } catch {}

  // Notes
  let notes = { total: 0, withChildren: 0 };
  try {
    const dir = PATHS.notes;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      notes.total = files.length;
      notes.withChildren = files.filter((f) => {
        try {
          const n = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf-8'));
          return n.parentId;
        } catch {
          return false;
        }
      }).length;
    }
  } catch {}

  // Bookmarks
  let bookmarks = { total: 0, tags: 0 };
  try {
    if (fs.existsSync(PATHS.bookmarks)) {
      const items = JSON.parse(fs.readFileSync(PATHS.bookmarks, 'utf-8'));
      if (Array.isArray(items)) {
        bookmarks.total = items.length;
        const tagSet = new Set<string>();
        items.forEach((b: any) => b.tags?.forEach((t: string) => tagSet.add(t)));
        bookmarks.tags = tagSet.size;
      }
    }
  } catch {}

  // Keeper — statuses: draft, ready, running, halted, done
  const keeperOpen =
    (keeperStats.draft ?? 0) + (keeperStats.ready ?? 0) + (keeperStats.running ?? 0) + (keeperStats.halted ?? 0);
  const keeperDone = keeperStats.done ?? 0;
  const keeper = { open: keeperOpen, done: keeperDone, total: keeperOpen + keeperDone };

  // Cross-links
  const allLinks = readLinks();
  const linksByModule: Record<string, number> = {};
  for (const l of allLinks) {
    linksByModule[l.sourceType] = (linksByModule[l.sourceType] || 0) + 1;
    linksByModule[l.targetType] = (linksByModule[l.targetType] || 0) + 1;
  }

  // Activity (last 7 days)
  const events = readActivity();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentEvents = events.filter((e) => new Date(e.timestamp) >= weekAgo);

  // Activity by day
  const activityByDay: Record<string, number> = {};
  for (const e of recentEvents) {
    const day = e.timestamp.slice(0, 10);
    activityByDay[day] = (activityByDay[day] || 0) + 1;
  }

  // Activity by module
  const activityByModule: Record<string, number> = {};
  for (const e of recentEvents) {
    activityByModule[e.module] = (activityByModule[e.module] || 0) + 1;
  }

  return {
    kanban,
    reminders,
    notes,
    bookmarks,
    keeper,
    notifications: notifCount,
    links: { total: allLinks.length, byModule: linksByModule },
    activity: {
      total: recentEvents.length,
      byDay: activityByDay,
      byModule: activityByModule,
      recent: recentEvents.slice(0, 15),
    },
  };
};
