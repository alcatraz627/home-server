/** Shared type definitions for the Productivity module (kanban, reminders, links, tags). */

// ─── Kanban ────────────────────────────────────────────────────────

export type KanbanColumn = 'todo' | 'doing' | 'done' | 'archive';
export type KanbanPriority = 'P1' | 'P2' | 'P3' | '';

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  color: string;
  dueDate: string | null;
  column: KanbanColumn;
  order: number;
  priority: KanbanPriority;
  assignee: string;
  tags: string[];
  checklist: ChecklistItem[];
  createdAt: string;
}

// ─── Reminders ─────────────────────────────────────────────────────

export type ReminderPriority = 'urgent' | 'high' | 'normal' | 'low';
export type ReminderChannel = 'browser' | 'ntfy';

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom';

export interface Recurrence {
  pattern: RecurrencePattern;
  /** Interval multiplier — e.g. every 2 weeks = { pattern: 'weekly', interval: 2 } */
  interval?: number;
  /** ISO date string — stop recurring after this date (inclusive). Omit for infinite. */
  endDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  datetime: string; // ISO string
  channels: ReminderChannel[];
  priority: ReminderPriority;
  fired: boolean;
  snoozedUntil: string | null; // ISO string — if snoozed, fires again at this time
  recurrence: Recurrence | null;
  createdAt: string;
}

// ─── Links ─────────────────────────────────────────────────────────

export type LinkableModule = 'note' | 'kanban' | 'reminder' | 'bookmark' | 'keeper';

export interface ItemLink {
  id: string;
  sourceType: LinkableModule;
  sourceId: string;
  targetType: LinkableModule;
  targetId: string;
  label?: string;
  createdAt: string;
}

export interface LinkedRef {
  type: LinkableModule;
  id: string;
  linkId: string;
  title?: string;
}

// ─── Tags ──────────────────────────────────────────────────────────

export interface Tag {
  name: string;
  color: string;
  usageCount: number;
}
