import { json } from '@sveltejs/kit';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

/** GET: generate random blob for download speed test */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  if (action === 'ping') {
    return json({ ts: Date.now() });
  }

  if (action === 'download') {
    const sizeKB = parseInt(url.searchParams.get('size') || '1024');
    const size = Math.min(sizeKB, 10240) * 1024; // max 10MB
    const data = crypto.randomBytes(size);
    return new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'Cache-Control': 'no-store',
      },
    });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};

/** POST: receive upload blob for upload speed test */
export const POST: RequestHandler = async ({ request }) => {
  const start = Date.now();
  const data = await request.arrayBuffer();
  const elapsed = Date.now() - start;

  return json({
    receivedBytes: data.byteLength,
    serverTime: elapsed,
    ts: Date.now(),
  });
};
