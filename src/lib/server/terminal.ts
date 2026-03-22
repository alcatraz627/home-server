import * as pty from 'node-pty';
import os from 'node:os';

export interface TerminalSession {
  id: string;
  createdAt: Date;
  onData: (cb: (data: string) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

const sessions = new Map<string, TerminalSession>();
const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';

console.log(`[terminal] Using node-pty with shell: ${DEFAULT_SHELL}`);

/** Create a new terminal session */
export function createSession(cols = 80, rows = 24): TerminalSession {
  const id = Math.random().toString(36).slice(2, 10);

  const term = pty.spawn(DEFAULT_SHELL, ['--login'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: process.env as Record<string, string>,
  });

  const session: TerminalSession = {
    id,
    createdAt: new Date(),
    onData: (cb: (data: string) => void) => {
      const disposable = term.onData(cb);
      return { dispose: () => disposable.dispose() };
    },
    write: (data: string) => term.write(data),
    resize: (cols: number, rows: number) => term.resize(cols, rows),
    kill: () => term.kill(),
  };

  sessions.set(id, session);
  term.onExit(() => {
    console.log(`[terminal] Session ${id} — shell exited`);
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
    session.kill();
    sessions.delete(id);
  }
}

/** Resize a session's terminal */
export function resizeSession(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (session) session.resize(cols, rows);
}
