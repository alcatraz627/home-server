import { json } from '@sveltejs/kit';
import os from 'node:os';
import { execSync } from 'node:child_process';
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

  // Network I/O
  let networkIO = { bytesIn: 0, bytesOut: 0 };
  try {
    const ifaces = os.networkInterfaces();
    // On macOS, use netstat for actual bytes
    const raw = execSync('netstat -ib 2>/dev/null | head -20', { encoding: 'utf-8', timeout: 2000 });
    const lines = raw.trim().split('\n');
    for (const line of lines.slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'en0' || parts[0] === 'en1') {
        const ibytes = parseInt(parts[6]) || 0;
        const obytes = parseInt(parts[9]) || 0;
        if (ibytes > networkIO.bytesIn) {
          networkIO = { bytesIn: ibytes, bytesOut: obytes };
        }
      }
    }
  } catch {
    // Fallback — no network data
  }

  // Disk I/O (macOS: iostat)
  let diskIO = { readsPerSec: 0, writesPerSec: 0 };
  try {
    const raw = execSync('iostat -d 2>/dev/null | tail -1', { encoding: 'utf-8', timeout: 1000 });
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 3) {
      diskIO = { readsPerSec: parseFloat(parts[0]) || 0, writesPerSec: parseFloat(parts[1]) || 0 };
    }
  } catch {
    // Fallback
  }

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
    network: networkIO,
    disk: diskIO,
    uptime: os.uptime(),
  });
};
