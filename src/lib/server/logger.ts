import fs from 'node:fs';
import path from 'node:path';
import { LOG_MAX_FILE_SIZE, LOG_MAX_FILES, LOG_RETENTION_DAYS } from '$lib/constants/defaults';
import { PATHS } from '$lib/server/paths';

const LOG_DIR = PATHS.logs;

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = LOG_MAX_FILE_SIZE; // 5MB per log file
const MAX_FILES = LOG_MAX_FILES; // Keep 10 rotated files
const RETENTION_DAYS = LOG_RETENTION_DAYS; // Delete logs older than 30 days

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
  offset?: number;
  search?: string; // text search in message
}

export function queryLogs(opts: LogQueryOptions = {}): { entries: LogEntry[]; total: number } {
  const { logName = 'app', level, module, since, limit = 200, offset = 0, search } = opts;
  const logPath = getLogPath(logName);

  if (!fs.existsSync(logPath)) return { entries: [], total: 0 };

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const hasFilters = !!(level || module || since || search);
    const searchLower = search?.toLowerCase();

    // When no filters, read from end (most recent) and stop early
    if (!hasFilters) {
      const result: LogEntry[] = [];
      const needed = offset + limit;
      for (let i = lines.length - 1; i >= 0 && result.length < needed; i--) {
        try {
          result.push(JSON.parse(lines[i]));
        } catch {
          // Skip malformed lines
        }
      }
      return { entries: result.slice(offset, offset + limit), total: lines.length };
    }

    // With filters, scan all lines but in reverse to get most recent first
    const matched: LogEntry[] = [];
    let totalMatched = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry: LogEntry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (level && entry.level !== level) continue;
      if (module && entry.module !== module) continue;
      if (since && entry.timestamp < since) continue;
      if (searchLower) {
        const msgMatch = entry.message.toLowerCase().includes(searchLower);
        const dataMatch = entry.data ? JSON.stringify(entry.data).toLowerCase().includes(searchLower) : false;
        if (!msgMatch && !dataMatch) continue;
      }
      totalMatched++;
      if (totalMatched > offset && matched.length < limit) {
        matched.push(entry);
      }
    }
    return { entries: matched, total: totalMatched };
  } catch {
    return { entries: [], total: 0 };
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

  // Scan the main log file line-by-line without full JSON parsing
  // Just extract level and timestamp with fast string matching
  const logPath = getLogPath('app');
  let errorCount = 0;
  let warnCount = 0;
  let oldestEntry: string | null = null;
  let newestEntry: string | null = null;

  if (fs.existsSync(logPath)) {
    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        // Fast string search avoids JSON.parse per line
        if (line.includes('"level":"error"')) errorCount++;
        else if (line.includes('"level":"warn"')) warnCount++;

        // First and last lines for timestamps
        if (i === 0 || i === lines.length - 1) {
          try {
            const entry = JSON.parse(line);
            if (i === 0) oldestEntry = entry.timestamp;
            if (i === lines.length - 1) newestEntry = entry.timestamp;
          } catch {
            // skip
          }
        }
      }
    } catch {
      // stats failure is non-critical
    }
  }

  return { totalFiles: files.length, totalSize, oldestEntry, newestEntry, errorCount, warnCount };
}
