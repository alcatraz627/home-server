import { json } from '@sveltejs/kit';
import os from 'node:os';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();

  // Per-core CPU usage (computed from idle vs total)
  const cpuCores = cpus.map((cpu, i) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return {
      core: i,
      usage: Math.round(((total - idle) / total) * 100),
    };
  });

  // Network I/O from os.networkInterfaces (cumulative bytes not available,
  // but we can show interface count and status)
  const ifaces = os.networkInterfaces();
  const activeIfaces = Object.entries(ifaces)
    .filter(([name]) => !name.startsWith('lo'))
    .flatMap(([, addrs]) => addrs || [])
    .filter((a) => a.family === 'IPv4' && !a.internal);

  return json({
    timestamp: Date.now(),
    cpu: {
      cores: cpuCores,
      avgUsage: Math.round(cpuCores.reduce((s, c) => s + c.usage, 0) / cpuCores.length),
      loadAvg: loadAvg.map((v) => Math.round(v * 100) / 100),
      count: cpus.length,
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    network: {
      interfaces: activeIfaces.length,
      bytesIn: 0,
      bytesOut: 0,
    },
    uptime: os.uptime(),
  });
};
