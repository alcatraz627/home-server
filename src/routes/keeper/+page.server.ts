import { getRequests, getStats } from '$lib/server/keeper';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const requests = await getRequests();
  const stats = await getStats();
  return { requests, stats };
};
