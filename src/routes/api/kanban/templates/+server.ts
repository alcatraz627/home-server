import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';
import type { KanbanCard, KanbanColumn } from '$lib/types/productivity';
import { addActivity } from '$lib/server/activity';

interface TemplateCard {
  title: string;
  column: KanbanColumn;
  priority?: string;
  color?: string;
  description?: string;
}

export interface KanbanTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // comma-joined column distribution eg "2 todo, 1 doing"
  cards: TemplateCard[];
}

const TEMPLATES: KanbanTemplate[] = [
  {
    id: 'sprint',
    name: 'Sprint',
    description: 'Agile sprint board — backlog, in-progress, review, done',
    preview: '4 todo, 2 doing',
    cards: [
      { title: 'Sprint planning complete', column: 'doing', priority: 'P2', color: '#3b82f6' },
      { title: 'Set up development environment', column: 'todo' },
      { title: 'Write unit tests for core module', column: 'todo', priority: 'P2' },
      { title: 'Implement feature A', column: 'todo', priority: 'P1', color: '#ef4444' },
      { title: 'Implement feature B', column: 'todo', priority: 'P2' },
      { title: 'Code review', column: 'todo' },
      { title: 'Deploy to staging', column: 'todo' },
      { title: 'Sprint retrospective', column: 'todo' },
    ],
  },
  {
    id: 'personal-kanban',
    name: 'Personal Kanban',
    description: 'Classic personal task management — now, next, someday',
    preview: '3 todo, 1 doing',
    cards: [
      { title: 'Review emails and messages', column: 'doing' },
      { title: 'Pay bills', column: 'todo', priority: 'P1', color: '#ef4444' },
      { title: 'Schedule dentist appointment', column: 'todo', priority: 'P2' },
      { title: 'Read book chapter', column: 'todo' },
      { title: 'Grocery shopping', column: 'todo' },
      { title: 'Exercise routine', column: 'todo' },
      { title: 'Call family', column: 'todo' },
    ],
  },
  {
    id: 'gtd',
    name: 'GTD (Getting Things Done)',
    description: "David Allen's GTD workflow — inbox, next actions, waiting, someday",
    preview: '2 todo, 1 doing, 1 done',
    cards: [
      {
        title: 'Process inbox',
        column: 'doing',
        priority: 'P1',
        description: 'Capture everything from email, notes, and head into the system',
      },
      { title: 'Weekly review', column: 'todo', priority: 'P1', color: '#8b5cf6' },
      { title: 'Draft project proposal', column: 'todo', priority: 'P2' },
      { title: 'Research vacation options', column: 'todo' },
      { title: 'Waiting: contractor estimate', column: 'todo', color: '#f97316' },
      { title: 'Someday: learn a new language', column: 'todo' },
      { title: "Capture and clarify last week's notes", column: 'done' },
    ],
  },
  {
    id: 'bug-tracker',
    name: 'Bug Tracker',
    description: 'Software bug triage — reported, confirmed, in-fix, resolved',
    preview: '3 todo, 1 doing',
    cards: [
      { title: 'Triage incoming bug reports', column: 'doing', priority: 'P2', color: '#ef4444' },
      { title: '#001 Login page 500 error on mobile', column: 'todo', priority: 'P1', color: '#ef4444' },
      { title: '#002 Missing validation on sign-up form', column: 'todo', priority: 'P2' },
      { title: '#003 Dashboard chart flickers on resize', column: 'todo', priority: 'P3' },
      { title: '#004 Write regression test for auth flow', column: 'todo' },
      { title: '#005 Update error messages', column: 'todo' },
    ],
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    description: 'Content production pipeline — ideas, drafting, review, published',
    preview: '3 todo, 2 doing',
    cards: [
      { title: 'Write blog post: productivity tips', column: 'doing', priority: 'P2', color: '#22c55e' },
      { title: 'Record tutorial video', column: 'doing' },
      { title: 'Ideas: "10 tools I use daily"', column: 'todo' },
      { title: 'Ideas: Deep dive on new framework', column: 'todo' },
      { title: 'Social media posts for next week', column: 'todo', priority: 'P2' },
      { title: 'Newsletter draft', column: 'todo', priority: 'P1', color: '#3b82f6' },
    ],
  },
];

function readCards(): KanbanCard[] {
  if (!fs.existsSync(PATHS.kanban)) return [];
  try {
    return JSON.parse(fs.readFileSync(PATHS.kanban, 'utf-8'));
  } catch {
    return [];
  }
}

function writeCards(cards: KanbanCard[]) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(PATHS.kanban, JSON.stringify(cards, null, 2));
}

export const GET: RequestHandler = async () => {
  return json(TEMPLATES);
};

export const POST: RequestHandler = async ({ request }) => {
  const { templateId, mode } = await request.json();
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return json({ error: 'Template not found' }, { status: 404 });

  const now = new Date().toISOString();
  const newCards: KanbanCard[] = template.cards.map((tc, i) => ({
    id: crypto.randomUUID().slice(0, 8),
    title: tc.title,
    description: tc.description ?? '',
    color: tc.color ?? '',
    dueDate: null,
    column: tc.column,
    order: i,
    priority: (tc.priority as KanbanCard['priority']) ?? '',
    assignee: '',
    tags: [],
    checklist: [],
    createdAt: now,
  }));

  let existing = readCards();

  if (mode === 'replace') {
    existing = [];
  }

  // Shift existing card orders to avoid collisions
  const colCounts: Record<string, number> = {};
  for (const c of newCards) {
    colCounts[c.column] = (colCounts[c.column] ?? 0) + 1;
  }
  for (const c of existing) {
    c.order += colCounts[c.column] ?? 0;
  }

  writeCards([...newCards, ...existing]);
  addActivity('create', 'kanban', templateId, `Template: ${template.name}`, `Applied ${mode} mode`);

  return json({ ok: true, count: newCards.length });
};
