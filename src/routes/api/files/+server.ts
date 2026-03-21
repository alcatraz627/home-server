import { json } from '@sveltejs/kit';
import { listFiles, saveFile } from '$lib/server/files';
import { setFileMetadata, getAllMetadata } from '$lib/server/metadata';
import type { RequestHandler } from './$types';

/** List files in the upload directory */
export const GET: RequestHandler = async ({ url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const files = await listFiles(subpath);
	const meta = getAllMetadata();

	// Merge metadata into file list
	const enriched = files.map(f => ({
		...f,
		meta: meta[f.name] || null
	}));

	return json(enriched);
};

/** Upload a file */
export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const subpath = formData.get('path') as string | null;

	if (!file) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	const info = await saveFile(file, subpath || undefined);

	// Record upload metadata — use X-Forwarded-For or remote address to identify device
	const forwarded = request.headers.get('x-forwarded-for');
	const uploadedFrom = forwarded || 'local';

	await setFileMetadata(info.name, {
		uploadedFrom,
		uploadedAt: new Date().toISOString()
	});

	return json(info, { status: 201 });
};
