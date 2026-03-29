import { get } from 'svelte/store';
import { targetDevice, remoteDevices, getApiBase } from './device-context';

/** Default fetch timeout — prevents hanging requests when server is offline */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch wrapper that automatically prefixes the API base URL
 * based on the currently selected target device.
 * Includes a default 15s timeout to prevent infinite hangs when offline.
 *
 * Usage: `fetchApi('/api/files')` instead of `fetch('/api/files')`
 * When targeting a remote device, this becomes `fetch('http://ip:port/api/files')`
 */
export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const target = get(targetDevice);
  const devices = get(remoteDevices);
  const base = getApiBase(target, devices);

  // Add timeout via AbortController if caller didn't provide a signal
  if (!init?.signal) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  return fetch(`${base}${path}`, init);
}

/** POST JSON shorthand — sets method, content-type, and stringifies the body. */
export async function postJson(path: string, data: unknown, init?: RequestInit): Promise<Response> {
  return fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...init,
  });
}

/** PUT JSON shorthand. */
export async function putJson(path: string, data: unknown, init?: RequestInit): Promise<Response> {
  return fetchApi(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...init,
  });
}

/** PATCH JSON shorthand. */
export async function patchJson(path: string, data: unknown, init?: RequestInit): Promise<Response> {
  return fetchApi(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...init,
  });
}

/** DELETE shorthand — optional body for endpoints that accept one. */
export async function deleteJson(path: string, data?: unknown, init?: RequestInit): Promise<Response> {
  return fetchApi(path, {
    method: 'DELETE',
    ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
    ...init,
  });
}
