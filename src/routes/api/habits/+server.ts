import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readHabits, readHabitLogs, createHabit, updateHabit, deleteHabit } from '$lib/server/habits';

export const GET: RequestHandler = async () => {
  const habits = readHabits().filter((h) => !h.archived);
  const logs = readHabitLogs();
  return json({ habits, logs });
};

export const POST: RequestHandler = async ({ request }) => {
  const { name, description, color } = await request.json();
  if (!name?.trim()) return json({ error: 'Name required' }, { status: 400 });
  const habit = createHabit(name.trim(), description ?? '', color ?? '');
  return json(habit, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  if (!id) return json({ error: 'id required' }, { status: 400 });
  const habit = updateHabit(id, updates);
  if (!habit) return json({ error: 'Not found' }, { status: 404 });
  return json(habit);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  if (!id) return json({ error: 'id required' }, { status: 400 });
  const ok = deleteHabit(id);
  return json({ ok });
};
