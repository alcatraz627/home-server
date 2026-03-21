import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT = `You are an AI assistant embedded in the Home Server dashboard — a SvelteKit app that manages files, smart lights (Wiz), processes, Tailscale VPN, backups (rsync), scheduled tasks, and a terminal.

Help the user with:
- Understanding how features work
- Suggesting improvements
- Debugging issues
- Explaining server/system concepts

Keep responses concise (2-4 sentences for simple questions, more for complex ones). Use markdown for code snippets.`;

export const POST: RequestHandler = async ({ request }) => {
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return json(
      {
        reply:
          'ANTHROPIC_API_KEY is not set.\n\nTo enable AI chat, run the server with:\n```\nANTHROPIC_API_KEY=sk-ant-... npm run dev\n```\nOr add it to a `.env` file in the project root.',
      },
      { status: 200 },
    );
  }

  try {
    const { messages } = await request.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-10), // Keep last 10 messages for context
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ reply: `API error: ${res.status} — ${err}` }, { status: 200 });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || 'No response';

    return json({ reply });
  } catch (e: any) {
    return json({ reply: `Error: ${e.message}` }, { status: 200 });
  }
};
