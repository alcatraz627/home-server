import { json } from '@sveltejs/kit';
import { dryRunBackup } from '$lib/server/backups';
import type { RequestHandler } from './$types';

/** Dry-run a backup to see what would transfer */
export const POST: RequestHandler = async ({ request }) => {
  const { configId } = await request.json();
  try {
    const result = await dryRunBackup(configId);
    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, { status: 400 });
  }
};
