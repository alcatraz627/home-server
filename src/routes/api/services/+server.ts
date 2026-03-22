import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import { getServiceStatuses, addService, removeService, checkAndRecord, checkAllServices } from '$lib/server/services';
import type { RequestHandler } from './$types';

/** Get all services with their current status */
export const GET: RequestHandler = async () => {
  const statuses = await getServiceStatuses();
  return json({ statuses });
};

/** Add/remove service or trigger check */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action } = body;

  if (action === 'add') {
    const config = await addService({
      name: body.name,
      url: body.url,
      interval: body.interval ?? 60,
      timeout: body.timeout ?? 5,
    });
    return json(config, { status: 201 });
  }

  if (action === 'remove') {
    if (!body.id) return json({ error: 'Missing id' }, { status: 400 });
    await removeService(body.id);
    return json({ ok: true });
  }

  if (action === 'check') {
    if (body.id) {
      try {
        const check = await checkAndRecord(body.id);
        return json(check);
      } catch (err: unknown) {
        return json({ error: errorMessage(err) }, { status: 400 });
      }
    }
    await checkAllServices();
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
