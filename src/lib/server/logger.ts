import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DATA_DIR = path.join(os.homedir(), '.home-server');
const LOG_DIR = path.join(DATA_DIR, 'logs');

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per log file
const MAX_FILES = 10; // Keep 10 rotated files
const RETENTION_DAYS = 30; // Delete logs older than 30 days

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  error?: { message: string; stack?: string };
}

// ── Ensure directories ────────────────────────────────────────────────────────
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// ── Log file path ─────────────────────────────────────────────────────────────
function getLogPath(name = 'app'): string {
  return path.join(LOG_DIR, `${name}.log`);
}

// ── Rotation ──────────────────────────────────────────────────────────────────
function rotateIfNeeded(logPath: string) {
  try {
    if (!fs.existsSync(logPath)) return;
    const stat = fs.statSync(logPath);
    if (stat.size < MAX_FILE_SIZE) return;

    // Shift existing rotated files: app.9.log → delete, app.8.log → app.9.log, etc.
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const from = `${logPath}.${i}`;
      const to = `${logPath}.${i + 1}`;
      if (fs.existsSync(from)) {
        if (i + 1 >= MAX_FILES) {
          fs.unlinkSync(from);
        } else {
          fs.renameSync(from, to);
        }
      }
    }
    // Current → .1
    fs.renameSync(logPath, `${logPath}.1`);
  } catch {
    // Rotation failure shouldn't crash the app
  }
}

// ── Retention cleanup ─────────────────────────────────────────────────────────
function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of fs.readdirSync(LOG_DIR)) {
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // Cleanup failure shouldn't crash the app
  }
}

// Run cleanup on module load (once per server start)
ensureLogDir();
cleanOldLogs();

// ── Write ─────────────────────────────────────────────────────────────────────
function writeLog(entry: LogEntry, logName = 'app') {
  try {
    ensureLogDir();
    const logPath = getLogPath(logName);
    rotateIfNeeded(logPath);

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch {
    // Logging failure shouldn't crash the app
    console.error('[logger] Failed to write log:', entry.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createLogger(module: string) {
  function log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...(data !== undefined ? { data } : {}),
    };

    // Also log to console for dev
    const prefix = `[${level.toUpperCase()}] [${module}]`;
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else if (level === 'debug') {
      if (process.env.DEBUG) console.log(prefix, message, data || '');
    }
    // info goes only to file (reduce console noise)

    writeLog(entry);
  }

  return {
    debug: (msg: string, data?: any) => log('debug', msg, data),
    info: (msg: string, data?: any) => log('info', msg, data),
    warn: (msg: string, data?: any) => log('warn', msg, data),
    error: (msg: string, errorOrData?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        module,
        message: msg,
      };
      if (errorOrData instanceof Error) {
        entry.error = { message: errorOrData.message, stack: errorOrData.stack };
      } else if (errorOrData) {
        entry.data = errorOrData;
      }
      writeLog(entry);
      console.error(`[ERROR] [${module}]`, msg, errorOrData || '');
    },
  };
}

// ── Log reading (for API/agent access) ────────────────────────────────────────

export interface LogQueryOptions {
  logName?: string;
  level?: LogLevel;
  module?: string;
  since?: string; // ISO timestamp
  limit?: number;
  search?: string; // text search in message
}

export function queryLogs(opts: LogQueryOptions = {}): LogEntry[] {
  const { logName = 'app', level, module, since, limit = 200, search } = opts;
  const logPath = getLogPath(logName);

  if (!fs.existsSync(logPath)) return [];

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let entries: LogEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    // Filters
    if (level) entries = entries.filter((e) => e.level === level);
    if (module) entries = entries.filter((e) => e.module === module);
    if (since) entries = entries.filter((e) => e.timestamp >= since);
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          JSON.stringify(e.data || '')
            .toLowerCase()
            .includes(q),
      );
    }

    // Return most recent first, limited
    return entries.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export function getLogFiles(): { name: string; size: number; modified: string }[] {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.endsWith('.log'))
    .map((f) => {
      const stat = fs.statSync(path.join(LOG_DIR, f));
      return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

export function getLogStats(): {
  totalFiles: number;
  totalSize: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  errorCount: number;
  warnCount: number;
} {
  const files = getLogFiles();
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  // Quick count from main log
  const entries = queryLogs({ limit: 10000 });
  const errorCount = entries.filter((e) => e.level === 'error').length;
  const warnCount = entries.filter((e) => e.level === 'warn').length;

  return {
    totalFiles: files.length,
    totalSize,
    oldestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
    newestEntry: entries.length > 0 ? entries[0].timestamp : null,
    errorCount,
    warnCount,
  };
}
