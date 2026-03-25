import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDirectorySize } from '$lib/server/files';

/** GET /api/files/size?name=<dir>&path=<subpath>
 *  Returns the recursive size of a directory in bytes.
 */
export const GET: RequestHandler = async ({ url }) => {
  const name = url.searchParams.get('name');
  if (!name) return json({ error: 'name required' }, { status: 400 });
  const subpath = url.searchParams.get('path') || undefined;

  const bytes = await getDirectorySize(name, subpath);
  return json({ bytes });
};
