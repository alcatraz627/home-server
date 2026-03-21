import { execSync } from 'node:child_process';

export interface ProcessInfo {
  pid: number;
  ppid: number;
  user: string;
  name: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  state: string;
  startTime: string;
  command: string;
}

/** Detailed stats fetched on demand (active tier) */
export interface ProcessDetail {
  pid: number;
  openFiles: string[];
  env: Record<string, string>;
  threads: number;
  connections: string[];
}

const ALLOWED_SIGNALS = ['TERM', 'KILL', 'HUP', 'INT', 'STOP', 'CONT', 'USR1', 'USR2'] as const;
export type Signal = (typeof ALLOWED_SIGNALS)[number];

export function listProcesses(sortBy: string = 'cpu'): ProcessInfo[] {
  // Use ps with explicit format to get PPID, VSZ, RSS, STATE
  const raw = execSync('ps -eo user,pid,ppid,%cpu,%mem,vsz,rss,state,start,command', {
    encoding: 'utf-8',
    timeout: 5000,
  });
  const lines = raw.trim().split('\n');
  const processes = lines.slice(1).map(parsePsLine).filter(Boolean) as ProcessInfo[];

  const sortFns: Record<string, (a: ProcessInfo, b: ProcessInfo) => number> = {
    cpu: (a, b) => b.cpu - a.cpu,
    mem: (a, b) => b.mem - a.mem,
    name: (a, b) => a.name.localeCompare(b.name),
    pid: (a, b) => a.pid - b.pid,
  };

  processes.sort(sortFns[sortBy] || sortFns.cpu);
  return processes;
}

export function sendSignal(pid: number, signal: string = 'TERM'): { ok: boolean; error?: string } {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, error: 'Invalid PID' };
  }

  const sig = signal.toUpperCase();
  if (!ALLOWED_SIGNALS.includes(sig as Signal)) {
    return { ok: false, error: `Signal must be one of: ${ALLOWED_SIGNALS.join(', ')}` };
  }

  try {
    execSync(`kill -${sig} ${pid}`, { encoding: 'utf-8', timeout: 3000 });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to send signal' };
  }
}

/** Active tier: fetch detailed info for a specific process (expensive) */
export function getProcessDetail(pid: number): ProcessDetail | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;

  try {
    // Open files via lsof
    let openFiles: string[] = [];
    try {
      const lsofRaw = execSync(`lsof -p ${pid} -Fn 2>/dev/null | grep ^n | head -50`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      openFiles = lsofRaw
        .trim()
        .split('\n')
        .map((l) => l.slice(1))
        .filter(Boolean);
    } catch {
      /* lsof may fail for privileged processes */
    }

    // Environment variables
    let env: Record<string, string> = {};
    try {
      // macOS: ps -p <pid> -E doesn't exist, use /proc on Linux
      // On macOS, env is not easily accessible — skip gracefully
      if (process.platform === 'linux') {
        const envRaw = execSync(`cat /proc/${pid}/environ 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 3000,
        });
        envRaw.split('\0').forEach((entry) => {
          const eq = entry.indexOf('=');
          if (eq > 0) env[entry.slice(0, eq)] = entry.slice(eq + 1);
        });
      }
    } catch {
      /* may fail for other users' processes */
    }

    // Thread count
    let threads = 0;
    try {
      if (process.platform === 'darwin') {
        const out = execSync(`ps -M -p ${pid} | wc -l`, { encoding: 'utf-8', timeout: 3000 });
        threads = Math.max(0, parseInt(out.trim()) - 1); // subtract header
      } else {
        const out = execSync(`ls /proc/${pid}/task 2>/dev/null | wc -l`, { encoding: 'utf-8', timeout: 3000 });
        threads = parseInt(out.trim()) || 0;
      }
    } catch {
      /* ignore */
    }

    // Network connections
    let connections: string[] = [];
    try {
      const connRaw = execSync(`lsof -i -a -p ${pid} -Fn 2>/dev/null | grep ^n | head -20`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      connections = connRaw
        .trim()
        .split('\n')
        .map((l) => l.slice(1))
        .filter(Boolean);
    } catch {
      /* ignore */
    }

    return { pid, openFiles, env, threads, connections };
  } catch {
    return null;
  }
}

function parsePsLine(line: string): ProcessInfo | null {
  // Format: USER PID PPID %CPU %MEM VSZ RSS STATE START COMMAND...
  const parts = line.trim().split(/\s+/);
  if (parts.length < 10) return null;

  const pid = parseInt(parts[1]);
  const ppid = parseInt(parts[2]);
  if (isNaN(pid)) return null;

  const command = parts.slice(9).join(' ');
  const name = command.split('/').pop()?.split(' ')[0] || command;

  return {
    pid,
    ppid: isNaN(ppid) ? 0 : ppid,
    user: parts[0],
    cpu: parseFloat(parts[3]) || 0,
    mem: parseFloat(parts[4]) || 0,
    vsz: parseInt(parts[5]) || 0,
    rss: parseInt(parts[6]) || 0,
    state: parts[7] || '',
    startTime: parts[8],
    command,
    name,
  };
}
