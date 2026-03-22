import { getServiceStatuses } from '$lib/server/services';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const statuses = await getServiceStatuses();
  return { statuses };
};
