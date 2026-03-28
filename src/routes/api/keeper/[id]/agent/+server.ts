import { json } from '@sveltejs/kit';
import { startAgent, stopAgent, resumeAgent, isAgentRunning, getActiveAgent } from '$lib/server/agent-runner';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request }) => {
  const id = (params as Record<string, string>).id;
  const { action, followUp } = await request.json();

  if (action === 'start') {
    const result = await startAgent(id);
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true });
  }

  if (action === 'stop') {
    const stopped = await stopAgent(id);
    if (!stopped) {
      return json({ error: 'No running agent for this request' }, { status: 404 });
    }
    return json({ ok: true });
  }

  if (action === 'resume') {
    const result = await resumeAgent(id, followUp);
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true });
  }

  return json({ error: 'Invalid action. Use start, stop, or resume.' }, { status: 400 });
};

export const GET: RequestHandler = async ({ params }) => {
  const id = (params as Record<string, string>).id;
  const running = isAgentRunning(id);
  const agent = getActiveAgent(id);
  return json({
    running,
    startedAt: agent?.startedAt || null,
  });
};
