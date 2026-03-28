import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logHabit, unlogHabit } from '$lib/server/habits';

export const POST: RequestHandler = async ({ params, request }) => {
  const { date } = await request.json();
  if (!date) return json({ error: 'date required' }, { status: 400 });
  const ok = logHabit(params.id, date);
  return json({ ok });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const { date } = await request.json();
  if (!date) return json({ error: 'date required' }, { status: 400 });
  const ok = unlogHabit(params.id, date);
  return json({ ok });
};
