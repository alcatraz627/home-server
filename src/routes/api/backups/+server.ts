import { json } from '@sveltejs/kit';
import { getBackupStatuses, saveBackupConfig, runBackup, isRsyncAvailable } from '$lib/server/backups';
import type { BackupConfig } from '$lib/server/backups';
import type { RequestHandler } from './$types';

/** Get all backup statuses */
export const GET: RequestHandler = async () => {
	const statuses = await getBackupStatuses();
	const rsyncAvailable = isRsyncAvailable();
	return json({ statuses, rsyncAvailable });
};

/** Create or update a backup config */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const config: BackupConfig = {
		id: body.id || Math.random().toString(36).slice(2, 10),
		name: body.name,
		sourcePath: body.sourcePath,
		destPath: body.destPath,
		schedule: body.schedule || null,
		excludes: body.excludes || [],
		enabled: body.enabled ?? true
	};
	await saveBackupConfig(config);
	return json(config, { status: 201 });
};

/** Trigger a backup run */
export const PUT: RequestHandler = async ({ request }) => {
	const { configId } = await request.json();
	try {
		const run = await runBackup(configId);
		return json(run);
	} catch (err: any) {
		return json({ error: err.message }, { status: 400 });
	}
};
