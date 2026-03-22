import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { sanitizeShellArg } from '$lib/server/security';

const isMac = os.platform() === 'darwin';

interface AppDetail {
  name: string;
  pids: number[];
  cpu: number;
  mem: number;
  memMB: number;
  openFiles: number;
  path: string;
  version: string;
}

export const GET: RequestHandler = async ({ params }) => {
  const appName = params.name;
  if (!appName) {
    return json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const safeName = sanitizeShellArg(appName);
    let pids: number[] = [];
    let cpu = 0;
    let mem = 0;
    let memMB = 0;
    let openFiles = 0;
    let appPath = '';
    let version = '';

    if (isMac) {
      // Get PIDs matching app
      try {
        const pidOut = execSync(`pgrep -f "/Applications/${safeName}.app" 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 3000,
        });
        pids = pidOut
          .trim()
          .split('\n')
          .map((s) => parseInt(s, 10))
          .filter((n) => !isNaN(n));
      } catch {}

      if (pids.length > 0) {
        // Get CPU and MEM for all PIDs
        for (const pid of pids) {
          try {
            const psOut = execSync(`ps -p ${pid} -o %cpu,%mem,rss 2>/dev/null | tail -1`, {
              encoding: 'utf-8',
              timeout: 3000,
              shell: '/bin/sh',
            });
            const parts = psOut.trim().split(/\s+/);
            cpu += parseFloat(parts[0]) || 0;
            mem += parseFloat(parts[1]) || 0;
            memMB += (parseInt(parts[2], 10) || 0) / 1024;
          } catch {}
        }

        // Count open files for main PID
        try {
          const lsofOut = execSync(`lsof -p ${pids[0]} 2>/dev/null | wc -l`, {
            encoding: 'utf-8',
            timeout: 5000,
            shell: '/bin/sh',
          });
          openFiles = parseInt(lsofOut.trim(), 10) || 0;
        } catch {}
      }

      // Get version from Info.plist
      appPath = `/Applications/${appName}.app`;
      try {
        const plistOut = execSync(
          `defaults read "/Applications/${safeName}.app/Contents/Info" CFBundleShortVersionString 2>/dev/null`,
          { encoding: 'utf-8', timeout: 3000 },
        );
        version = plistOut.trim();
      } catch {}
    } else {
      // Linux: use pgrep
      try {
        const pidOut = execSync(`pgrep -f "${safeName}" 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 3000,
        });
        pids = pidOut
          .trim()
          .split('\n')
          .map((s) => parseInt(s, 10))
          .filter((n) => !isNaN(n));
      } catch {}

      if (pids.length > 0) {
        for (const pid of pids) {
          try {
            const psOut = execSync(`ps -p ${pid} -o %cpu,%mem,rss 2>/dev/null | tail -1`, {
              encoding: 'utf-8',
              timeout: 3000,
              shell: '/bin/sh',
            });
            const parts = psOut.trim().split(/\s+/);
            cpu += parseFloat(parts[0]) || 0;
            mem += parseFloat(parts[1]) || 0;
            memMB += (parseInt(parts[2], 10) || 0) / 1024;
          } catch {}
        }

        try {
          const lsofOut = execSync(`ls /proc/${pids[0]}/fd 2>/dev/null | wc -l`, {
            encoding: 'utf-8',
            timeout: 3000,
            shell: '/bin/sh',
          });
          openFiles = parseInt(lsofOut.trim(), 10) || 0;
        } catch {}

        try {
          const pathOut = execSync(`readlink -f /proc/${pids[0]}/exe 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 3000,
          });
          appPath = pathOut.trim();
        } catch {}
      }
    }

    const detail: AppDetail = {
      name: appName,
      pids,
      cpu: Math.round(cpu * 10) / 10,
      mem: Math.round(mem * 10) / 10,
      memMB: Math.round(memMB),
      openFiles,
      path: appPath,
      version,
    };

    return json(detail);
  } catch (e: any) {
    return json({ error: e.message || 'Failed to get app details' }, { status: 500 });
  }
};
