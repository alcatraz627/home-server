import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readTags, searchTags, ensureTag, releaseTag, updateTagColor } from '$lib/server/tags';

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q');
  if (q !== null) {
    return json(searchTags(q));
  }
  return json(readTags());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'ensure') {
    if (!body.name) return json({ error: 'name is required' }, { status: 400 });
    const tag = ensureTag(body.name, body.color ?? '');
    return json(tag);
  }

  if (body._action === 'release') {
    if (!body.name) return json({ error: 'name is required' }, { status: 400 });
    releaseTag(body.name);
    return json({ ok: true });
  }

  if (body._action === 'color') {
    if (!body.name || !body.color) return json({ error: 'name and color are required' }, { status: 400 });
    const tag = updateTagColor(body.name, body.color);
    return tag ? json(tag) : json({ error: 'Tag not found' }, { status: 404 });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
