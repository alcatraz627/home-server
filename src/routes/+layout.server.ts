import os from 'node:os';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const cpus = os.cpus();
	const avgLoad = os.loadavg()[0]; // 1-minute load average

	return {
		device: {
			hostname: os.hostname(),
			platform: os.platform(),
			arch: os.arch()
		},
		system: {
			memUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
			memTotal: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10,
			cpuCount: cpus.length,
			loadAvg: Math.round(avgLoad * 100) / 100,
			uptime: Math.floor(os.uptime() / 3600)
		}
	};
};
