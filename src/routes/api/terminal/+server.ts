import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  let ptyAvailable = false;
  let error = '';

  try {
    await import('node-pty');
    ptyAvailable = true;
  } catch (e: any) {
    error = e.message;
  }

  return json({
    status: ptyAvailable ? 'ok' : 'error',
    ptyAvailable,
    error: error || undefined,
    hint: 'Terminal requires the dev server (npm run dev) to be running. WebSocket connects at /ws/terminal.',
  });
};
