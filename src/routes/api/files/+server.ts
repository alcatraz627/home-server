import { json } from '@sveltejs/kit';
import { listFiles, saveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/** List files in the upload directory */
export const GET: RequestHandler = async ({ url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const files = await listFiles(subpath);
	return json(files);
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
	return json(info, { status: 201 });
};
