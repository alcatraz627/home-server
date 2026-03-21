import type { PageServerLoad } from './$types';
import { getTaskStatuses } from '$lib/server/operator';
import { getBackupStatuses } from '$lib/server/backups';
import { getStats as getKeeperStats } from '$lib/server/keeper';
import { getSystemDiskUsage } from '$lib/server/operator';

export const load: PageServerLoad = async () => {
	const [taskStatuses, backupStatuses, keeperStats, disk] = await Promise.all([
		getTaskStatuses(),
		getBackupStatuses(),
		getKeeperStats(),
		Promise.resolve(getSystemDiskUsage())
	]);

	const runningTasks = taskStatuses.filter(t => t.isRunning).length;
	const failedTasks = taskStatuses.filter(t => t.lastRun?.status === 'failed' || t.lastRun?.status === 'timeout').length;
	const scheduledTasks = taskStatuses.filter(t => t.config.schedule).length;

	const lastBackupRun = backupStatuses
		.filter(b => b.lastRun)
		.sort((a, b) => new Date(b.lastRun!.startedAt).getTime() - new Date(a.lastRun!.startedAt).getTime())[0];

	return {
		dashboard: {
			tasks: {
				total: taskStatuses.length,
				running: runningTasks,
				failed: failedTasks,
				scheduled: scheduledTasks
			},
			backups: {
				total: backupStatuses.length,
				lastRun: lastBackupRun?.lastRun ? {
					name: lastBackupRun.config.name,
					status: lastBackupRun.lastRun.status,
					time: lastBackupRun.lastRun.startedAt
				} : null
			},
			keeper: keeperStats,
			disk: disk.slice(0, 4)
		}
	};
};
