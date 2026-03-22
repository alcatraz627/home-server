import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RequestHandler } from './$types';

const DATA_DIR = path.join(os.homedir(), '.home-server');
const FILE = path.join(DATA_DIR, 'kanban.json');

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  color: string;
  dueDate: string | null;
  column: 'todo' | 'doing' | 'done' | 'archive';
  order: number;
  priority: 'P1' | 'P2' | 'P3' | '';
  assignee: string;
  createdAt: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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
    writeCards(cards);
    return json(cards[idx]);
  }

  // Create
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
    createdAt: new Date().toISOString(),
  };
  cards.push(card);
  writeCards(cards);
  return json(card, { status: 201 });
};
