import { json } from '@sveltejs/kit';
import { sendMessageToAgent } from '$lib/server/agent-runner';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request }) => {
  const id = (params as Record<string, string>).id;
  const { message } = await request.json();
  const sent = await sendMessageToAgent(id, message);
  if (!sent) {
    return json({ error: 'No running agent for this request' }, { status: 404 });
  }
  return json({ ok: true });
};
