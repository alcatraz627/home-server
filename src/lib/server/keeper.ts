import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';
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

export { CONFIG_DIR };
const REQUESTS_FILE = path.join(CONFIG_DIR, 'keeper-requests.json');
export const LOGS_DIR = PATHS.keeperLogs;

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

// --- Images ---

export const IMAGES_DIR = path.join(CONFIG_DIR, 'keeper-images');

export async function getImageDir(requestId: string): Promise<string> {
  const dir = path.join(IMAGES_DIR, requestId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function listImages(requestId: string): Promise<string[]> {
  const dir = path.join(IMAGES_DIR, requestId);
  if (!existsSync(dir)) return [];
  const files = await fs.readdir(dir);
  return files.filter((f) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f)).sort();
}

export async function saveImage(requestId: string, filename: string, data: Buffer): Promise<string> {
  const dir = await getImageDir(requestId);
  // Sanitize filename
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ts = Date.now();
  const finalName = `${ts}-${safe}`;
  const filePath = path.join(dir, finalName);
  await fs.writeFile(filePath, data);
  log.info('Image saved', { requestId, filename: finalName });
  return finalName;
}

export async function deleteImage(requestId: string, filename: string): Promise<boolean> {
  const filePath = path.join(IMAGES_DIR, requestId, filename);
  if (!existsSync(filePath)) return false;
  await fs.unlink(filePath);
  log.info('Image deleted', { requestId, filename });
  return true;
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
