import { json } from '@sveltejs/kit';
import { getFileStream, deleteFile, renameFile, getMime } from '$lib/server/files';
import type { RequestHandler } from './$types';

/** Download or preview a file */
export const GET: RequestHandler = async ({ params, url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const preview = url.searchParams.get('preview') === 'true';
	const result = getFileStream(params.filename, subpath);

	if (!result) {
		return json({ error: 'File not found' }, { status: 404 });
	}

	const mime = getMime(params.filename);
	const disposition = preview ? 'inline' : `attachment; filename="${encodeURIComponent(result.name)}"`;

	return new Response(result.stream, {
		headers: {
			'Content-Type': preview ? mime : 'application/octet-stream',
			'Content-Disposition': disposition,
			'Content-Length': String(result.size)
		}
	});
};

/** Rename a file */
export const PATCH: RequestHandler = async ({ params, request, url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const body = await request.json();
	const newName = body.name;

	if (!newName || typeof newName !== 'string') {
		return json({ error: 'New name is required' }, { status: 400 });
	}

	const renamed = await renameFile(params.filename, newName, subpath);
	if (!renamed) {
		return json({ error: 'Rename failed' }, { status: 400 });
	}

	return json({ ok: true, name: newName });
};

/** Delete a file */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const deleted = await deleteFile(params.filename, subpath);

	if (!deleted) {
		return json({ error: 'File not found' }, { status: 404 });
	}

	return new Response(null, { status: 204 });
};
