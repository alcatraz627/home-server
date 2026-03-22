import { json } from '@sveltejs/kit';
import { getNotifications, markAsRead, markAllRead, clearAll, getUnreadCount } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

/** Get recent notifications */
export const GET: RequestHandler = async () => {
  const notifications = await getNotifications();
  const unreadCount = await getUnreadCount();
  return json({ notifications, unreadCount });
};

/** Mark as read or clear all */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action } = body;

  if (action === 'markRead') {
    if (!body.id) return json({ error: 'Missing id' }, { status: 400 });
    await markAsRead(body.id);
    return json({ ok: true });
  }

  if (action === 'markAllRead') {
    await markAllRead();
    return json({ ok: true });
  }

  if (action === 'clearAll') {
    await clearAll();
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
