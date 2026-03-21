import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [sveltekit()],
		server: {
			host: '0.0.0.0',
			port: parseInt(env.PORT || '5555'),
			allowedHosts: true
		}
	};
});
