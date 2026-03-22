import { json } from '@sveltejs/kit';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';

function getSwapUsage(): { total: number; used: number; usedPercent: number } {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('sysctl vm.swapusage', { encoding: 'utf-8', timeout: 3000 });
      const totalMatch = out.match(/total\s*=\s*([\d.]+)M/);
      const usedMatch = out.match(/used\s*=\s*([\d.]+)M/);
      const total = totalMatch ? parseFloat(totalMatch[1]) * 1024 * 1024 : 0;
      const used = usedMatch ? parseFloat(usedMatch[1]) * 1024 * 1024 : 0;
      return { total, used, usedPercent: total > 0 ? Math.round((used / total) * 100) : 0 };
    } else {
      const out = execSync('free -b', { encoding: 'utf-8', timeout: 3000 });
      const swapLine = out.split('\n').find((l) => l.startsWith('Swap:'));
      if (swapLine) {
        const parts = swapLine.trim().split(/\s+/);
        const total = parseInt(parts[1], 10) || 0;
        const used = parseInt(parts[2], 10) || 0;
        return { total, used, usedPercent: total > 0 ? Math.round((used / total) * 100) : 0 };
      }
    }
  } catch {}
  return { total: 0, used: 0, usedPercent: 0 };
}

function getProcessCount(): number {
  try {
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'linux') {
      const out = execSync('ps -e --no-headers 2>/dev/null | wc -l || ps -ax | tail -n +2 | wc -l', {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      return parseInt(out.trim(), 10) || 0;
    }
  } catch {}
  return 0;
}

function getNetworkThroughput(): { bytesIn: number; bytesOut: number } {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync("netstat -ib | awk '/en0/ && /Link/ {print $7, $10}'", {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      const parts = out.trim().split(/\s+/);
      if (parts.length >= 2) {
        return { bytesIn: parseInt(parts[0], 10) || 0, bytesOut: parseInt(parts[1], 10) || 0 };
      }
    } else {
      const out = execSync("cat /proc/net/dev | awk '/eth0|ens|wlan0/ {print $2, $10}' | head -1", {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      const parts = out.trim().split(/\s+/);
      if (parts.length >= 2) {
        return { bytesIn: parseInt(parts[0], 10) || 0, bytesOut: parseInt(parts[1], 10) || 0 };
      }
    }
  } catch {}
  return { bytesIn: 0, bytesOut: 0 };
}

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

  const swap = getSwapUsage();
  const processCount = getProcessCount();
  const netThroughput = getNetworkThroughput();

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
    swap,
    processCount,
    network: {
      interfaces: activeIfaces.length,
      bytesIn: netThroughput.bytesIn,
      bytesOut: netThroughput.bytesOut,
    },
    uptime: os.uptime(),
  });
};
