import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// --- Types ---

export type FeatureScope = 'bug-fix' | 'tweak' | 'feature' | 'enhancement' | 'refactor' | 'research' | 'epic';
export type FeatureStatus = 'backlog' | 'ready' | 'in-progress' | 'review' | 'done' | 'rejected';

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

const CONFIG_DIR = path.join(os.homedir(), '.home-server');
const REQUESTS_FILE = path.join(CONFIG_DIR, 'keeper-requests.json');

async function ensureDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

// --- CRUD ---

export async function getRequests(): Promise<FeatureRequest[]> {
  await ensureDir();
  if (!existsSync(REQUESTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(REQUESTS_FILE, 'utf-8'));
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
    id: Math.random().toString(36).slice(2, 10),
    title: data.title,
    goal: data.goal,
    scope: data.scope,
    details: data.details || '',
    status: 'backlog',
    priority: maxPriority + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
  };

  requests.push(request);
  await saveRequests(requests);
  return request;
}

export async function updateRequest(id: string, updates: Partial<FeatureRequest>): Promise<FeatureRequest | null> {
  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const updated = { ...requests[idx], ...updates, updatedAt: new Date().toISOString() };
  if (updates.status === 'done' || updates.status === 'rejected') {
    updated.completedAt = new Date().toISOString();
  }
  requests[idx] = updated;
  await saveRequests(requests);
  return updated;
}

export async function deleteRequest(id: string): Promise<boolean> {
  const requests = await getRequests();
  const filtered = requests.filter((r) => r.id !== id);
  if (filtered.length === requests.length) return false;
  await saveRequests(filtered);
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
    backlog: 0,
    ready: 0,
    'in-progress': 0,
    review: 0,
    done: 0,
    rejected: 0,
  };
  for (const r of requests) {
    stats[r.status] = (stats[r.status] || 0) + 1;
  }
  return stats as Record<FeatureStatus, number>;
}
