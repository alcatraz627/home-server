import crypto from 'node:crypto';
import { errorMessage } from '$lib/server/errors';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('services');

// --- Types ---

export interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  /** Check interval in seconds */
  interval: number;
  /** Request timeout in seconds */
  timeout: number;
}

export interface ServiceCheck {
  timestamp: string;
  status: number | null;
  responseTime: number;
  error?: string;
}

export interface ServiceStatus {
  config: ServiceConfig;
  lastCheck: ServiceCheck | null;
  uptime24h: number;
  checks: ServiceCheck[];
}

// --- Storage ---

const CONFIG_DIR = path.join(os.homedir(), '.home-server');
const CONFIG_FILE = path.join(CONFIG_DIR, 'services.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'services-history.json');

async function ensureDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

// --- Config ---

export async function getServices(): Promise<ServiceConfig[]> {
  await ensureDir();
  if (!existsSync(CONFIG_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return data.services ?? [];
  } catch {
    return [];
  }
}

async function saveServices(services: ServiceConfig[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ services }, null, 2));
}

export async function addService(svc: Omit<ServiceConfig, 'id'>): Promise<ServiceConfig> {
  const services = await getServices();
  const config: ServiceConfig = {
    id: crypto.randomUUID().slice(0, 8),
    ...svc,
  };
  services.push(config);
  await saveServices(services);
  log.info('Service added', { id: config.id, name: config.name, url: config.url });
  return config;
}

export async function removeService(id: string): Promise<void> {
  const services = await getServices();
  await saveServices(services.filter((s) => s.id !== id));
  // Also remove history
  const history = await getHistory();
  delete history[id];
  await saveHistory(history);
  log.info('Service removed', { id });
}

// --- History ---

type HistoryMap = Record<string, ServiceCheck[]>;

async function getHistory(): Promise<HistoryMap> {
  await ensureDir();
  if (!existsSync(HISTORY_FILE)) return {};
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function saveHistory(history: HistoryMap): Promise<void> {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function appendCheck(serviceId: string, check: ServiceCheck): Promise<void> {
  const history = await getHistory();
  if (!history[serviceId]) history[serviceId] = [];
  history[serviceId].push(check);
  // Keep last 100 per service
  if (history[serviceId].length > 100) {
    history[serviceId] = history[serviceId].slice(-100);
  }
  await saveHistory(history);
}

// --- Health Check ---

export async function checkService(
  url: string,
  timeout: number,
): Promise<{ status: number | null; responseTime: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    const responseTime = Date.now() - start;
    clearTimeout(timer);
    return { status: res.status, responseTime };
  } catch (err: unknown) {
    const responseTime = Date.now() - start;
    clearTimeout(timer);
    const error =
      err instanceof Error && err.name === 'AbortError' ? 'Timeout' : errorMessage(err, 'Connection failed');
    return { status: null, responseTime, error };
  }
}

/** Check a single service and record the result */
export async function checkAndRecord(serviceId: string): Promise<ServiceCheck> {
  const services = await getServices();
  const svc = services.find((s) => s.id === serviceId);
  if (!svc) throw new Error('Service not found');

  const result = await checkService(svc.url, svc.timeout);
  const check: ServiceCheck = {
    timestamp: new Date().toISOString(),
    status: result.status,
    responseTime: result.responseTime,
    ...(result.error ? { error: result.error } : {}),
  };

  await appendCheck(serviceId, check);

  // If service went down, fire a notification
  if (result.status === null || result.status >= 500) {
    try {
      const { addNotification } = await import('./notifications');
      await addNotification('error', `Service down: ${svc.name}`, result.error || `HTTP ${result.status}`, 'service');
    } catch {
      // notifications module may not exist yet during initial setup
    }
  }

  return check;
}

/** Check all services */
export async function checkAllServices(): Promise<void> {
  const services = await getServices();
  for (const svc of services) {
    try {
      await checkAndRecord(svc.id);
    } catch (err: unknown) {
      log.error('Failed to check service', { id: svc.id, error: errorMessage(err) });
    }
  }
}

// --- Status ---

export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  const services = await getServices();
  const history = await getHistory();

  return services.map((config) => {
    const checks = history[config.id] ?? [];
    const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null;

    // Calculate 24h uptime
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const recent = checks.filter((c) => now - new Date(c.timestamp).getTime() < day);
    const upChecks = recent.filter((c) => c.status !== null && c.status < 500);
    const uptime24h = recent.length > 0 ? Math.round((upChecks.length / recent.length) * 100) : -1;

    return { config, lastCheck, uptime24h, checks: checks.slice(-50) };
  });
}
