import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession, getSession, renameSession } from '$lib/server/terminal';

export const GET: RequestHandler = async ({ params }) => {
  const { sessionId } = params;
  const session = getSession(sessionId);
  if (!session) {
    return json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  return json({
    id: session.id,
    label: session.label,
    pid: session.pid,
    clientCount: session.clientCount,
    uptime: Math.floor((Date.now() - session.createdAt.getTime()) / 1000),
  });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { sessionId } = params;
  const session = getSession(sessionId);
  if (!session) {
    return json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  const body = await request.json();
  if (body.label && typeof body.label === 'string') {
    renameSession(sessionId, body.label.trim().slice(0, 64));
    return json({ ok: true });
  }
  return json({ ok: false, error: 'Invalid body' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { sessionId } = params;
  const session = getSession(sessionId);
  if (!session) {
    return json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  destroySession(sessionId);
  return json({ ok: true });
};
