import { json } from '@sveltejs/kit';
import { getTailscaleStatus } from '$lib/server/tailscale';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const result = getTailscaleStatus();
  return json(result);
};
