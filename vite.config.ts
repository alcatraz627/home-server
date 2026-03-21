import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';

function webSocketPlugin(): Plugin {
	return {
		name: 'websocket-terminal',
		configureServer(server: ViteDevServer) {
			server.httpServer?.on('listening', async () => {
				try {
					const ws = await import('ws');
					const terminalModule = await server.ssrLoadModule('/src/lib/server/terminal.ts');
					const { createSession, getSession, resizeSession } = terminalModule as any;

					const wss = new ws.WebSocketServer({ noServer: true });

					server.httpServer!.on('upgrade', (request: any, socket: any, head: any) => {
						const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

						// Only handle our terminal path — let Vite handle its own HMR
						if (pathname !== '/ws/terminal') return;

						wss.handleUpgrade(request, socket, head, (wsConn: any) => {
							const url = new URL(request.url || '', `http://${request.headers.host}`);
							const cols = parseInt(url.searchParams.get('cols') || '80');
							const rows = parseInt(url.searchParams.get('rows') || '24');
							const sessionParam = url.searchParams.get('session');

							let session = sessionParam ? getSession(sessionParam) : undefined;
							if (!session) session = createSession(cols, rows);

							wsConn.send(JSON.stringify({ type: 'session', id: session.id }));

							const dataHandler = session.onData((data: string) => {
								if (wsConn.readyState === ws.WebSocket.OPEN) {
									wsConn.send(JSON.stringify({ type: 'output', data }));
								}
							});

							wsConn.on('message', (raw: any) => {
								try {
									const msg = JSON.parse(raw.toString());
									if (msg.type === 'input') session.write(msg.data);
									else if (msg.type === 'resize') resizeSession(session.id, msg.cols, msg.rows);
								} catch {}
							});

							wsConn.on('close', () => dataHandler.dispose());
						});
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
