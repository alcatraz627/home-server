import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('keeper');

// --- Types ---

export type FeatureScope = 'bug-fix' | 'tweak' | 'feature' | 'enhancement' | 'refactor' | 'research' | 'epic';
export type FeatureStatus = 'draft' | 'ready' | 'running' | 'halted' | 'done';

export interface FeatureRequest {
  id: string;
  title: string;
  goal: string;
  scope: FeatureScope;
  details: string;
  status: FeatureStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  result: string | null;
}

// --- Storage ---

export const CONFIG_DIR = path.join(os.homedir(), '.home-server');
const REQUESTS_FILE = path.join(CONFIG_DIR, 'keeper-requests.json');
export const LOGS_DIR = path.join(CONFIG_DIR, 'keeper-logs');

async function ensureDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

// --- Status migration helper ---
function migrateStatus(status: string): FeatureStatus {
  const map: Record<string, FeatureStatus> = {
    backlog: 'draft',
    ready: 'ready',
    'in-progress': 'running',
    review: 'halted',
    done: 'done',
    rejected: 'done',
  };
  return map[status] || (status as FeatureStatus);
}

// --- CRUD ---

export async function getRequests(): Promise<FeatureRequest[]> {
  await ensureDir();
  if (!existsSync(REQUESTS_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(REQUESTS_FILE, 'utf-8')) as FeatureRequest[];
    // Migrate old statuses on read
    return raw.map((r) => ({ ...r, status: migrateStatus(r.status) }));
  } catch {
    return [];
  }
}

async function saveRequests(requests: FeatureRequest[]): Promise<void> {
  await fs.writeFile(REQUESTS_FILE, JSON.stringify(requests, null, 2));
}

export async function createRequest(data: {
  title: string;
  goal: string;
  scope: FeatureScope;
  details?: string;
}): Promise<FeatureRequest> {
  const requests = await getRequests();
  const maxPriority = requests.reduce((max, r) => Math.max(max, r.priority), 0);

  const request: FeatureRequest = {
    id: crypto.randomUUID().slice(0, 8),
    title: data.title,
    goal: data.goal,
    scope: data.scope,
    details: data.details || '',
    status: 'draft',
    priority: maxPriority + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
  };

  requests.push(request);
  await saveRequests(requests);
  log.info('Request created', { id: request.id, title: request.title, scope: request.scope });
  return request;
}

export async function updateRequest(id: string, updates: Partial<FeatureRequest>): Promise<FeatureRequest | null> {
  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const updated = { ...requests[idx], ...updates, updatedAt: new Date().toISOString() };
  if (updates.status === 'done') {
    updated.completedAt = new Date().toISOString();
  }
  requests[idx] = updated;
  await saveRequests(requests);
  log.info('Request updated', { id, status: updated.status, fields: Object.keys(updates) });
  return updated;
}

export async function deleteRequest(id: string): Promise<boolean> {
  const requests = await getRequests();
  const filtered = requests.filter((r) => r.id !== id);
  if (filtered.length === requests.length) return false;
  await saveRequests(filtered);
  log.info('Request deleted', { id });
  return true;
}

export async function reorderRequests(ids: string[]): Promise<void> {
  const requests = await getRequests();
  const byId = new Map(requests.map((r) => [r.id, r]));
  ids.forEach((id, i) => {
    const r = byId.get(id);
    if (r) r.priority = i;
  });
  requests.sort((a, b) => a.priority - b.priority);
  await saveRequests(requests);
}

// --- Stats ---

export async function getStats(): Promise<Record<FeatureStatus, number>> {
  const requests = await getRequests();
  const stats: Record<string, number> = {
    draft: 0,
    ready: 0,
    running: 0,
    halted: 0,
    done: 0,
  };
  for (const r of requests) {
    stats[r.status] = (stats[r.status] || 0) + 1;
  }
  return stats as Record<FeatureStatus, number>;
}
