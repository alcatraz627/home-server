import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RATE_LIMITS } from '$lib/server/rate-limit';
import { APP } from '$lib/constants/app';
import { NAV_GROUPS } from '$lib/constants/nav';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(os.homedir(), '.home-server');

function readJsonFile(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {}
  return null;
}

export const GET: RequestHandler = async () => {
  const configFiles: Record<string, any> = {};
  const configNames = [
    'tasks.json',
    'backups.json',
    'bookmarks.json',
    'kanban.json',
    'lights-config.json',
    'services.json',
    'screenshots-meta.json',
    'terminal-pin.json',
    'wol-devices.json',
  ];

  for (const name of configNames) {
    const data = readJsonFile(path.join(DATA_DIR, name));
    if (data !== null) {
      // For terminal-pin, don't expose the hash
      if (name === 'terminal-pin.json' && data.hash) {
        configFiles[name] = { enabled: data.enabled, hasPin: true };
      } else {
        configFiles[name] = data;
      }
    }
  }

  // Count notes
  let noteCount = 0;
  try {
    const notesDir = path.join(DATA_DIR, 'notes');
    if (fs.existsSync(notesDir)) {
      noteCount = fs.readdirSync(notesDir).filter((f) => f.endsWith('.json')).length;
    }
  } catch {}

  // Get log file info
  const logFiles: { name: string; size: number }[] = [];
  try {
    const logsDir = path.join(DATA_DIR, 'logs');
    if (fs.existsSync(logsDir)) {
      for (const f of fs.readdirSync(logsDir)) {
        try {
          const stat = fs.statSync(path.join(logsDir, f));
          logFiles.push({ name: f, size: stat.size });
        } catch {}
      }
    }
  } catch {}

  return json({
    app: {
      version: APP.version,
      title: APP.title,
      pid: process.pid,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
    },
    navigation: {
      groups: NAV_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        pageCount: g.items.length,
        pages: g.items.map((i) => i.href),
      })),
      totalPages: NAV_GROUPS.reduce((s, g) => s + g.items.length, 0),
    },
    rateLimits: RATE_LIMITS,
    dataDir: DATA_DIR,
    configFiles,
    storage: {
      noteCount,
      logFiles,
    },
    environment: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
      shell: process.env.SHELL || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  });
};
