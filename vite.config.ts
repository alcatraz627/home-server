import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

function webSocketPlugin(): Plugin {
	return {
		name: 'websocket-terminal',
		configureServer(server) {
			server.httpServer?.on('listening', () => {
				try {
					// Dynamic require to avoid Vite transforming the imports
					const { WebSocketServer } = require('ws');
					const { createSession, getSession, resizeSession } = require('./src/lib/server/terminal');

					const wss = new WebSocketServer({ noServer: true });

					server.httpServer!.on('upgrade', (request: any, socket: any, head: any) => {
						const url = new URL(request.url || '', `http://${request.headers.host}`);

						// Only handle our terminal path — let Vite handle /__vite_hmr
						if (url.pathname === '/ws/terminal') {
							wss.handleUpgrade(request, socket, head, (ws: any) => {
								const cols = parseInt(url.searchParams.get('cols') || '80');
								const rows = parseInt(url.searchParams.get('rows') || '24');
								const sessionParam = url.searchParams.get('session');

								let session = sessionParam ? getSession(sessionParam) : undefined;
								if (!session) session = createSession(cols, rows);

								ws.send(JSON.stringify({ type: 'session', id: session.id }));

								const dataHandler = session.pty.onData((data: string) => {
									if (ws.readyState === 1) {
										ws.send(JSON.stringify({ type: 'output', data }));
									}
								});

								ws.on('message', (raw: any) => {
									try {
										const msg = JSON.parse(raw.toString());
										if (msg.type === 'input') session.pty.write(msg.data);
										else if (msg.type === 'resize') resizeSession(session.id, msg.cols, msg.rows);
									} catch {}
								});

								ws.on('close', () => dataHandler.dispose());
							});
						}
						// Don't destroy socket for non-matching paths — Vite HMR needs it
					});

					console.log('WebSocket terminal server attached');
				} catch (err) {
					console.error('Failed to start WebSocket terminal:', err);
				}
			});
		}
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [sveltekit(), webSocketPlugin()],
		server: {
			host: '0.0.0.0',
			port: parseInt(env.PORT || '5555'),
			allowedHosts: true
		}
	};
});
