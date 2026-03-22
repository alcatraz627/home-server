import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface RemoteDevice {
  hostname: string;
  ip: string;
  port: number;
  label: string;
}

const STORAGE_KEY = 'hs:device-context';
const DEVICES_KEY = 'hs:remote-devices';

function loadTarget(): string {
  if (!browser) return 'local';
  return localStorage.getItem(STORAGE_KEY) || 'local';
}

function loadDevices(): RemoteDevice[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/** Currently selected target — "local" or a Tailscale IP */
export const targetDevice = writable<string>(loadTarget());

/** List of configured remote devices */
export const remoteDevices = writable<RemoteDevice[]>(loadDevices());

export function setTarget(target: string) {
  if (browser) localStorage.setItem(STORAGE_KEY, target);
  targetDevice.set(target);
}

export function addDevice(device: RemoteDevice) {
  remoteDevices.update((list) => {
    const next = [...list.filter((d) => d.ip !== device.ip), device];
    if (browser) localStorage.setItem(DEVICES_KEY, JSON.stringify(next));
    return next;
  });
}

export function removeDevice(ip: string) {
  remoteDevices.update((list) => {
    const next = list.filter((d) => d.ip !== ip);
    if (browser) localStorage.setItem(DEVICES_KEY, JSON.stringify(next));
    return next;
  });
  // If removed device was active, reset to local
  targetDevice.update((t) => {
    if (t === ip) {
      if (browser) localStorage.setItem(STORAGE_KEY, 'local');
      return 'local';
    }
    return t;
  });
}

/**
 * Get the API base URL for the currently selected device.
 * Returns '' for local (relative URLs work), or 'http://ip:port' for remote.
 */
export function getApiBase(target: string, devices: RemoteDevice[]): string {
  if (target === 'local') return '';
  const device = devices.find((d) => d.ip === target);
  if (!device) return '';
  return `http://${device.ip}:${device.port}`;
}
