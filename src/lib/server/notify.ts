import { env } from '$env/dynamic/private';
import { NTFY_DEFAULT_SERVER } from '$lib/constants/limits';
import { createLogger } from './logger';

const log = createLogger('notify');

/**
 * Notification service — sends push notifications via ntfy.sh.
 *
 * Set NTFY_TOPIC in .env to enable (e.g., NTFY_TOPIC=home-server-alerts).
 * Optionally set NTFY_SERVER for self-hosted (defaults to https://ntfy.sh).
 */

export interface Notification {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}

export function isNotifyConfigured(): boolean {
  return !!env.NTFY_TOPIC;
}

export async function sendNotification(notification: Notification): Promise<boolean> {
  const topic = env.NTFY_TOPIC;
  if (!topic) return false;

  const server = env.NTFY_SERVER || NTFY_DEFAULT_SERVER;
  const url = `${server}/${topic}`;

  try {
    const headers: Record<string, string> = {
      Title: notification.title,
      Priority: notification.priority || 'default',
    };

    if (notification.tags?.length) {
      headers['Tags'] = notification.tags.join(',');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: notification.message,
    });

    if (res.ok) {
      log.info('Notification sent', { title: notification.title, priority: notification.priority });
    } else {
      log.warn('Notification send failed', { title: notification.title, status: res.status });
    }

    return res.ok;
  } catch (err) {
    log.error('Notification send error', err instanceof Error ? err : { title: notification.title });
    return false;
  }
}

/** Send a task completion notification */
export async function notifyTaskComplete(
  taskName: string,
  status: 'success' | 'failed' | 'timeout',
  duration?: number,
): Promise<void> {
  const durationStr = duration ? ` (${(duration / 1000).toFixed(1)}s)` : '';

  if (status === 'success') {
    await sendNotification({
      title: `Task succeeded: ${taskName}`,
      message: `Completed successfully${durationStr}`,
      priority: 'low',
      tags: ['white_check_mark'],
    });
  } else {
    await sendNotification({
      title: `Task ${status}: ${taskName}`,
      message: `Task ${status}${durationStr}`,
      priority: 'high',
      tags: ['x'],
    });
  }
}

/** Send a backup completion notification */
export async function notifyBackupComplete(backupName: string, success: boolean, detail?: string): Promise<void> {
  await sendNotification({
    title: success ? `Backup succeeded: ${backupName}` : `Backup failed: ${backupName}`,
    message: detail || (success ? 'Backup completed successfully' : 'Backup failed — check logs'),
    priority: success ? 'low' : 'high',
    tags: [success ? 'floppy_disk' : 'warning'],
  });
}
