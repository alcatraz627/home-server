import { json } from '@sveltejs/kit';
import { getRequests, createRequest, updateRequest, deleteRequest, getStats } from '$lib/server/keeper';
import { getRunningAgentIds } from '$lib/server/agent-runner';
import { isCommandAvailable } from '$lib/server/security';
import { addActivity } from '$lib/server/activity';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const requests = await getRequests();
  const stats = await getStats();
  const runningAgents = getRunningAgentIds();
  const claudeAvailable = isCommandAvailable('claude');
  return json({ requests, stats, runningAgents, claudeAvailable });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const created = await createRequest(body);
  addActivity('create', 'keeper', created.id, created.title);
  return json(created, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  const updated = await updateRequest(id, updates);
  if (!updated) return json({ error: 'Not found' }, { status: 404 });
  const action = updates.status === 'done' ? 'complete' : 'update';
  addActivity(action, 'keeper', updated.id, updated.title);
  return json(updated);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  const requests = await getRequests();
  const target = requests.find((r) => r.id === id);
  const deleted = await deleteRequest(id);
  if (!deleted) return json({ error: 'Not found' }, { status: 404 });
  if (target) addActivity('delete', 'keeper', target.id, target.title);
  return new Response(null, { status: 204 });
};
