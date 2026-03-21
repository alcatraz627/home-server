import * as pty from 'node-pty';
import os from 'node:os';

export interface TerminalSession {
	id: string;
	pty: pty.IPty;
	createdAt: Date;
}

const sessions = new Map<string, TerminalSession>();

const DEFAULT_SHELL = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh');

/** Create a new terminal session */
export function createSession(cols = 80, rows = 24): TerminalSession {
	const id = Math.random().toString(36).slice(2, 10);
	const shell = pty.spawn(DEFAULT_SHELL, [], {
		name: 'xterm-256color',
		cols,
		rows,
		cwd: os.homedir(),
		env: process.env as Record<string, string>
	});

	const session: TerminalSession = { id, pty: shell, createdAt: new Date() };
	sessions.set(id, session);

	shell.onExit(() => {
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
		session.pty.kill();
		sessions.delete(id);
	}
}

/** Resize a session's terminal */
export function resizeSession(id: string, cols: number, rows: number): void {
	const session = sessions.get(id);
	if (session) {
		session.pty.resize(cols, rows);
	}
}

/** List active sessions */
export function listSessions(): { id: string; createdAt: Date }[] {
	return Array.from(sessions.values()).map(s => ({
		id: s.id,
		createdAt: s.createdAt
	}));
}
