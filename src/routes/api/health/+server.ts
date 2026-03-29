import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import type { RequestHandler } from './$types';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { HEALTH_LATENCY_THRESHOLD_MS } from '$lib/constants/limits';

function getMemPercent(): number {
  const totalMem = os.totalmem();
  if (os.platform() === 'darwin') {
    try {
      const out = execSync('vm_stat', { encoding: 'utf-8', timeout: 3000 });
      const pageSizeMatch = out.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;
      const free = parseInt(out.match(/Pages free:\s+(\d+)/)?.[1] || '0', 10);
      const inactive = parseInt(out.match(/Pages inactive:\s+(\d+)/)?.[1] || '0', 10);
      const purgable = parseInt(out.match(/Pages purgeable:\s+(\d+)/)?.[1] || '0', 10);
      const speculative = parseInt(out.match(/Pages speculative:\s+(\d+)/)?.[1] || '0', 10);
      const available = (free + inactive + purgable + speculative) * pageSize;
      return Math.round(((totalMem - available) / totalMem) * 100);
    } catch {}
  }
  return Math.round(((totalMem - os.freemem()) / totalMem) * 100);
}

/** GET /api/health — quick health check for the selected server */
export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('target');

  // Local health check
  if (!target || target === 'local') {
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadRatio = loadAvg / cpuCount;
    const memPercent = getMemPercent();
    const memUsed = memPercent / 100;

    let status: 'green' | 'yellow' | 'red' = 'green';
    if (loadRatio > 0.9 || memUsed > 0.95) status = 'red';
    else if (loadRatio > 0.7 || memUsed > 0.85) status = 'yellow';

    return json({
      status,
      latency: 0,
      hostname: os.hostname(),
      uptime: Math.floor(os.uptime() / 3600),
      load: Math.round(loadAvg * 100) / 100,
      memPercent,
    });
  }

  // Remote health check — ping the target's health API
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`http://${target}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (!res.ok) {
      return json({
        status: latency > 3000 ? 'red' : 'yellow',
        latency,
        error: `HTTP ${res.status}`,
      });
    }

    const data = await res.json();

    // Determine status based on latency + remote health
    let status: 'green' | 'yellow' | 'red' = data.status || 'green';
    if (latency > HEALTH_LATENCY_THRESHOLD_MS) status = 'red';
    else if (latency > 500) status = status === 'red' ? 'red' : 'yellow';

    return json({
      ...data,
      status,
      latency,
    });
  } catch (e: unknown) {
    const latency = Date.now() - start;
    return json({
      status: 'red' as const,
      latency,
      error: (e as Error).name === 'AbortError' ? 'Timeout' : errorMessage(e) || 'Unreachable',
    });
  }
};
