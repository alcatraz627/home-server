import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { env } from '$env/dynamic/private';

export const CONFIG_DIR = path.resolve(env.HOME_SERVER_DIR || path.join(os.homedir(), '.home-server'));

/** Ensure the base config directory exists */
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

export const PATHS = {
  config: CONFIG_DIR,
  logs: path.join(CONFIG_DIR, 'logs'),
  notes: path.join(CONFIG_DIR, 'notes'),
  screenshots: path.join(CONFIG_DIR, 'screenshots'),
  iconCache: path.join(CONFIG_DIR, 'icon-cache'),
  keeperLogs: path.join(CONFIG_DIR, 'keeper-logs'),

  // JSON data files
  tasks: path.join(CONFIG_DIR, 'tasks.json'),
  taskHistory: path.join(CONFIG_DIR, 'task-history.json'),
  backups: path.join(CONFIG_DIR, 'backups.json'),
  backupHistory: path.join(CONFIG_DIR, 'backup-history.json'),
  lightsConfig: path.join(CONFIG_DIR, 'lights.json'),
  benchmarks: path.join(CONFIG_DIR, 'benchmarks.json'),
  bookmarks: path.join(CONFIG_DIR, 'bookmarks.json'),
  kanban: path.join(CONFIG_DIR, 'kanban.json'),
  wolDevices: path.join(CONFIG_DIR, 'wol-devices.json'),
  services: path.join(CONFIG_DIR, 'services.json'),
  terminalPin: path.join(CONFIG_DIR, 'terminal-pin.json'),
  notifications: path.join(CONFIG_DIR, 'notifications.json'),
  settings: path.join(CONFIG_DIR, 'settings.json'),
  reminders: path.join(CONFIG_DIR, 'reminders.json'),
  links: path.join(CONFIG_DIR, 'links.json'),
  tags: path.join(CONFIG_DIR, 'tags.json'),
} as const;
