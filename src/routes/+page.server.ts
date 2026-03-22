import type { PageServerLoad } from './$types';
import { getTaskStatuses } from '$lib/server/operator';
import { getBackupStatuses } from '$lib/server/backups';
import { getStats as getKeeperStats } from '$lib/server/keeper';
import { getSystemDiskUsage } from '$lib/server/operator';
import { listProcesses } from '$lib/server/processes';

export const load: PageServerLoad = async () => {
  const [taskStatuses, backupStatuses, keeperStats, disk] = await Promise.all([
    getTaskStatuses(),
    getBackupStatuses(),
    getKeeperStats(),
    Promise.resolve(getSystemDiskUsage()),
  ]);

  const runningTasks = taskStatuses.filter((t) => t.isRunning).length;
  const failedTasks = taskStatuses.filter(
    (t) => t.lastRun?.status === 'failed' || t.lastRun?.status === 'timeout',
  ).length;
  const scheduledTasks = taskStatuses.filter((t) => t.config.schedule).length;

  const lastBackupRun = backupStatuses
    .filter((b) => b.lastRun)
    .sort((a, b) => new Date(b.lastRun!.startedAt).getTime() - new Date(a.lastRun!.startedAt).getTime())[0];

  // Recent task runs for activity timeline
  const recentRuns = taskStatuses
    .filter((t) => t.lastRun)
    .map((t) => ({
      name: t.config.name,
      status: t.lastRun!.status,
      time: t.lastRun!.startedAt,
      duration: t.lastRun!.duration,
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  // Process summary (top 5 by CPU)
  let topProcesses: { name: string; cpu: number; mem: number }[] = [];
  try {
    const procs = listProcesses('cpu');
    topProcesses = procs.slice(0, 5).map((p) => ({ name: p.name, cpu: p.cpu, mem: p.mem }));
  } catch {}

  return {
    dashboard: {
      tasks: {
        total: taskStatuses.length,
        running: runningTasks,
        failed: failedTasks,
        scheduled: scheduledTasks,
      },
      backups: {
        total: backupStatuses.length,
        lastRun: lastBackupRun?.lastRun
          ? {
              name: lastBackupRun.config.name,
              status: lastBackupRun.lastRun.status,
              time: lastBackupRun.lastRun.startedAt,
            }
          : null,
      },
      keeper: keeperStats,
      disk: disk.slice(0, 4),
      recentRuns,
      topProcesses,
    },
  };
};
