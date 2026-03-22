/**
 * Shared test helpers for Home Server API tests.
 *
 * Usage:
 *   import { api, apiJson, BASE } from '../helpers/api';
 *   const { res, data } = await apiJson('/api/system');
 */

export const BASE = process.env.TEST_URL || 'http://localhost:5555';

/** Raw fetch with base URL prepended */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

/** Fetch + parse JSON response */
export async function apiJson<T = any>(path: string, init?: RequestInit): Promise<{ res: Response; data: T }> {
  const res = await api(path, init);
  const data = await res.json();
  return { res, data };
}

/** POST with JSON body */
export async function apiPost<T = any>(path: string, body: any): Promise<{ res: Response; data: T }> {
  return apiJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** DELETE with optional JSON body */
export async function apiDelete<T = any>(path: string, body?: any): Promise<{ res: Response; data: T }> {
  return apiJson<T>(path, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** Check if a server feature is available (returns true if endpoint doesn't 500) */
export async function isAvailable(path: string): Promise<boolean> {
  try {
    const res = await api(path);
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Generate a unique test ID to avoid collisions */
export function testId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Wait for a condition with timeout */
export async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
