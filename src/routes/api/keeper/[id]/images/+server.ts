import { json } from '@sveltejs/kit';
import { listImages, saveImage, deleteImage, IMAGES_DIR } from '$lib/server/keeper';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = (params as Record<string, string>).id;
  const filename = url.searchParams.get('file');

  // Serve a specific image file
  if (filename) {
    const filePath = path.join(IMAGES_DIR, id, filename);
    if (!existsSync(filePath)) {
      return json({ error: 'Image not found' }, { status: 404 });
    }
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
    };
    return new Response(data, {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // List all images for this request
  const images = await listImages(id);
  return json({ images });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const id = (params as Record<string, string>).id;
  const formData = await request.formData();
  const files = formData.getAll('images') as File[];

  if (!files.length) {
    return json({ error: 'No files uploaded' }, { status: 400 });
  }

  const saved: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    const name = await saveImage(id, file.name, buf);
    saved.push(name);
  }

  return json({ saved, count: saved.length });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const id = (params as Record<string, string>).id;
  const { filename } = await request.json();
  const deleted = await deleteImage(id, filename);
  if (!deleted) {
    return json({ error: 'Image not found' }, { status: 404 });
  }
  return json({ ok: true });
};
