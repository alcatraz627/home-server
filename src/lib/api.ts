import { get } from 'svelte/store';
import { targetDevice, remoteDevices, getApiBase } from './device-context';

/**
 * Fetch wrapper that automatically prefixes the API base URL
 * based on the currently selected target device.
 *
 * Usage: `fetchApi('/api/files')` instead of `fetch('/api/files')`
 * When targeting a remote device, this becomes `fetch('http://ip:port/api/files')`
 */
export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const target = get(targetDevice);
  const devices = get(remoteDevices);
  const base = getApiBase(target, devices);
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
