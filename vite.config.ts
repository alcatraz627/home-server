import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

function webSocketPlugin(): Plugin {
	return {
		name: 'websocket-terminal',
		configureServer(server) {
			// Lazy import to avoid loading node-pty at config time
			server.httpServer?.on('listening', async () => {
				const { setupWebSocket } = await import('./src/lib/server/ws');
				setupWebSocket(server.httpServer!);
				console.log('WebSocket terminal server attached');
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
