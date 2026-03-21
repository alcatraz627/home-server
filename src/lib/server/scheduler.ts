import cron, { type ScheduledTask } from 'node-cron';
import { getTaskConfigs, runTask } from './operator';
import { getBackupConfigs, runBackup } from './backups';
import { notifyTaskComplete, notifyBackupComplete, isNotifyConfigured } from './notify';

const scheduledJobs = new Map<string, ScheduledTask>();

/** Start all scheduled tasks and backups */
export async function startScheduler(): Promise<void> {
  await scheduleAll();
  console.log(
    `Scheduler started (notifications ${isNotifyConfigured() ? 'enabled' : 'disabled — set NTFY_TOPIC in .env'})`,
  );
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
        console.log(`[scheduler] Running task: ${task.name}`);
        try {
          const run = await runTask(task.id);
          // Wait for completion by polling
          await waitForCompletion(task.id, 'task');
        } catch (err: any) {
          console.error(`[scheduler] Task ${task.name} failed to start: ${err.message}`);
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
        console.log(`[scheduler] Running backup: ${backup.name}`);
        try {
          await runBackup(backup.id);
          await waitForCompletion(backup.id, 'backup');
        } catch (err: any) {
          console.error(`[scheduler] Backup ${backup.name} failed to start: ${err.message}`);
        }
      });
      scheduledJobs.set(`backup:${backup.id}`, job);
    }
  }

  console.log(`[scheduler] ${scheduledJobs.size} jobs scheduled`);
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

/** Get list of currently scheduled jobs */
export function getScheduledJobs(): { id: string; running: boolean }[] {
  return Array.from(scheduledJobs.entries()).map(([id]) => ({
    id,
    running: true,
  }));
}
