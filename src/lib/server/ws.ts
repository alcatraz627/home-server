import { WebSocketServer, WebSocket } from 'ws';
import { createSession, getSession, resizeSession, destroySession } from './terminal';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

let wss: WebSocketServer | null = null;

/** Initialize WebSocket server and attach to an HTTP server's upgrade event */
export function setupWebSocket(server: { on: (event: string, handler: (...args: any[]) => void) => void }) {
	if (wss) return;

	wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
		const url = new URL(request.url || '', `http://${request.headers.host}`);

		if (url.pathname === '/ws/terminal') {
			wss!.handleUpgrade(request, socket, head, (ws) => {
				handleTerminalConnection(ws, url);
			});
		} else {
			socket.destroy();
		}
	});
}

function handleTerminalConnection(ws: WebSocket, url: URL) {
	const cols = parseInt(url.searchParams.get('cols') || '80');
	const rows = parseInt(url.searchParams.get('rows') || '24');
	const sessionId = url.searchParams.get('session');

	// Resume existing session or create new one
	let session = sessionId ? getSession(sessionId) : undefined;
	if (!session) {
		session = createSession(cols, rows);
	}

	// Send session ID to client
	ws.send(JSON.stringify({ type: 'session', id: session.id }));

	// PTY → client
	const dataHandler = session.pty.onData((data: string) => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'output', data }));
		}
	});

	// Client → PTY
	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());
			if (msg.type === 'input' && session) {
				session.pty.write(msg.data);
			} else if (msg.type === 'resize' && session) {
				resizeSession(session.id, msg.cols, msg.rows);
			}
		} catch { /* ignore malformed messages */ }
	});

	ws.on('close', () => {
		dataHandler.dispose();
		// Don't destroy session on disconnect — allow reconnection
	});
}
