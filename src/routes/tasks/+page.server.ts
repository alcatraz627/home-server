import { getTaskStatuses, getSystemDiskUsage } from '$lib/server/operator';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const statuses = await getTaskStatuses();
	const disk = getSystemDiskUsage();
	return { statuses, disk };
};
