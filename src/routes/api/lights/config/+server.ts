import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';

const CONFIG_FILE = PATHS.lightsConfig;

interface CustomPreset {
  label: string;
  icon: string;
  dimming: number;
  temp: number;
  color?: { r: number; g: number; b: number };
}

interface LightsConfig {
  names: Record<string, string>;
  rooms: Record<string, string>;
  presets: CustomPreset[];
}

const DEFAULTS: LightsConfig = {
  names: {},
  rooms: {},
  presets: [],
};

function readConfig(): LightsConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      names: parsed.names ?? {},
      rooms: parsed.rooms ?? {},
      presets: parsed.presets ?? [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(config: LightsConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/** GET — read lights config */
export const GET: RequestHandler = async () => {
  const config = readConfig();
  return json(config);
};

/** POST — save lights config */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  // Support reconcile action: merge new names with existing, remove stale entries
  if (body.action === 'reconcile') {
    const existing = readConfig();
    const activeMacs: string[] = body.activeMacs ?? [];
    const newNames: Record<string, string> = body.names ?? {};

    // Merge: keep existing names for active MACs, add new names
    const merged: Record<string, string> = {};
    for (const mac of activeMacs) {
      if (newNames[mac]) {
        merged[mac] = newNames[mac];
      } else if (existing.names[mac]) {
        merged[mac] = existing.names[mac];
      }
    }

    const config: LightsConfig = {
      names: merged,
      rooms: existing.rooms,
      presets: existing.presets,
    };
    writeConfig(config);
    return json({ ...config, removed: Object.keys(existing.names).filter((m) => !activeMacs.includes(m)) });
  }

  const config: LightsConfig = {
    names: body.names ?? {},
    rooms: body.rooms ?? {},
    presets: body.presets ?? [],
  };
  writeConfig(config);
  return json(config);
};
