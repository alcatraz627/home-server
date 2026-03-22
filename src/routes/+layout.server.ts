import os from 'node:os';
import { execSync } from 'node:child_process';
import type { LayoutServerLoad } from './$types';
import { getPrimaryInterface } from '$lib/server/network-utils';

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
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      // ps -ax can be slow — use sysctl for instant count
      const out = execSync('sysctl -n kern.proc.all 2>/dev/null | wc -l', {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      const count = parseInt(out.trim(), 10);
      if (count > 0) return count;
    }
    // Fallback for both platforms
    const out = execSync('ps -e --no-headers 2>/dev/null | wc -l', {
      encoding: 'utf-8',
      timeout: 3000,
      shell: '/bin/sh',
    });
    const count = parseInt(out.trim(), 10);
    if (count > 0) return count;

    // Second fallback — simpler ps
    const out2 = execSync('ps aux 2>/dev/null | wc -l', {
      encoding: 'utf-8',
      timeout: 3000,
      shell: '/bin/sh',
    });
    return Math.max(0, (parseInt(out2.trim(), 10) || 1) - 1); // subtract header
  } catch {}
  return 0;
}

/** Get actual available memory on macOS using vm_stat */
function getMemUsedPercent(): number {
  const totalMem = os.totalmem();
  const platform = os.platform();

  if (platform === 'darwin') {
    try {
      const out = execSync('vm_stat', { encoding: 'utf-8', timeout: 3000 });
      // vm_stat reports in pages (usually 16384 bytes on Apple Silicon, 4096 on Intel)
      const pageSizeMatch = out.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;

      const freeMatch = out.match(/Pages free:\s+(\d+)/);
      const inactiveMatch = out.match(/Pages inactive:\s+(\d+)/);
      const purgableMatch = out.match(/Pages purgeable:\s+(\d+)/);
      const speculativeMatch = out.match(/Pages speculative:\s+(\d+)/);

      const freePages = parseInt(freeMatch?.[1] || '0', 10);
      const inactivePages = parseInt(inactiveMatch?.[1] || '0', 10);
      const purgablePages = parseInt(purgableMatch?.[1] || '0', 10);
      const speculativePages = parseInt(speculativeMatch?.[1] || '0', 10);

      // Available = free + inactive + purgeable + speculative
      const availableBytes = (freePages + inactivePages + purgablePages + speculativePages) * pageSize;
      const usedBytes = totalMem - availableBytes;
      return Math.round((usedBytes / totalMem) * 100);
    } catch {}
  }

  // Linux / fallback: os.freemem() works correctly on Linux
  const freeMem = os.freemem();
  return Math.round(((totalMem - freeMem) / totalMem) * 100);
}

function getNetworkBytes(): { bytesIn: number; bytesOut: number } {
  try {
    const platform = os.platform();
    const iface = getPrimaryInterface();
    if (platform === 'darwin') {
      const out = execSync(`netstat -ib | awk '/${iface}/ && /Link/ {print $7, $10}'`, {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      const parts = out.trim().split(/\s+/);
      if (parts.length >= 2) {
        return { bytesIn: parseInt(parts[0], 10) || 0, bytesOut: parseInt(parts[1], 10) || 0 };
      }
    } else {
      // Linux: read from /sys/class/net
      const rxOut = execSync(`cat /sys/class/net/${iface}/statistics/rx_bytes 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 3000,
      });
      const txOut = execSync(`cat /sys/class/net/${iface}/statistics/tx_bytes 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 3000,
      });
      return {
        bytesIn: parseInt(rxOut.trim(), 10) || 0,
        bytesOut: parseInt(txOut.trim(), 10) || 0,
      };
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

function getOpenFileDescriptors(): number {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('sysctl kern.num_files', { encoding: 'utf-8', timeout: 3000 });
      return parseInt(out.match(/(\d+)/)?.[1] || '0', 10);
    } else {
      const out = execSync('cat /proc/sys/fs/file-nr 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      return parseInt(out.trim().split('\t')[0] || '0', 10);
    }
  } catch {}
  return 0;
}

function getTcpConnections(): number {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('netstat -an -p tcp 2>/dev/null | grep ESTABLISHED | wc -l', {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      return parseInt(out.trim(), 10) || 0;
    } else {
      const out = execSync('ss -t state established 2>/dev/null | tail -n +2 | wc -l', {
        encoding: 'utf-8',
        timeout: 3000,
        shell: '/bin/sh',
      });
      return parseInt(out.trim(), 10) || 0;
    }
  } catch {}
  return 0;
}

function getContextSwitches(): number {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const out = execSync('sysctl -n vm.stats.sys.v_swtch 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      return parseInt(out.trim(), 10) || 0;
    } else {
      const out = execSync('grep ctxt /proc/stat 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      return parseInt(out.split(/\s+/)[1] || '0', 10);
    }
  } catch {}
  return 0;
}

export const load: LayoutServerLoad = async () => {
  const totalMem = os.totalmem();
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
      memUsedPercent: getMemUsedPercent(),
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
      openFDs: getOpenFileDescriptors(),
      tcpConnections: getTcpConnections(),
      contextSwitches: getContextSwitches(),
    },
  };
};
