import { getRequests, getStats } from '$lib/server/keeper';
import { getRunningAgentIds } from '$lib/server/agent-runner';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const requests = await getRequests();
  const stats = await getStats();
  const runningAgents = getRunningAgentIds();
  return { requests, stats, runningAgents };
};
