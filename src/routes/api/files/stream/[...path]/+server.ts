import { error } from '@sveltejs/kit';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getUploadDir } from '$lib/server/config';
import { getMime } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Streaming file server with HTTP Range support.
 * Serves files from the upload directory with proper content-type
 * and partial content (206) for media seeking.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  const uploadDir = getUploadDir();
  const requestedPath = params.path;

  if (!requestedPath) {
    throw error(400, 'No file path provided');
  }

  // Resolve and validate the path is within upload directory
  const filePath = path.resolve(uploadDir, requestedPath);
  const resolvedBase = path.resolve(uploadDir);

  if (!filePath.startsWith(resolvedBase + path.sep) && filePath !== resolvedBase) {
    throw error(403, 'Path traversal detected');
  }

  if (!existsSync(filePath)) {
    throw error(404, 'File not found');
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    throw error(403, 'Permission denied');
  }

  if (stat.isDirectory()) {
    throw error(400, 'Cannot stream a directory');
  }

  const fileSize = stat.size;
  const mimeType = getMime(path.basename(filePath));
  const rangeHeader = request.headers.get('range');

  // --- Range request (206 Partial Content) ---
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      throw error(416, 'Invalid range header');
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    // Clamp values
    if (start >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
        },
      });
    }

    end = Math.min(end, fileSize - 1);
    const chunkSize = end - start + 1;

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache',
      },
    });
  }

  // --- Full file response (200) ---
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(fileSize),
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
    },
  });
};
