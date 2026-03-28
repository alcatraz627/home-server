import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  readReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  snoozeReminder,
  popPendingBrowserReminders,
} from '$lib/server/reminders';

export const GET: RequestHandler = async ({ url }) => {
  // Poll for browser notifications that need to be shown
  if (url.searchParams.get('pending') === '1') {
    return json({ pending: popPendingBrowserReminders() });
  }
  return json(readReminders());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'delete') {
    const ok = deleteReminder(body.id);
    return ok ? json({ ok: true }) : json({ error: 'Not found' }, { status: 404 });
  }

  if (body._action === 'snooze') {
    const r = snoozeReminder(body.id, body.minutes ?? 10);
    return r ? json(r) : json({ error: 'Not found' }, { status: 404 });
  }

  if (body._action === 'update') {
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.datetime !== undefined) updates.datetime = body.datetime;
    if (body.channels !== undefined) updates.channels = body.channels;
    if (body.fired !== undefined) updates.fired = body.fired;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.recurrence !== undefined) updates.recurrence = body.recurrence;
    const r = updateReminder(body.id, updates);
    return r ? json(r) : json({ error: 'Not found' }, { status: 404 });
  }

  // Create
  if (!body.title || !body.datetime) {
    return json({ error: 'title and datetime are required' }, { status: 400 });
  }
  const reminder = createReminder(
    body.title,
    body.datetime,
    body.channels ?? ['browser'],
    body.description ?? '',
    body.priority ?? 'normal',
    body.recurrence ?? null,
  );
  return json(reminder, { status: 201 });
};
