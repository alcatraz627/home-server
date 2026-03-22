import cron, { type ScheduledTask } from 'node-cron';
import { errorMessage, errorCode } from '$lib/server/errors';
import { getTaskConfigs, runTask } from './operator';
import { getBackupConfigs, runBackup } from './backups';
import { notifyTaskComplete, notifyBackupComplete, isNotifyConfigured } from './notify';
import { createLogger } from './logger';

const log = createLogger('scheduler');

const scheduledJobs = new Map<string, ScheduledTask>();

/** Start all scheduled tasks and backups */
export async function startScheduler(): Promise<void> {
  await scheduleAll();
  log.info('Scheduler started', { notifications: isNotifyConfigured() ? 'enabled' : 'disabled' });
}

/** Re-scan configs and update scheduled jobs */
export async function scheduleAll(): Promise<void> {
  // Clear existing jobs
  for (const [id, job] of scheduledJobs) {
    job.stop();
    scheduledJobs.delete(id);
  }

  // Schedule tasks
  const tasks = await getTaskConfigs();
  for (const task of tasks) {
    if (task.schedule && task.enabled && cron.validate(task.schedule)) {
      const job = cron.schedule(task.schedule, async () => {
        log.info('Scheduled task executing', { taskId: task.id, name: task.name });
        try {
          const run = await runTask(task.id);
          // Wait for completion by polling
          await waitForCompletion(task.id, 'task');
        } catch (err: unknown) {
          log.error('Scheduled task failed to start', { taskId: task.id, name: task.name, error: errorMessage(err) });
        }
      });
      scheduledJobs.set(`task:${task.id}`, job);
    }
  }

  // Schedule backups
  const backups = await getBackupConfigs();
  for (const backup of backups) {
    if (backup.schedule && backup.enabled && cron.validate(backup.schedule)) {
      const job = cron.schedule(backup.schedule, async () => {
        log.info('Scheduled backup executing', { backupId: backup.id, name: backup.name });
        try {
          await runBackup(backup.id);
          await waitForCompletion(backup.id, 'backup');
        } catch (err: unknown) {
          log.error('Scheduled backup failed to start', {
            backupId: backup.id,
            name: backup.name,
            error: errorMessage(err),
          });
        }
      });
      scheduledJobs.set(`backup:${backup.id}`, job);
    }
  }

  // Schedule service health checks
  try {
    const { getServices, checkAndRecord } = await import('./services');
    const services = await getServices();
    for (const svc of services) {
      if (svc.interval > 0) {
        // Convert interval seconds to a cron-compatible schedule
        // For intervals < 60s, check every minute; otherwise use the interval
        const minutes = Math.max(1, Math.floor(svc.interval / 60));
        const cronExpr = minutes < 60 ? `*/${minutes} * * * *` : '0 * * * *';
        if (cron.validate(cronExpr)) {
          const job = cron.schedule(cronExpr, async () => {
            try {
              await checkAndRecord(svc.id);
            } catch (err: unknown) {
              log.error('Service check failed', { serviceId: svc.id, error: errorMessage(err) });
            }
          });
          scheduledJobs.set(`service:${svc.id}`, job);
        }
      }
    }
  } catch {
    // services module may not be available
  }

  log.info('Jobs scheduled', { count: scheduledJobs.size });
}

async function waitForCompletion(id: string, type: 'task' | 'backup'): Promise<void> {
  // Simple polling — check every 2s, max 30 min
  const maxAttempts = 900;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    if (type === 'task') {
      const { getTaskHistory } = await import('./operator');
      const history = await getTaskHistory(id);
      const last = history[history.length - 1];
      if (last && last.status !== 'running') {
        const configs = await getTaskConfigs();
        const config = configs.find((c) => c.id === id);
        if (config?.notify) {
          await notifyTaskComplete(config.name, last.status as any, last.duration || undefined);
        }
        return;
      }
    } else {
      const { getBackupHistory } = await import('./backups');
      const history = await getBackupHistory();
      const last = history.filter((r) => r.configId === id).pop();
      if (last && last.status !== 'running') {
        const configs = await getBackupConfigs();
        const config = configs.find((c) => c.id === id);
        if (config) {
          await notifyBackupComplete(
            config.name,
            last.status === 'success',
            last.status === 'success' ? `${last.filesTransferred} files transferred` : last.error || undefined,
          );
        }
        return;
      }
    }
  }
}

/** Remove a single task's cron job */
export function unscheduleTask(taskId: string): boolean {
  const key = `task:${taskId}`;
  const job = scheduledJobs.get(key);
  if (job) {
    job.stop();
    scheduledJobs.delete(key);
    log.info('Task unscheduled', { taskId });
    return true;
  }
  return false;
}

/** Get count of scheduled task cron jobs (excludes backups) */
export function getScheduledTaskCount(): number {
  let count = 0;
  for (const key of scheduledJobs.keys()) {
    if (key.startsWith('task:')) count++;
  }
  return count;
}

/** Get list of currently scheduled jobs */
export function getScheduledJobs(): { id: string; running: boolean }[] {
  return Array.from(scheduledJobs.entries()).map(([id]) => ({
    id,
    running: true,
  }));
}
