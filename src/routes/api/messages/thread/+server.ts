import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { isMacOs, isAvailable, getMessages, sendMessage } from '$lib/server/messages';

export const GET: RequestHandler = async ({ url }) => {
  if (!isMacOs() || !isAvailable()) {
    return json({ messages: [] });
  }

  const handle = url.searchParams.get('handle') || '';
  if (!handle) return json({ error: 'handle required' }, { status: 400 });

  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
  const before = url.searchParams.get('before') ? Number(url.searchParams.get('before')) : undefined;

  const messages = getMessages(handle, limit, before);
  return json({ messages });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!isMacOs()) return json({ error: 'iMessage requires macOS' }, { status: 403 });

  let body: { handle?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { handle, text } = body;
  if (!handle || !text?.trim()) {
    return json({ error: 'handle and text are required' }, { status: 400 });
  }

  const result = await sendMessage(handle, text.trim());
  if (!result.ok) return json({ error: result.error }, { status: 500 });
  return json({ ok: true });
};
