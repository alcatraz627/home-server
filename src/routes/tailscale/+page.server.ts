import { getTailscaleStatus } from '$lib/server/tailscale';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return getTailscaleStatus();
};
