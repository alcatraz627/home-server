import { json } from '@sveltejs/kit';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';
import { APP } from '$lib/constants/app';
import { NAV_GROUPS } from '$lib/constants/nav';
import { errorMessage } from '$lib/server/errors';

const DATA_DIR = path.join(os.homedir(), '.home-server');

interface StorageEntry {
  name: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
}

function getDirSize(dirPath: string): { sizeBytes: number; fileCount: number } {
  let sizeBytes = 0;
  let fileCount = 0;
  try {
    if (!fs.existsSync(dirPath)) return { sizeBytes: 0, fileCount: 0 };
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = getDirSize(fullPath);
        sizeBytes += sub.sizeBytes;
        fileCount += sub.fileCount;
      } else {
        try {
          sizeBytes += fs.statSync(fullPath).size;
          fileCount++;
        } catch {}
      }
    }
  } catch {}
  return { sizeBytes, fileCount };
}

function getStorageBreakdown(): StorageEntry[] {
  const dirs = [
    { name: 'Logs', path: path.join(DATA_DIR, 'logs') },
    { name: 'Notes', path: path.join(DATA_DIR, 'notes') },
    { name: 'Screenshots', path: path.join(DATA_DIR, 'screenshots') },
    { name: 'Keeper Logs', path: path.join(DATA_DIR, 'keeper-logs') },
    { name: 'Icon Cache', path: path.join(DATA_DIR, 'icon-cache') },
    { name: 'Uploads', path: path.resolve(process.env.UPLOAD_DIR || './uploads') },
  ];

  const configFiles = [
    'tasks.json',
    'task-history.json',
    'backups.json',
    'bookmarks.json',
    'kanban.json',
    'lights-config.json',
    'screenshots-meta.json',
    'terminal-pin.json',
  ];

  const entries: StorageEntry[] = [];

  for (const dir of dirs) {
    const { sizeBytes, fileCount } = getDirSize(dir.path);
    if (sizeBytes > 0 || fileCount > 0) {
      entries.push({ name: dir.name, path: dir.path, sizeBytes, fileCount });
    }
  }

  // Config files
  let configSize = 0;
  let configCount = 0;
  for (const file of configFiles) {
    const fp = path.join(DATA_DIR, file);
    try {
      if (fs.existsSync(fp)) {
        configSize += fs.statSync(fp).size;
        configCount++;
      }
    } catch {}
  }
  if (configCount > 0) {
    entries.push({ name: 'Config Files', path: DATA_DIR, sizeBytes: configSize, fileCount: configCount });
  }

  return entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

function getNodeVersion(): string {
  return process.version;
}

function getGitInfo(): { branch: string; commit: string; dirty: boolean } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim();
    const commit = execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim();
    const dirty =
      execSync('git status --porcelain 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim().length > 0;
    return { branch, commit, dirty };
  } catch {
    return { branch: 'unknown', commit: 'unknown', dirty: false };
  }
}

export const GET: RequestHandler = async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const [load1] = os.loadavg();
  const uptimeSec = os.uptime();

  const storage = getStorageBreakdown();
  const totalStorageBytes = storage.reduce((sum, e) => sum + e.sizeBytes, 0);
  const git = getGitInfo();

  const pageCount = NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

  return json({
    app: {
      version: APP.version,
      title: APP.title,
      nodeVersion: getNodeVersion(),
      pid: process.pid,
      pageCount,
      git,
    },
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCount: cpus.length,
      totalMemMB: Math.round(totalMem / 1048576),
      usedMemMB: Math.round((totalMem - freeMem) / 1048576),
      memPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      loadAvg: Math.round(load1 * 100) / 100,
      uptimeHours: Math.floor(uptimeSec / 3600),
      uptimeDays: Math.floor(uptimeSec / 86400),
    },
    storage,
    totalStorageBytes,
    dataDir: DATA_DIR,
  });
};
