import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ClipboardEntry {
  id: string;
  content: string;
  deviceId: string;
  deviceName: string;
  timestamp: string;
}

const MAX_ENTRIES = 50;
const entries: ClipboardEntry[] = [];

export const GET: RequestHandler = async () => {
  return json(entries);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'delete') {
    const idx = entries.findIndex((e) => e.id === body.id);
    if (idx !== -1) entries.splice(idx, 1);
    return json({ ok: true });
  }

  if (body._action === 'clear') {
    entries.length = 0;
    return json({ ok: true });
  }

  // Add new entry
  const entry: ClipboardEntry = {
    id: crypto.randomUUID().slice(0, 8) + Date.now().toString(36),
    content: String(body.content || '').slice(0, 10000),
    deviceId: body.deviceId || 'unknown',
    deviceName: body.deviceName || 'Unknown Device',
    timestamp: new Date().toISOString(),
  };

  entries.unshift(entry);

  // FIFO: keep max entries
  while (entries.length > MAX_ENTRIES) {
    entries.pop();
  }

  return json(entry, { status: 201 });
};
