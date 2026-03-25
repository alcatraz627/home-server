import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { isMacOs, checkDbAccess, getKnownContacts } from '$lib/server/messages';

export const GET: RequestHandler = async () => {
  if (!isMacOs() || !checkDbAccess().ok) {
    return json({ contacts: [] });
  }
  const contacts = getKnownContacts(200);
  return json({ contacts });
};
