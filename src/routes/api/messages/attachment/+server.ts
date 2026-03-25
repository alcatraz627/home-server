import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { isMacOs, isAvailable, getAttachment } from '$lib/server/messages';
import { createReadStream } from 'node:fs';

export const GET: RequestHandler = async ({ url }) => {
  if (!isMacOs() || !isAvailable()) throw error(404, 'Not available');

  const rowid = Number(url.searchParams.get('id'));
  if (!rowid || isNaN(rowid)) throw error(400, 'id required');

  const attachment = getAttachment(rowid);
  if (!attachment) throw error(404, 'Attachment not found');

  const stream = createReadStream(attachment.path);
  const mimeType = attachment.mimeType || 'application/octet-stream';

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
