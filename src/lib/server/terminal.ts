import crypto from 'node:crypto';
import * as pty from 'node-pty';
import {
  TERMINAL_SCROLLBACK_LIMIT,
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
  TERMINAL_RESIZE_DEBOUNCE_MS,
} from '$lib/constants/limits';
import { createLogger } from './logger';

const log = createLogger('terminal');

export interface ClientDimensions {
  cols: number;
  rows: number;
}

export interface TerminalSession {
  id: string;
  label: string;
  pid: number;
  createdAt: Date;
  scrollback: string;
  readonly clientCount: number;
  onData: (cb: (data: string) => void) => { dispose: () => void };
  onExit: (cb: (code: number) => void) => { dispose: () => void };
  onClientCountChange: (cb: (count: number) => void) => { dispose: () => void };
  onRename: (cb: (label: string) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  registerClient: (token: symbol, dims: ClientDimensions) => void;
  unregisterClient: (token: symbol) => void;
  updateClientDims: (token: symbol, dims: ClientDimensions) => void;
}

const sessions = new Map<string, TerminalSession>();
const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';
const SCROLLBACK_LIMIT = TERMINAL_SCROLLBACK_LIMIT;

/** Keys to exclude from the PTY environment — API keys, tokens, secrets */
const ENV_BLACKLIST = new Set([
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'NPM_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GOOGLE_API_KEY',
  'SLACK_TOKEN',
  'SLACK_BOT_TOKEN',
  'DATABASE_URL',
  'REDIS_URL',
  'MONGO_URI',
  'JWT_SECRET',
  'SESSION_SECRET',
  'COOKIE_SECRET',
  'ENCRYPTION_KEY',
  'PRIVATE_KEY',
]);

function filterEnv(env: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (ENV_BLACKLIST.has(key)) continue;
    // Also filter any key containing SECRET, TOKEN, KEY, PASSWORD (case-insensitive)
    const upper = key.toUpperCase();
    if (upper.includes('SECRET') || upper.includes('_TOKEN') || upper.includes('_KEY') || upper.includes('PASSWORD')) {
      continue;
    }
    filtered[key] = value;
  }
  return filtered;
}

log.info('Terminal module initialized', { shell: DEFAULT_SHELL });

/** Create a new terminal session */
export function createSession(cols = TERMINAL_DEFAULT_COLS, rows = TERMINAL_DEFAULT_ROWS): TerminalSession {
  const id = crypto.randomUUID().slice(0, 8);

  const term = pty.spawn(DEFAULT_SHELL, ['--login'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env: filterEnv(process.env as Record<string, string>),
  });

  let scrollback = '';
  let _label = DEFAULT_SHELL.split('/').pop() || 'shell';

  // Per-client dimension tracking for minimum-wins PTY resize
  const clientDims = new Map<symbol, ClientDimensions>();
  const countListeners = new Set<(n: number) => void>();
  const renameListeners = new Set<(s: string) => void>();
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Recalculate PTY size as minimum across all connected clients (debounced 100ms) */
  function recalcDims() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (clientDims.size === 0) return;
      const minCols = Math.max(40, Math.min(...[...clientDims.values()].map((d) => d.cols)));
      const minRows = Math.max(10, Math.min(...[...clientDims.values()].map((d) => d.rows)));
      term.resize(minCols, minRows);
    }, TERMINAL_RESIZE_DEBOUNCE_MS);
  }

  term.onData((data: string) => {
    scrollback += data;
    if (scrollback.length > SCROLLBACK_LIMIT) {
      scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
    }
  });

  const session: TerminalSession = {
    id,
    get label() {
      return _label;
    },
    set label(v: string) {
      _label = v;
      renameListeners.forEach((cb) => cb(v));
    },
    pid: term.pid,
    createdAt: new Date(),
    get scrollback() {
      return scrollback;
    },
    set scrollback(v: string) {
      scrollback = v;
    },
    get clientCount() {
      return clientDims.size;
    },
    onData: (cb: (data: string) => void) => {
      const disposable = term.onData(cb);
      return { dispose: () => disposable.dispose() };
    },
    onExit: (cb: (code: number) => void) => {
      const disposable = term.onExit(({ exitCode }) => cb(exitCode));
      return { dispose: () => disposable.dispose() };
    },
    onClientCountChange: (cb: (count: number) => void) => {
      countListeners.add(cb);
      return {
        dispose: () => {
          countListeners.delete(cb);
        },
      };
    },
    onRename: (cb: (label: string) => void) => {
      renameListeners.add(cb);
      return {
        dispose: () => {
          renameListeners.delete(cb);
        },
      };
    },
    write: (data: string) => term.write(data),
    resize: (cols: number, rows: number) => term.resize(cols, rows),
    kill: () => term.kill(),
    registerClient: (token: symbol, dims: ClientDimensions) => {
      clientDims.set(token, dims);
      recalcDims();
      countListeners.forEach((cb) => cb(clientDims.size));
      log.info('Client registered', { id, clientCount: clientDims.size });
    },
    unregisterClient: (token: symbol) => {
      clientDims.delete(token);
      recalcDims();
      countListeners.forEach((cb) => cb(clientDims.size));
      log.info('Client unregistered', { id, clientCount: clientDims.size });
    },
    updateClientDims: (token: symbol, dims: ClientDimensions) => {
      if (clientDims.has(token)) {
        clientDims.set(token, dims);
        recalcDims();
      }
    },
  };

  sessions.set(id, session);
  log.info('Session created', { id, pid: term.pid, cols, rows });
  term.onExit(() => {
    log.info('Session shell exited', { id });
    if (resizeTimer) clearTimeout(resizeTimer);
    sessions.delete(id);
  });

  return session;
}

/** Get an existing session */
export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

/** Destroy a session */
export function destroySession(id: string): void {
  const session = sessions.get(id);
  if (session) {
    log.info('Session destroyed', { id, pid: session.pid });
    session.kill();
    sessions.delete(id);
  }
}

/** Resize a session's terminal directly (bypasses multi-client dim negotiation) */
export function resizeSession(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (session) session.resize(cols, rows);
}

/** Rename a session — fires onRename listeners on all attached clients */
export function renameSession(id: string, label: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.label = label;
  return true;
}

/** List all active sessions */
export function listSessions(): {
  id: string;
  label: string;
  pid: number;
  uptime: number;
  clientCount: number;
}[] {
  const now = Date.now();
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    label: s.label,
    pid: s.pid,
    uptime: Math.floor((now - s.createdAt.getTime()) / 1000),
    clientCount: s.clientCount,
  }));
}
