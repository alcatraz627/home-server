import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';
import { ensureTag, releaseTag } from '$lib/server/tags';
import type { KanbanCard } from '$lib/types/productivity';

const FILE = PATHS.kanban;

/** Diff old vs new tags and call ensureTag/releaseTag accordingly */
function syncTags(oldTags: string[], newTags: string[]) {
  const added = newTags.filter((t) => !oldTags.includes(t));
  const removed = oldTags.filter((t) => !newTags.includes(t));
  for (const t of added) ensureTag(t);
  for (const t of removed) releaseTag(t);
}

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readCards(): KanbanCard[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeCards(cards: KanbanCard[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(cards, null, 2));
}

export const GET: RequestHandler = async () => {
  return json(readCards());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const cards = readCards();

  if (body._action === 'delete') {
    const card = cards.find((c) => c.id === body.id);
    if (card) {
      for (const t of card.tags ?? []) releaseTag(t);
    }
    const filtered = cards.filter((c) => c.id !== body.id);
    writeCards(filtered);
    return json({ ok: true });
  }

  if (body._action === 'move') {
    const card = cards.find((c) => c.id === body.id);
    if (!card) return json({ error: 'Not found' }, { status: 404 });
    card.column = body.column;
    card.order = body.order ?? card.order;
    writeCards(cards);
    return json(card);
  }

  if (body._action === 'update') {
    const idx = cards.findIndex((c) => c.id === body.id);
    if (idx === -1) return json({ error: 'Not found' }, { status: 404 });
    if (body.title !== undefined) cards[idx].title = body.title;
    if (body.description !== undefined) cards[idx].description = body.description;
    if (body.color !== undefined) cards[idx].color = body.color;
    if (body.dueDate !== undefined) cards[idx].dueDate = body.dueDate || null;
    if (body.priority !== undefined) cards[idx].priority = body.priority;
    if (body.assignee !== undefined) cards[idx].assignee = body.assignee;
    if (body.tags !== undefined) {
      syncTags(cards[idx].tags ?? [], body.tags);
      cards[idx].tags = body.tags;
    }
    if (body.checklist !== undefined) cards[idx].checklist = body.checklist;
    writeCards(cards);
    return json(cards[idx]);
  }

  // Create
  const newTags: string[] = Array.isArray(body.tags) ? body.tags : [];
  for (const t of newTags) ensureTag(t);
  const card: KanbanCard = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || 'Untitled',
    description: body.description || '',
    color: body.color || '',
    dueDate: body.dueDate || null,
    column: body.column || 'todo',
    order: cards.filter((c) => c.column === (body.column || 'todo')).length,
    priority: body.priority || '',
    assignee: body.assignee || '',
    tags: newTags,
    checklist: Array.isArray(body.checklist) ? body.checklist : [],
    createdAt: new Date().toISOString(),
  };
  cards.push(card);
  writeCards(cards);
  return json(card, { status: 201 });
};
