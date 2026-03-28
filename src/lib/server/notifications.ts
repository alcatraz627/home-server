import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';
import { createLogger } from './logger';

const log = createLogger('notifications');

// --- Types ---

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationSource = 'backup' | 'task' | 'service' | 'system' | 'agent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  source: NotificationSource;
  timestamp: string;
  read: boolean;
}

// --- Storage ---

const NOTIFICATIONS_FILE = PATHS.notifications;

async function ensureDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

// --- CRUD ---

export async function getNotifications(): Promise<AppNotification[]> {
  await ensureDir();
  if (!existsSync(NOTIFICATIONS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function saveNotifications(notifications: AppNotification[]): Promise<void> {
  await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

export async function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  source: NotificationSource,
): Promise<AppNotification> {
  const notifications = await getNotifications();
  const notification: AppNotification = {
    id: `${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
    type,
    title,
    message,
    source,
    timestamp: new Date().toISOString(),
    read: false,
  };

  notifications.unshift(notification);
  // Keep last 200
  const trimmed = notifications.slice(0, 200);
  await saveNotifications(trimmed);

  log.info('Notification added', { type, title, source });
  return notification;
}

export async function markAsRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const n = notifications.find((n) => n.id === id);
  if (n) {
    n.read = true;
    await saveNotifications(notifications);
  }
}

export async function markAllRead(): Promise<void> {
  const notifications = await getNotifications();
  for (const n of notifications) {
    n.read = true;
  }
  await saveNotifications(notifications);
}

export async function clearAll(): Promise<void> {
  await saveNotifications([]);
  log.info('All notifications cleared');
}

export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications();
  return notifications.filter((n) => !n.read).length;
}
