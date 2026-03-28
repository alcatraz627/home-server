import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';

const FILE = PATHS.bookmarks;

interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
}

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readBookmarks(): Bookmark[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeBookmarks(bookmarks: Bookmark[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(bookmarks, null, 2));
}

export const GET: RequestHandler = async () => {
  return json(readBookmarks());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const bookmarks = readBookmarks();

  if (body._action === 'delete') {
    const filtered = bookmarks.filter((b) => b.id !== body.id);
    writeBookmarks(filtered);
    return json({ ok: true });
  }

  if (body._action === 'update') {
    const idx = bookmarks.findIndex((b) => b.id === body.id);
    if (idx === -1) return json({ error: 'Not found' }, { status: 404 });
    bookmarks[idx] = { ...bookmarks[idx], ...body, _action: undefined };
    delete (bookmarks[idx] as any)._action;
    writeBookmarks(bookmarks);
    return json(bookmarks[idx]);
  }

  // Create
  const bookmark: Bookmark = {
    id: crypto.randomUUID().slice(0, 8),
    url: body.url,
    title: body.title || body.url,
    description: body.description || '',
    tags: (body.tags || '')
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean),
    createdAt: new Date().toISOString(),
  };
  bookmarks.unshift(bookmark);
  writeBookmarks(bookmarks);
  return json(bookmark, { status: 201 });
};
