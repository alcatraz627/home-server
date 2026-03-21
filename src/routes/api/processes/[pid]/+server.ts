import { json } from '@sveltejs/kit';
import { killProcess } from '$lib/server/processes';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, url }) => {
	const pid = parseInt(params.pid);
	const signal = url.searchParams.get('signal') || 'TERM';
	const result = killProcess(pid, signal);

	if (!result.ok) {
		return json({ error: result.error }, { status: 400 });
	}
	return new Response(null, { status: 204 });
};
