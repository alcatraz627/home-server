import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLinksForItem, createLink, deleteLink, type LinkableModule } from '$lib/server/links';

const VALID_MODULES: LinkableModule[] = ['note', 'kanban', 'reminder', 'bookmark', 'keeper'];

function isValidModule(m: string): m is LinkableModule {
  return VALID_MODULES.includes(m as LinkableModule);
}

export const GET: RequestHandler = async ({ url }) => {
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  if (!type || !id || !isValidModule(type)) {
    return json(
      { error: 'type and id are required, type must be one of: ' + VALID_MODULES.join(', ') },
      { status: 400 },
    );
  }

  return json(getLinksForItem(type, id));
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'delete') {
    const ok = deleteLink(body.id);
    return ok ? json({ ok: true }) : json({ error: 'Not found' }, { status: 404 });
  }

  // Create link
  const { sourceType, sourceId, targetType, targetId, label } = body;
  if (!sourceType || !sourceId || !targetType || !targetId) {
    return json({ error: 'sourceType, sourceId, targetType, targetId are required' }, { status: 400 });
  }
  if (!isValidModule(sourceType) || !isValidModule(targetType)) {
    return json({ error: 'Invalid module type' }, { status: 400 });
  }

  const link = createLink(sourceType, sourceId, targetType, targetId, label);
  return json(link, { status: 201 });
};
