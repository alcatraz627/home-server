import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { isAvailable, isMacOs, getConversations } from '$lib/server/messages';

export const GET: RequestHandler = async ({ url }) => {
  if (!isMacOs()) {
    return json({ available: false, platform: 'linux', conversations: [] });
  }
  if (!isAvailable()) {
    return json({ available: false, platform: 'darwin', reason: 'chat.db not found', conversations: [] });
  }

  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const conversations = getConversations(limit);

  return json({ available: true, conversations });
};
