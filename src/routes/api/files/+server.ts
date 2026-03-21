import { json } from '@sveltejs/kit';
import { listFiles, saveFile, saveFileWithPath, createDirectory } from '$lib/server/files';
import { setFileMetadata, getAllMetadata } from '$lib/server/metadata';
import type { RequestHandler } from './$types';

/** List files in the upload directory */
export const GET: RequestHandler = async ({ url }) => {
	const subpath = url.searchParams.get('path') || undefined;
	const files = await listFiles(subpath);
	const meta = getAllMetadata();

	const enriched = files.map(f => ({
		...f,
		meta: meta[f.name] || null
	}));

	return json(enriched);
};

/** Upload file(s) — supports single file, multiple files, and folder upload */
export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const subpath = formData.get('path') as string | null;
	const forwarded = request.headers.get('x-forwarded-for') || 'local';

	const uploaded: any[] = [];

	// Handle all file entries (multiple files or folder upload)
	for (const [key, value] of formData.entries()) {
		if (key === 'file' && value instanceof File) {
			const relativePath = formData.get(`relativePath_${uploaded.length}`) as string | null;

			let info;
			if (relativePath) {
				// Folder upload — preserve directory structure
				info = await saveFileWithPath(value, relativePath, subpath || undefined);
			} else {
				info = await saveFile(value, subpath || undefined);
			}

			await setFileMetadata(info.name, {
				uploadedFrom: forwarded,
				uploadedAt: new Date().toISOString()
			});

			uploaded.push(info);
		}
	}

	if (uploaded.length === 0) {
		return json({ error: 'No files provided' }, { status: 400 });
	}

	return json(uploaded.length === 1 ? uploaded[0] : uploaded, { status: 201 });
};

/** Create a directory */
export const PUT: RequestHandler = async ({ request }) => {
	const { name, path: subpath } = await request.json();
	if (!name) return json({ error: 'Directory name required' }, { status: 400 });

	const ok = await createDirectory(name, subpath || undefined);
	if (!ok) return json({ error: 'Failed to create directory' }, { status: 400 });
	return json({ ok: true, name }, { status: 201 });
};
