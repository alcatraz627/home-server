import crypto from 'node:crypto';
import fs from 'node:fs';
import { CONFIG_DIR, PATHS } from './paths';
import { createLogger } from './logger';
import { sendNotification, isNotifyConfigured } from './notify';
import { addNotification } from './notifications';
import type { Reminder, ReminderChannel, ReminderPriority, Recurrence } from '$lib/types/productivity';

export type { Reminder, ReminderChannel, ReminderPriority, Recurrence };

const log = createLogger('reminders');

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readReminders(): Reminder[] {
  ensureDir();
  if (!fs.existsSync(PATHS.reminders)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PATHS.reminders, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function writeReminders(reminders: Reminder[]) {
  ensureDir();
  fs.writeFileSync(PATHS.reminders, JSON.stringify(reminders, null, 2));
}

export function createReminder(
  title: string,
  datetime: string,
  channels: ReminderChannel[],
  description = '',
  priority: ReminderPriority = 'normal',
  recurrence: Recurrence | null = null,
): Reminder {
  const reminder: Reminder = {
    id: crypto.randomUUID().slice(0, 8),
    title,
    description,
    datetime,
    channels: channels.length ? channels : ['browser'],
    priority,
    fired: false,
    snoozedUntil: null,
    recurrence,
    createdAt: new Date().toISOString(),
  };
  const all = readReminders();
  all.push(reminder);
  writeReminders(all);
  log.info('Reminder created', { id: reminder.id, title, datetime });
  return reminder;
}

export function updateReminder(id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>): Reminder | null {
  const all = readReminders();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  Object.assign(all[idx], updates);
  writeReminders(all);
  return all[idx];
}

export function deleteReminder(id: string): boolean {
  const all = readReminders();
  const filtered = all.filter((r) => r.id !== id);
  if (filtered.length === all.length) return false;
  writeReminders(filtered);
  log.info('Reminder deleted', { id });
  return true;
}

export function snoozeReminder(id: string, minutes: number): Reminder | null {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  return updateReminder(id, { fired: false, snoozedUntil });
}

/** Pending reminders returned for SSE/browser push */
const pendingBrowserReminders: Reminder[] = [];

export function popPendingBrowserReminders(): Reminder[] {
  return pendingBrowserReminders.splice(0);
}

/**
 * Check all reminders and fire those that are due.
 * Called every minute by the scheduler cron.
 */
export async function checkReminders(): Promise<void> {
  const now = new Date();
  const all = readReminders();
  let changed = false;

  // Collect recurrences to create AFTER writing fired state,
  // otherwise createReminder's own write gets overwritten by writeReminders(all).
  const pendingRecurrences: { r: Reminder; nextDatetime: string }[] = [];

  for (const r of all) {
    if (r.fired) continue;

    const fireAt = r.snoozedUntil ? new Date(r.snoozedUntil) : new Date(r.datetime);
    if (fireAt > now) continue;

    // This reminder is due — fire it
    log.info('Reminder firing', { id: r.id, title: r.title });

    // In-app notification
    addNotification('info', `Reminder: ${r.title}`, r.description || r.title, 'system');

    // ntfy.sh push
    if (r.channels.includes('ntfy') && isNotifyConfigured()) {
      await sendNotification({
        title: `⏰ ${r.title}`,
        message: r.description || 'Reminder is due',
        priority: 'high',
        tags: ['alarm_clock'],
      });
    }

    // Queue for browser notification (polled by client)
    if (r.channels.includes('browser')) {
      pendingBrowserReminders.push(r);
    }

    r.fired = true;
    r.snoozedUntil = null;
    changed = true;

    // Queue next occurrence for recurring reminders
    if (r.recurrence) {
      const nextDatetime = computeNextOccurrence(r.datetime, r.recurrence);
      if (nextDatetime) {
        pendingRecurrences.push({ r, nextDatetime });
      }
    }
  }

  // Write fired state first, then create new reminders so their writes aren't clobbered
  if (changed) writeReminders(all);

  for (const { r, nextDatetime } of pendingRecurrences) {
    const next = createReminder(r.title, nextDatetime, r.channels, r.description, r.priority, r.recurrence);
    log.info('Recurring reminder created next occurrence', { parentId: r.id, nextId: next.id, nextDatetime });
  }
}

/** Compute the next occurrence datetime for a recurring reminder. Returns null if past endDate. */
function computeNextOccurrence(currentDatetime: string, recurrence: Recurrence): string | null {
  const current = new Date(currentDatetime);
  const interval = recurrence.interval ?? 1;
  let next: Date;

  switch (recurrence.pattern) {
    case 'daily':
      next = new Date(current);
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next = new Date(current);
      next.setDate(next.getDate() + 7 * interval);
      break;
    case 'monthly':
      next = new Date(current);
      next.setMonth(next.getMonth() + interval);
      break;
    case 'weekdays': {
      next = new Date(current);
      let daysAdded = 0;
      while (daysAdded < interval) {
        next.setDate(next.getDate() + 1);
        const dow = next.getDay();
        if (dow >= 1 && dow <= 5) daysAdded++;
      }
      break;
    }
    case 'custom':
      // Custom treats interval as days
      next = new Date(current);
      next.setDate(next.getDate() + interval);
      break;
    default:
      return null;
  }

  // Check endDate
  if (recurrence.endDate && next > new Date(recurrence.endDate)) {
    return null;
  }

  return next.toISOString();
}
