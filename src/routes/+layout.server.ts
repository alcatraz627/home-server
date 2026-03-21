import os from 'node:os';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return {
		device: {
			hostname: os.hostname(),
			platform: os.platform(),
			arch: os.arch()
		}
	};
};
