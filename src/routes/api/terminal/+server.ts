import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessions } from '$lib/server/terminal';

export const GET: RequestHandler = async () => {
  const sessions = listSessions();
  return json({ sessions });
};
