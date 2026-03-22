import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

const PIN_FILE = path.join(os.homedir(), '.home-server', 'terminal-pin.json');

interface PinConfig {
  hash: string;
  salt: string;
  enabled: boolean;
}

function hashPin(pin: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(pin + salt)
    .digest('hex');
}

function readPinConfig(): PinConfig | null {
  try {
    if (fs.existsSync(PIN_FILE)) {
      return JSON.parse(fs.readFileSync(PIN_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function writePinConfig(config: PinConfig) {
  const dir = path.dirname(PIN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PIN_FILE, JSON.stringify(config, null, 2));
}

/** Check if PIN is enabled and whether a given PIN is correct */
export function verifyTerminalPin(pin: string | null): { required: boolean; valid: boolean } {
  const config = readPinConfig();
  if (!config || !config.enabled) {
    return { required: false, valid: true };
  }
  if (!pin) {
    return { required: true, valid: false };
  }
  const hashed = hashPin(pin, config.salt);
  return { required: true, valid: hashed === config.hash };
}

/** GET — check if PIN is enabled */
export const GET: RequestHandler = async () => {
  const config = readPinConfig();
  return json({ enabled: config?.enabled ?? false });
};

/** POST — set, verify, or disable PIN */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body.action === 'set') {
    const pin = body.pin;
    if (!pin || typeof pin !== 'string' || pin.length < 4) {
      return json({ error: 'PIN must be at least 4 characters' }, { status: 400 });
    }
    const salt = crypto.randomUUID();
    const hash = hashPin(pin, salt);
    writePinConfig({ hash, salt, enabled: true });
    return json({ ok: true, enabled: true });
  }

  if (body.action === 'verify') {
    const result = verifyTerminalPin(body.pin);
    return json(result);
  }

  if (body.action === 'disable') {
    // Require current PIN to disable
    const result = verifyTerminalPin(body.pin);
    if (!result.valid) {
      return json({ error: 'Invalid PIN' }, { status: 403 });
    }
    writePinConfig({ hash: '', salt: '', enabled: false });
    return json({ ok: true, enabled: false });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};
