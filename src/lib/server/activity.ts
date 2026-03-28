import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths';

const ACTIVITY_FILE = path.join(CONFIG_DIR, 'activity.json');
const MAX_EVENTS = 500;

export type ActivityModule = 'note' | 'kanban' | 'reminder' | 'bookmark' | 'keeper';
export type ActivityAction = 'create' | 'update' | 'delete' | 'complete' | 'archive';

export interface ActivityEvent {
  id: string;
  type: ActivityAction;
  module: ActivityModule;
  itemId: string;
  itemTitle: string;
  details?: string;
  timestamp: string;
}

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readActivity(): ActivityEvent[] {
  ensureDir();
  if (!fs.existsSync(ACTIVITY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeActivity(events: ActivityEvent[]) {
  ensureDir();
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(events, null, 2));
}

export function addActivity(
  type: ActivityAction,
  module: ActivityModule,
  itemId: string,
  itemTitle: string,
  details?: string,
): void {
  try {
    const events = readActivity();
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      type,
      module,
      itemId,
      itemTitle,
      details,
      timestamp: new Date().toISOString(),
    };
    // Prepend and trim to max
    const updated = [event, ...events].slice(0, MAX_EVENTS);
    writeActivity(updated);
  } catch {
    // Non-fatal — activity tracking should never break the main operation
  }
}
