import os from 'node:os';
import { execSync } from 'node:child_process';
import type { LayoutServerLoad } from './$types';

function getSwapPercent(): number {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('sysctl vm.swapusage', { encoding: 'utf-8', timeout: 3000 });
      const totalMatch = out.match(/total\s*=\s*([\d.]+)M/);
      const usedMatch = out.match(/used\s*=\s*([\d.]+)M/);
      const total = totalMatch ? parseFloat(totalMatch[1]) : 0;
      const used = usedMatch ? parseFloat(usedMatch[1]) : 0;
      return total > 0 ? Math.round((used / total) * 100) : 0;
    } else {
      const out = execSync('free -b', { encoding: 'utf-8', timeout: 3000 });
      const swapLine = out.split('\n').find((l) => l.startsWith('Swap:'));
      if (swapLine) {
        const parts = swapLine.trim().split(/\s+/);
        const total = parseInt(parts[1], 10) || 0;
        const used = parseInt(parts[2], 10) || 0;
        return total > 0 ? Math.round((used / total) * 100) : 0;
      }
    }
  } catch {}
  return 0;
}

function getProcessCount(): number {
  try {
    const out = execSync('ps -ax | tail -n +2 | wc -l', {
      encoding: 'utf-8',
      timeout: 3000,
      shell: '/bin/sh',
    });
    return parseInt(out.trim(), 10) || 0;
  } catch {}
  return 0;
}

function getNetworkBytes(): { bytesIn: number; bytesOut: number } {
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
    }
  } catch {}
  return { bytesIn: 0, bytesOut: 0 };
}

function getDiskIO(): { readBytesPerSec: number; writeBytesPerSec: number } {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('iostat -d -c 2 -w 1 2>/dev/null | tail -1', {
        encoding: 'utf-8',
        timeout: 5000,
        shell: '/bin/sh',
      });
      const parts = out.trim().split(/\s+/);
      // iostat on macOS: KB/t, tps, MB/s (for each disk)
      // We take the first disk's MB/s as a rough estimate
      if (parts.length >= 3) {
        const mbPerSec = parseFloat(parts[2]) || 0;
        return { readBytesPerSec: Math.round(mbPerSec * 1048576), writeBytesPerSec: 0 };
      }
    } else {
      // Linux: read from /proc/diskstats
      const out = execSync("cat /proc/diskstats | awk '/sda |nvme0n1 / {print $6, $10}'", {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      const parts = out.trim().split(/\s+/);
      if (parts.length >= 2) {
        // sectors * 512 bytes
        return {
          readBytesPerSec: (parseInt(parts[0], 10) || 0) * 512,
          writeBytesPerSec: (parseInt(parts[1], 10) || 0) * 512,
        };
      }
    }
  } catch {}
  return { readBytesPerSec: 0, writeBytesPerSec: 0 };
}

export const load: LayoutServerLoad = async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const [load1, load5, load15] = os.loadavg();
  const uptimeSec = os.uptime();
  const bootTime = new Date(Date.now() - uptimeSec * 1000).toISOString();

  return {
    device: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    },
    system: {
      memUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      memTotal: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
      cpuCount: cpus.length,
      loadAvg: Math.round(load1 * 100) / 100,
      loadAvg5: Math.round(load5 * 100) / 100,
      loadAvg15: Math.round(load15 * 100) / 100,
      uptime: Math.floor(uptimeSec / 3600),
      bootTime,
      swapPercent: getSwapPercent(),
      processCount: getProcessCount(),
      networkBytes: getNetworkBytes(),
      diskIO: getDiskIO(),
    },
  };
};
