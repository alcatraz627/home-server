import { execSync, spawn } from 'node:child_process';
import { errorMessage, errorCode } from '$lib/server/errors';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('backups');

export interface BackupConfig {
  id: string;
  name: string;
  sourcePath: string;
  destPath: string;
  /** Cron expression or null for manual-only */
  schedule: string | null;
  /** rsync exclude patterns */
  excludes: string[];
  enabled: boolean;
}

export interface BackupRun {
  id: string;
  configId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'failed';
  filesTransferred: number;
  bytesTransferred: number;
  error: string | null;
}

export interface BackupStatus {
  config: BackupConfig;
  lastRun: BackupRun | null;
  nextRun: string | null;
}

const CONFIG_DIR = path.join(os.homedir(), '.home-server');
const CONFIG_FILE = path.join(CONFIG_DIR, 'backups.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'backup-history.json');

// In-memory tracking for running backups
const runningBackups = new Map<string, { process: any; run: BackupRun }>();

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

// --- Config ---

export async function getBackupConfigs(): Promise<BackupConfig[]> {
  await ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export async function saveBackupConfig(config: BackupConfig): Promise<void> {
  const configs = await getBackupConfigs();
  const idx = configs.findIndex((c) => c.id === config.id);
  if (idx >= 0) configs[idx] = config;
  else configs.push(config);
  await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

export async function deleteBackupConfig(id: string): Promise<void> {
  const configs = await getBackupConfigs();
  await fs.writeFile(
    CONFIG_FILE,
    JSON.stringify(
      configs.filter((c) => c.id !== id),
      null,
      2,
    ),
  );
}

// --- History ---

export async function getBackupHistory(): Promise<BackupRun[]> {
  await ensureConfigDir();
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function appendHistory(run: BackupRun): Promise<void> {
  const history = await getBackupHistory();
  const idx = history.findIndex((r) => r.id === run.id);
  if (idx >= 0) history[idx] = run;
  else history.push(run);
  // Keep last 100 runs
  const trimmed = history.slice(-100);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
}

// --- Status ---

export async function getBackupStatuses(): Promise<BackupStatus[]> {
  const configs = await getBackupConfigs();
  const history = await getBackupHistory();

  return configs.map((config) => {
    const runs = history.filter((r) => r.configId === config.id);
    const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
    // Check if currently running
    const running = runningBackups.get(config.id);
    return {
      config,
      lastRun: running ? running.run : lastRun,
      nextRun: config.schedule ? 'scheduled' : null,
    };
  });
}

// --- Run backup ---

export async function runBackup(configId: string): Promise<BackupRun> {
  const configs = await getBackupConfigs();
  const config = configs.find((c) => c.id === configId);
  if (!config) throw new Error('Backup config not found');

  if (runningBackups.has(configId)) {
    log.warn('Backup already running', { configId });
    throw new Error('Backup already running');
  }

  log.info('Backup started', { configId, name: config.name, source: config.sourcePath, dest: config.destPath });

  const run: BackupRun = {
    id: `${configId}-${Date.now()}`,
    configId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    filesTransferred: 0,
    bytesTransferred: 0,
    error: null,
  };

  // Build rsync command
  const args = [
    '-avz',
    '--progress',
    '--stats',
    ...config.excludes.flatMap((e) => ['--exclude', e]),
    config.sourcePath.endsWith('/') ? config.sourcePath : config.sourcePath + '/',
    config.destPath,
  ];

  const proc = spawn('rsync', args, { stdio: 'pipe' });
  runningBackups.set(configId, { process: proc, run });

  let output = '';
  proc.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
  });
  proc.stderr?.on('data', (data: Buffer) => {
    output += data.toString();
  });

  proc.on('close', async (code: number) => {
    run.completedAt = new Date().toISOString();
    run.status = code === 0 ? 'success' : 'failed';

    // Parse rsync stats
    const filesMatch = output.match(/Number of regular files transferred:\s*(\d+)/);
    const bytesMatch = output.match(/Total transferred file size:\s*([\d,]+)/);
    if (filesMatch) run.filesTransferred = parseInt(filesMatch[1]);
    if (bytesMatch) run.bytesTransferred = parseInt(bytesMatch[1].replace(/,/g, ''));

    if (code !== 0) {
      run.error = output.slice(-500); // Last 500 chars of output
      log.error('Backup failed', { configId, code, error: run.error });
    } else {
      log.info('Backup completed', {
        configId,
        filesTransferred: run.filesTransferred,
        bytesTransferred: run.bytesTransferred,
      });
    }

    runningBackups.delete(configId);
    await appendHistory(run);

    // Fire in-app notification
    try {
      const { addNotification } = await import('./notifications');
      if (code === 0) {
        await addNotification(
          'success',
          `Backup completed: ${config.name}`,
          `${run.filesTransferred} files transferred`,
          'backup',
        );
      } else {
        await addNotification('error', `Backup failed: ${config.name}`, run.error || 'Unknown error', 'backup');
      }
    } catch {
      // notifications module may not be available
    }
  });

  await appendHistory(run);
  return run;
}

/** Dry-run a backup to preview what would transfer */
export async function dryRunBackup(configId: string): Promise<{ files: string[]; summary: string }> {
  const configs = await getBackupConfigs();
  const config = configs.find((c) => c.id === configId);
  if (!config) throw new Error('Backup config not found');

  log.info('Dry-run backup requested', { configId, name: config.name });

  const args = [
    '-avzn', // -n = dry-run
    '--stats',
    ...config.excludes.flatMap((e: string) => ['--exclude', e]),
    config.sourcePath.endsWith('/') ? config.sourcePath : config.sourcePath + '/',
    config.destPath,
  ];

  try {
    const output = execSync(`rsync ${args.map((a) => `'${a}'`).join(' ')}`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    const lines = output.split('\n').filter(Boolean);
    const files = lines.filter(
      (l) =>
        !l.startsWith('sending') &&
        !l.startsWith('sent') &&
        !l.startsWith('total') &&
        !l.startsWith('Number') &&
        !l.startsWith('.'),
    );
    const summary = lines.slice(-5).join('\n');
    return { files, summary };
  } catch (err: unknown) {
    log.error('Dry-run backup failed', { error: errorMessage(err) });
    throw new Error(errorMessage(err));
  }
}

/** Check if rsync is available */
export function isRsyncAvailable(): boolean {
  try {
    execSync('which rsync', { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
