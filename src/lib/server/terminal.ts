import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';

export interface TerminalSession {
	id: string;
	process: ChildProcess;
	createdAt: Date;
	onData: (cb: (data: string) => void) => { dispose: () => void };
	write: (data: string) => void;
	resize: (cols: number, rows: number) => void;
	kill: () => void;
}

const sessions = new Map<string, TerminalSession>();

// Try node-pty first, fall back to child_process
let usePty = false;
let ptyModule: any = null;

try {
	ptyModule = require('node-pty');
	// Quick test spawn
	const test = ptyModule.spawn('/bin/echo', ['test'], { name: 'xterm', cols: 80, rows: 24, cwd: os.homedir() });
	test.kill();
	usePty = true;
	console.log('[terminal] Using node-pty');
} catch {
	console.log('[terminal] node-pty unavailable, using child_process fallback');
}

const SHELL = '/bin/bash'; // bash is more reliable across Node versions than zsh

/** Create a new terminal session */
export function createSession(cols = 80, rows = 24): TerminalSession {
	const id = Math.random().toString(36).slice(2, 10);

	if (usePty && ptyModule) {
		return createPtySession(id, cols, rows);
	}
	return createFallbackSession(id);
}

function createPtySession(id: string, cols: number, rows: number): TerminalSession {
	const pty = ptyModule.spawn(SHELL, ['--login'], {
		name: 'xterm-256color',
		cols,
		rows,
		cwd: os.homedir(),
		env: process.env as Record<string, string>
	});

	const session: TerminalSession = {
		id,
		process: pty,
		createdAt: new Date(),
		onData: (cb: (data: string) => void) => {
			const disposable = pty.onData(cb);
			return { dispose: () => disposable.dispose() };
		},
		write: (data: string) => pty.write(data),
		resize: (cols: number, rows: number) => pty.resize(cols, rows),
		kill: () => pty.kill()
	};

	sessions.set(id, session);
	pty.onExit(() => sessions.delete(id));
	return session;
}

function createFallbackSession(id: string): TerminalSession {
	const proc = spawn(SHELL, ['--login'], {
		stdio: ['pipe', 'pipe', 'pipe'],
		cwd: os.homedir(),
		env: { ...process.env, TERM: 'xterm-256color' }
	});

	const listeners: ((data: string) => void)[] = [];

	proc.stdout?.on('data', (data: Buffer) => {
		const str = data.toString();
		for (const cb of listeners) cb(str);
	});

	proc.stderr?.on('data', (data: Buffer) => {
		const str = data.toString();
		for (const cb of listeners) cb(str);
	});

	const session: TerminalSession = {
		id,
		process: proc,
		createdAt: new Date(),
		onData: (cb: (data: string) => void) => {
			listeners.push(cb);
			return { dispose: () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } };
		},
		write: (data: string) => proc.stdin?.write(data),
		resize: () => { /* child_process doesn't support resize */ },
		kill: () => proc.kill()
	};

	sessions.set(id, session);
	proc.on('close', () => sessions.delete(id));
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
