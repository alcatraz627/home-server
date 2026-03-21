import { json } from '@sveltejs/kit';
import { getBulbState, setBulbState } from '$lib/server/wiz';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const bulb = await getBulbState(params.ip);
  if (!bulb) return json({ error: 'Bulb not reachable' }, { status: 404 });
  return json(bulb);
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const ok = await setBulbState(params.ip, body);
  if (!ok) return json({ error: 'Failed to set bulb state' }, { status: 500 });
  const bulb = await getBulbState(params.ip);
  return json(bulb);
};
