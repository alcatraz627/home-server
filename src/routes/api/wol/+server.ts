import crypto from 'node:crypto';
import { errorMessage, errorCode } from '$lib/server/errors';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sendMagicPacket, pingHost } from '$lib/server/wol';
import type { RequestHandler } from './$types';

const DATA_DIR = path.join(os.homedir(), '.home-server');
const FILE = path.join(DATA_DIR, 'wol-devices.json');

interface WolDevice {
  id: string;
  name: string;
  mac: string;
  ip: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDevices(): WolDevice[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeDevices(devices: WolDevice[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(devices, null, 2));
}

export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  if (action === 'ping') {
    const ip = url.searchParams.get('ip');
    if (!ip) return json({ error: 'IP required' }, { status: 400 });
    const alive = await pingHost(ip);
    return json({ ip, alive });
  }

  return json(readDevices());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'wake') {
    try {
      await sendMagicPacket(body.mac);
      return json({ ok: true, message: `Magic packet sent to ${body.mac}` });
    } catch (err: unknown) {
      return json({ error: errorMessage(err) }, { status: 500 });
    }
  }

  if (body._action === 'delete') {
    const devices = readDevices().filter((d) => d.id !== body.id);
    writeDevices(devices);
    return json({ ok: true });
  }

  if (body._action === 'update') {
    const devices = readDevices();
    const idx = devices.findIndex((d) => d.id === body.id);
    if (idx === -1) return json({ error: 'Not found' }, { status: 404 });
    devices[idx] = { ...devices[idx], name: body.name, mac: body.mac, ip: body.ip || '' };
    writeDevices(devices);
    return json(devices[idx]);
  }

  // Create
  const devices = readDevices();
  const device: WolDevice = {
    id: crypto.randomUUID().slice(0, 8),
    name: body.name || 'Device',
    mac: body.mac,
    ip: body.ip || '',
  };
  devices.push(device);
  writeDevices(devices);
  return json(device, { status: 201 });
};
