import { listProcesses } from '$lib/server/processes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const sort = url.searchParams.get('sort') || 'cpu';
  const processes = listProcesses(sort);
  return { processes };
};
