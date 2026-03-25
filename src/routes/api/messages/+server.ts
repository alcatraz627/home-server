import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { isMacOs, checkDbAccess, getConversations } from '$lib/server/messages';

export const GET: RequestHandler = async ({ url }) => {
  if (!isMacOs()) {
    return json({ available: false, reason: 'linux', conversations: [] });
  }

  const access = checkDbAccess();
  if (!access.ok) {
    return json({ available: false, reason: access.reason, conversations: [] });
  }

  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const conversations = getConversations(limit);

  return json({ available: true, conversations });
};
