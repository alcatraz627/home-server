import { json } from '@sveltejs/kit';
import { getRequests, createRequest, updateRequest, deleteRequest, getStats } from '$lib/server/keeper';
import { getRunningAgentIds } from '$lib/server/agent-runner';
import { isCommandAvailable } from '$lib/server/security';
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
  return json(created, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  const updated = await updateRequest(id, updates);
  if (!updated) return json({ error: 'Not found' }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  const deleted = await deleteRequest(id);
  if (!deleted) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
