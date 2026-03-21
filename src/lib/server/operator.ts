import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { notifyTaskComplete } from './notify';

// --- Types ---

export interface TaskConfig {
  id: string;
  name: string;
  /** Shell command to execute */
  command: string;
  /** Working directory (defaults to home) */
  cwd?: string;
  /** Cron expression for scheduling (null = manual only) */
  schedule: string | null;
  /** Timeout in seconds */
  timeout: number;
  /** Max retry count on failure */
  maxRetries: number;
  /** Whether notifications are enabled for this task */
  notify: boolean;
  enabled: boolean;
}

export interface TaskRun {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'timeout';
  exitCode: number | null;
  output: string;
  attempt: number;
  duration: number | null;
}

export interface TaskStatus {
  config: TaskConfig;
  lastRun: TaskRun | null;
  isRunning: boolean;
}

// --- Storage ---

const CONFIG_DIR = path.join(os.homedir(), '.home-server');
const TASKS_FILE = path.join(CONFIG_DIR, 'tasks.json');
const TASK_HISTORY_FILE = path.join(CONFIG_DIR, 'task-history.json');

const runningTasks = new Map<string, { process: any; run: TaskRun }>();

async function ensureDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

// --- Config CRUD ---

export async function getTaskConfigs(): Promise<TaskConfig[]> {
  await ensureDir();
  if (!existsSync(TASKS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export async function saveTaskConfig(config: TaskConfig): Promise<void> {
  const configs = await getTaskConfigs();
  const idx = configs.findIndex((c) => c.id === config.id);
  if (idx >= 0) configs[idx] = config;
  else configs.push(config);
  await fs.writeFile(TASKS_FILE, JSON.stringify(configs, null, 2));
}

export async function deleteTaskConfig(id: string): Promise<void> {
  const configs = await getTaskConfigs();
  await fs.writeFile(
    TASKS_FILE,
    JSON.stringify(
      configs.filter((c) => c.id !== id),
      null,
      2,
    ),
  );
}

// --- History ---

export async function getTaskHistory(taskId?: string): Promise<TaskRun[]> {
  await ensureDir();
  if (!existsSync(TASK_HISTORY_FILE)) return [];
  try {
    const all: TaskRun[] = JSON.parse(readFileSync(TASK_HISTORY_FILE, 'utf-8'));
    return taskId ? all.filter((r) => r.taskId === taskId) : all;
  } catch {
    return [];
  }
}

async function appendTaskHistory(run: TaskRun): Promise<void> {
  const history = await getTaskHistory();
  const idx = history.findIndex((r) => r.id === run.id);
  if (idx >= 0) history[idx] = run;
  else history.push(run);
  await fs.writeFile(TASK_HISTORY_FILE, JSON.stringify(history.slice(-200), null, 2));
}

// --- Status ---

export async function getTaskStatuses(): Promise<TaskStatus[]> {
  const configs = await getTaskConfigs();
  const history = await getTaskHistory();

  return configs.map((config) => {
    const runs = history.filter((r) => r.taskId === config.id);
    const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
    const running = runningTasks.get(config.id);
    return {
      config,
      lastRun: running ? running.run : lastRun,
      isRunning: !!running,
    };
  });
}

// --- Run task ---

export async function runTask(taskId: string, attempt = 1): Promise<TaskRun> {
  const configs = await getTaskConfigs();
  const config = configs.find((c) => c.id === taskId);
  if (!config) throw new Error('Task not found');
  if (runningTasks.has(taskId)) throw new Error('Task already running');

  const run: TaskRun = {
    id: `${taskId}-${Date.now()}`,
    taskId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    exitCode: null,
    output: '',
    attempt,
    duration: null,
  };

  const startMs = Date.now();
  const proc = spawn('sh', ['-c', config.command], {
    cwd: config.cwd || os.homedir(),
    stdio: 'pipe',
    env: { ...process.env, HOME_SERVER_TASK_ID: taskId },
  });

  runningTasks.set(taskId, { process: proc, run });

  // Timeout
  const timer = setTimeout(() => {
    proc.kill('SIGKILL');
    run.status = 'timeout';
  }, config.timeout * 1000);

  proc.stdout?.on('data', (d: Buffer) => {
    run.output += d.toString();
    // Cap output at 10KB
    if (run.output.length > 10240) run.output = run.output.slice(-10240);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    run.output += d.toString();
    if (run.output.length > 10240) run.output = run.output.slice(-10240);
  });

  proc.on('close', async (code: number | null) => {
    clearTimeout(timer);
    run.completedAt = new Date().toISOString();
    run.exitCode = code;
    run.duration = Date.now() - startMs;

    if (run.status !== 'timeout') {
      run.status = code === 0 ? 'success' : 'failed';
    }

    runningTasks.delete(taskId);
    await appendTaskHistory(run);

    // Send notification (only on final attempt or success)
    if (config.notify && (run.status === 'success' || attempt >= config.maxRetries)) {
      notifyTaskComplete(config.name, run.status as any, run.duration || undefined).catch(() => {});
    }

    // Retry on failure
    if (run.status === 'failed' && attempt < config.maxRetries) {
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      setTimeout(() => runTask(taskId, attempt + 1), delay);
    }
  });

  await appendTaskHistory(run);
  return run;
}

// --- Built-in tasks ---

export function getSystemDiskUsage(): {
  mount: string;
  total: string;
  used: string;
  available: string;
  usePercent: string;
}[] {
  try {
    const raw = execSync('df -h / /Volumes/* 2>/dev/null || df -h', { encoding: 'utf-8', timeout: 3000 });
    const lines = raw.trim().split('\n').slice(1);
    const disks = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const device = parts[0];
        return {
          device,
          mount: parts[parts.length - 1],
          total: parts[1],
          used: parts[2],
          available: parts[3],
          usePercent: parts[4],
          fstype: '',
        };
      })
      .filter(
        (d) => !d.mount.includes('/dev') && !d.mount.includes('/private') && !d.mount.startsWith('/System/Volumes'),
      );
    // Deduplicate by device — prefer "/" mount over others for same disk
    const byDevice = new Map<string, (typeof disks)[0]>();
    for (const d of disks) {
      const existing = byDevice.get(d.device);
      if (!existing || d.mount === '/') {
        byDevice.set(d.device, d);
      }
    }
    return [...byDevice.values()];
  } catch {
    return [];
  }
}
