import { json } from '@sveltejs/kit';
import { execSync } from 'node:child_process';
import os from 'node:os';
import type { RequestHandler } from './$types';

const platform = os.platform();

interface ServiceStatus {
  name: string;
  installed: boolean;
  running: boolean;
  version: string;
  pid: number | null;
  port: number | null;
  uptime: string;
  memMB: number;
  connections: number;
  error?: string;
}

function cmd(command: string, timeout = 5000): string {
  try {
    return execSync(command, { encoding: 'utf-8', timeout, shell: '/bin/sh' }).trim();
  } catch {
    return '';
  }
}

function isInstalled(bin: string): boolean {
  return !!cmd(`which ${bin} 2>/dev/null`);
}

function getPidInfo(name: string): { pid: number | null; memMB: number } {
  try {
    const out = cmd(`pgrep -x ${name} 2>/dev/null | head -1`);
    const pid = parseInt(out, 10);
    if (isNaN(pid)) return { pid: null, memMB: 0 };
    const psOut = cmd(`ps -p ${pid} -o rss= 2>/dev/null`);
    const memKB = parseInt(psOut.trim(), 10) || 0;
    return { pid, memMB: Math.round(memKB / 1024) };
  } catch {
    return { pid: null, memMB: 0 };
  }
}

function checkPostgres(): ServiceStatus {
  const installed = isInstalled('psql') || isInstalled('pg_isready');
  const running = !!cmd('pg_isready 2>/dev/null | grep accepting');
  const version = cmd("psql --version 2>/dev/null | head -1 | awk '{print $3}'");
  const { pid, memMB } = getPidInfo('postgres');
  const connections = parseInt(cmd("psql -t -c 'SELECT count(*) FROM pg_stat_activity;' 2>/dev/null"), 10) || 0;
  return { name: 'PostgreSQL', installed, running, version, pid, port: 5432, uptime: '', memMB, connections };
}

function checkRedis(): ServiceStatus {
  const installed = isInstalled('redis-cli') || isInstalled('redis-server');
  let running = false;
  let version = '';
  let connections = 0;
  let memMB = 0;
  let uptime = '';

  if (installed) {
    const info = cmd('redis-cli INFO server 2>/dev/null');
    running = info.includes('redis_version');
    version =
      info.match(/redis_version:(.+)/)?.[1]?.trim() ||
      cmd('redis-server --version 2>/dev/null').match(/v=([\d.]+)/)?.[1] ||
      '';
    const uptimeSec = parseInt(info.match(/uptime_in_seconds:(\d+)/)?.[1] || '0', 10);
    uptime = uptimeSec > 3600 ? `${Math.floor(uptimeSec / 3600)}h` : `${Math.floor(uptimeSec / 60)}m`;

    const memInfo = cmd('redis-cli INFO memory 2>/dev/null');
    memMB = Math.round(parseInt(memInfo.match(/used_memory:(\d+)/)?.[1] || '0', 10) / 1048576);

    const clientInfo = cmd('redis-cli INFO clients 2>/dev/null');
    connections = parseInt(clientInfo.match(/connected_clients:(\d+)/)?.[1] || '0', 10);
  }

  const { pid } = getPidInfo('redis-server');
  return { name: 'Redis', installed, running, version, pid, port: 6379, uptime, memMB, connections };
}

function checkMongo(): ServiceStatus {
  const installed = isInstalled('mongosh') || isInstalled('mongo') || isInstalled('mongod');
  let running = false;
  let version = '';
  let connections = 0;

  if (installed) {
    version =
      cmd("mongosh --eval 'db.version()' --quiet 2>/dev/null") ||
      cmd('mongod --version 2>/dev/null').match(/db version v([\d.]+)/)?.[1] ||
      '';
    running = !!cmd("mongosh --eval 'db.runCommand({ping:1})' --quiet 2>/dev/null | grep ok");
    if (running) {
      const serverStatus = cmd("mongosh --eval 'JSON.stringify(db.serverStatus().connections)' --quiet 2>/dev/null");
      try {
        const conn = JSON.parse(serverStatus);
        connections = conn.current || 0;
      } catch {}
    }
  }

  const { pid, memMB } = getPidInfo('mongod');
  return { name: 'MongoDB', installed, running, version, pid, port: 27017, uptime: '', memMB, connections };
}

function checkPM2(): ServiceStatus {
  const installed = isInstalled('pm2');
  let running = false;
  let version = '';
  let connections = 0;

  if (installed) {
    version = cmd('pm2 --version 2>/dev/null');
    const list = cmd('pm2 jlist 2>/dev/null');
    try {
      const processes = JSON.parse(list || '[]');
      running = processes.length > 0;
      connections = processes.filter((p: any) => p.pm2_env?.status === 'online').length;
    } catch {
      running = !!cmd('pm2 list 2>/dev/null | grep online');
    }
  }

  const { pid, memMB } = getPidInfo('pm2');
  return { name: 'PM2', installed, running, version, pid, port: null, uptime: '', memMB, connections };
}

export const GET: RequestHandler = async ({ url }) => {
  const service = url.searchParams.get('service');

  if (service === 'postgres') {
    // Detailed postgres info
    const databases = cmd(
      'psql -t -c "SELECT datname, pg_database_size(datname) FROM pg_database WHERE datistemplate = false;" 2>/dev/null',
    );
    const dbList = databases
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line
          .trim()
          .split('|')
          .map((s) => s.trim());
        return { name: parts[0], sizeBytes: parseInt(parts[1], 10) || 0 };
      });
    return json({ databases: dbList });
  }

  if (service === 'redis') {
    const info = cmd('redis-cli INFO all 2>/dev/null');
    const dbSize = parseInt(cmd('redis-cli DBSIZE 2>/dev/null').match(/(\d+)/)?.[1] || '0', 10);
    return json({ keyCount: dbSize, info: info.slice(0, 2000) });
  }

  if (service === 'pm2') {
    try {
      const list = JSON.parse(cmd('pm2 jlist 2>/dev/null') || '[]');
      const processes = list.map((p: any) => ({
        name: p.name,
        pid: p.pid,
        status: p.pm2_env?.status || 'unknown',
        cpu: p.monit?.cpu || 0,
        memory: Math.round((p.monit?.memory || 0) / 1048576),
        uptime: p.pm2_env?.pm_uptime ? Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
        restarts: p.pm2_env?.restart_time || 0,
      }));
      return json({ processes });
    } catch {
      return json({ processes: [] });
    }
  }

  // Default: return status of all services
  const services = [checkPostgres(), checkRedis(), checkMongo(), checkPM2()];
  return json({ services });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { service, action, target } = body;

  if (service === 'pm2' && action) {
    const safeTarget = (target || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (action === 'restart') {
      cmd(`pm2 restart ${safeTarget} 2>/dev/null`);
      return json({ ok: true });
    }
    if (action === 'stop') {
      cmd(`pm2 stop ${safeTarget} 2>/dev/null`);
      return json({ ok: true });
    }
    if (action === 'start') {
      cmd(`pm2 start ${safeTarget} 2>/dev/null`);
      return json({ ok: true });
    }
    if (action === 'logs') {
      const logs = cmd(`pm2 logs ${safeTarget} --nostream --lines 50 2>/dev/null`);
      return json({ logs });
    }
  }

  if (service === 'redis' && action === 'flushdb') {
    cmd('redis-cli FLUSHDB 2>/dev/null');
    return json({ ok: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};
