import { getBackupStatuses, isRsyncAvailable } from '$lib/server/backups';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const statuses = await getBackupStatuses();
  const rsyncAvailable = isRsyncAvailable();
  return { statuses, rsyncAvailable };
};
