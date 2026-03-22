import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession, getSession } from '$lib/server/terminal';

export const DELETE: RequestHandler = async ({ params }) => {
  const { sessionId } = params;
  const session = getSession(sessionId);
  if (!session) {
    return json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  destroySession(sessionId);
  return json({ ok: true });
};
