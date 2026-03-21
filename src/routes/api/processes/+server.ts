import { json } from '@sveltejs/kit';
import { listProcesses } from '$lib/server/processes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const sort = url.searchParams.get('sort') || 'cpu';
  const processes = listProcesses(sort);
  return json(processes);
};
