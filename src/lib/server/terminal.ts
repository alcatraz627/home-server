import * as pty from 'node-pty';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('terminal');

export interface TerminalSession {
  id: string;
  label: string;
  pid: number;
  createdAt: Date;
  scrollback: string;
  onData: (cb: (data: string) => void) => { dispose: () => void };
  onExit: (cb: (code: number) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

const sessions = new Map<string, TerminalSession>();
const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';
const SCROLLBACK_LIMIT = 5000;

log.info('Terminal module initialized', { shell: DEFAULT_SHELL });

/** Create a new terminal session */
export function createSession(cols = 80, rows = 24): TerminalSession {
  const id = Math.random().toString(36).slice(2, 10);

  const term = pty.spawn(DEFAULT_SHELL, ['--login'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });

  let scrollback = '';

  term.onData((data: string) => {
    scrollback += data;
    if (scrollback.length > SCROLLBACK_LIMIT) {
      scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
    }
  });

  const session: TerminalSession = {
    id,
    label: DEFAULT_SHELL.split('/').pop() || 'shell',
    pid: term.pid,
    createdAt: new Date(),
    get scrollback() {
      return scrollback;
    },
    set scrollback(v: string) {
      scrollback = v;
    },
    onData: (cb: (data: string) => void) => {
      const disposable = term.onData(cb);
      return { dispose: () => disposable.dispose() };
    },
    onExit: (cb: (code: number) => void) => {
      const disposable = term.onExit(({ exitCode }) => cb(exitCode));
      return { dispose: () => disposable.dispose() };
    },
    write: (data: string) => term.write(data),
    resize: (cols: number, rows: number) => term.resize(cols, rows),
    kill: () => term.kill(),
  };

  sessions.set(id, session);
  log.info('Session created', { id, pid: term.pid, cols, rows });
  term.onExit(() => {
    log.info('Session shell exited', { id });
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

/** Resize a session's terminal */
export function resizeSession(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (session) session.resize(cols, rows);
}

/** List all active sessions */
export function listSessions(): { id: string; label: string; pid: number; uptime: number }[] {
  const now = Date.now();
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    label: s.label,
    pid: s.pid,
    uptime: Math.floor((now - s.createdAt.getTime()) / 1000),
  }));
}
