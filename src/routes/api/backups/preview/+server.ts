import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import { dryRunBackup } from '$lib/server/backups';
import type { RequestHandler } from './$types';

/** Dry-run a backup to see what would transfer */
export const POST: RequestHandler = async ({ request }) => {
  const { configId } = await request.json();
  try {
    const result = await dryRunBackup(configId);
    return json(result);
  } catch (err: unknown) {
    return json({ error: errorMessage(err) }, { status: 400 });
  }
};
