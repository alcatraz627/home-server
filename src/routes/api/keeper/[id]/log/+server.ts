import { json } from '@sveltejs/kit';
import { getLogContent } from '$lib/server/agent-runner';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = (params as Record<string, string>).id;
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const { content, size } = await getLogContent(id, offset);
  return json({ content, size });
};
