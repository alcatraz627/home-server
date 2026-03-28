import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { errorMessage } from '$lib/server/errors';
import { PATHS } from '$lib/server/paths';

const NOTES_DIR = PATHS.notes;

export interface NoteBlock {
  id: string;
  type: 'text' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'todo' | 'code' | 'divider' | 'quote';
  content: string;
  checked?: boolean;
  language?: string;
}

export interface Note {
  id: string;
  title: string;
  icon: string;
  blocks: NoteBlock[];
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

function ensureDir() {
  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
}

function listNotes(): Note[] {
  ensureDir();
  const files = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8')) as Note;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Note[];
}

function getNote(id: string): Note | null {
  const filePath = path.join(NOTES_DIR, `${id}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveNote(note: Note): void {
  ensureDir();
  fs.writeFileSync(path.join(NOTES_DIR, `${note.id}.json`), JSON.stringify(note, null, 2));
}

function deleteNote(id: string): void {
  const filePath = path.join(NOTES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  // Also delete child notes
  const all = listNotes();
  for (const note of all) {
    if (note.parentId === id) deleteNote(note.id);
  }
}

/** GET — list all notes or get a single note */
export const GET: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (id) {
    const note = getNote(id);
    if (!note) return json({ error: 'Note not found' }, { status: 404 });
    return json(note);
  }

  const notes = listNotes();
  // Build tree structure
  const roots = notes.filter((n) => !n.parentId);
  const children = (parentId: string) => notes.filter((n) => n.parentId === parentId);

  return json({
    notes: roots.map((n) => ({
      ...n,
      blocks: undefined, // Don't send blocks in list view
      childCount: children(n.id).length,
    })),
    total: notes.length,
  });
};

/** POST — create a new note */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  const note: Note = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || 'Untitled',
    icon: body.icon || '',
    blocks: body.blocks || [{ id: crypto.randomUUID().slice(0, 8), type: 'text', content: '' }],
    parentId: body.parentId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveNote(note);
  return json(note, { status: 201 });
};

/** PUT — update a note */
export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  if (!body.id) return json({ error: 'id required' }, { status: 400 });

  const existing = getNote(body.id);
  if (!existing) return json({ error: 'Note not found' }, { status: 404 });

  const updated: Note = {
    ...existing,
    title: body.title ?? existing.title,
    icon: body.icon ?? existing.icon,
    blocks: body.blocks ?? existing.blocks,
    parentId: body.parentId !== undefined ? body.parentId : existing.parentId,
    updatedAt: new Date().toISOString(),
  };

  saveNote(updated);
  return json(updated);
};

/** DELETE — delete a note and its children */
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.id) return json({ error: 'id required' }, { status: 400 });
    deleteNote(body.id);
    return json({ ok: true });
  } catch (e: unknown) {
    return json({ error: errorMessage(e) }, { status: 500 });
  }
};
