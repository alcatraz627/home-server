import { json } from '@sveltejs/kit';
import { discoverBulbs } from '$lib/server/wiz';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const bulbs = await discoverBulbs();
  return json(bulbs);
};
