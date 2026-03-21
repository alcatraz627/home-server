import { json } from '@sveltejs/kit';
import { sendSignal, getProcessDetail } from '$lib/server/processes';
import type { RequestHandler } from './$types';

/** Get detailed stats for a process (active tier — expensive) */
export const GET: RequestHandler = async ({ params }) => {
  const pid = parseInt(params.pid);
  const detail = getProcessDetail(pid);
  if (!detail) {
    return json({ error: 'Process not found or inaccessible' }, { status: 404 });
  }
  return json(detail);
};

/** Send a signal to a process */
export const DELETE: RequestHandler = async ({ params, url }) => {
  const pid = parseInt(params.pid);
  const signal = url.searchParams.get('signal') || 'TERM';
  const result = sendSignal(pid, signal);

  if (!result.ok) {
    return json({ error: result.error }, { status: 400 });
  }
  return new Response(null, { status: 204 });
};
