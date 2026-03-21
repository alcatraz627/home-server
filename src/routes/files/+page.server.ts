import { listFiles } from '$lib/server/files';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const subpath = url.searchParams.get('path') || undefined;
  const files = await listFiles(subpath);
  return { files, currentPath: subpath || '' };
};
