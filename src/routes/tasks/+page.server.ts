import { getTaskStatuses, getSystemDiskUsage } from '$lib/server/operator';
import { getScheduledTaskCount } from '$lib/server/scheduler';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const statuses = await getTaskStatuses();
  const disk = getSystemDiskUsage();
  const scheduledCount = getScheduledTaskCount();
  return { statuses, disk, scheduledCount };
};
