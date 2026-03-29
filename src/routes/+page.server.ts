import type { PageServerLoad } from './$types';
import { getTaskStatuses } from '$lib/server/operator';
import { getBackupStatuses } from '$lib/server/backups';
import { getStats as getKeeperStats } from '$lib/server/keeper';
import { getSystemDiskUsage } from '$lib/server/operator';
import { listProcesses } from '$lib/server/processes';
import { getUnreadCount as getNotifCount } from '$lib/server/notifications';
import { readActivity } from '$lib/server/activity';
import fs from 'node:fs';
import { PATHS } from '$lib/server/paths';

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
      notifications: await getNotifCount(),
      notes: countNotes(),
      docker: countDocker(),
      services: countServices(),
      productivity: getProductivityStats(),
    },
  };
};

function countNotes(): number {
  try {
    const dir = PATHS.notes;
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function countDocker(): { running: number; total: number } {
  try {
    const { execSync } = require('child_process');
    const out = execSync('docker ps -a --format "{{.State}}" 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
    const lines = out.trim().split('\n').filter(Boolean);
    return { running: lines.filter((l: string) => l === 'running').length, total: lines.length };
  } catch {
    return { running: 0, total: 0 };
  }
}

function countServices(): { healthy: number; total: number } {
  try {
    const file = PATHS.services;
    if (!fs.existsSync(file)) return { healthy: 0, total: 0 };
    const services = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { healthy: services.filter((s: any) => s.enabled !== false).length, total: services.length };
  } catch {
    return { healthy: 0, total: 0 };
  }
}

function getProductivityStats(): {
  kanbanActive: number;
  kanbanDone: number;
  remindersUpcoming: number;
  remindersOverdue: number;
  notesCount: number;
  bookmarksCount: number;
  activityToday: number;
} {
  try {
    // Kanban
    let kanbanActive = 0,
      kanbanDone = 0;
    if (fs.existsSync(PATHS.kanban)) {
      const cards = JSON.parse(fs.readFileSync(PATHS.kanban, 'utf-8'));
      if (Array.isArray(cards)) {
        kanbanActive = cards.filter((c: any) => c.column === 'todo' || c.column === 'doing').length;
        kanbanDone = cards.filter((c: any) => c.column === 'done').length;
      }
    }

    // Reminders
    let remindersUpcoming = 0,
      remindersOverdue = 0;
    if (fs.existsSync(PATHS.reminders)) {
      const reminders = JSON.parse(fs.readFileSync(PATHS.reminders, 'utf-8'));
      const now = new Date();
      if (Array.isArray(reminders)) {
        remindersUpcoming = reminders.filter((r: any) => !r.fired).length;
        remindersOverdue = reminders.filter((r: any) => !r.fired && new Date(r.datetime) < now).length;
      }
    }

    // Notes
    const notesCount = countNotes();

    // Bookmarks
    let bookmarksCount = 0;
    if (fs.existsSync(PATHS.bookmarks)) {
      const bookmarks = JSON.parse(fs.readFileSync(PATHS.bookmarks, 'utf-8'));
      bookmarksCount = Array.isArray(bookmarks) ? bookmarks.length : 0;
    }

    // Activity today
    const events = readActivity();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activityToday = events.filter((e) => new Date(e.timestamp) >= todayStart).length;

    return { kanbanActive, kanbanDone, remindersUpcoming, remindersOverdue, notesCount, bookmarksCount, activityToday };
  } catch {
    return {
      kanbanActive: 0,
      kanbanDone: 0,
      remindersUpcoming: 0,
      remindersOverdue: 0,
      notesCount: 0,
      bookmarksCount: 0,
      activityToday: 0,
    };
  }
}
