import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import type { RequestHandler } from './$types';
import os from 'node:os';

/** GET /api/health — quick health check for the selected server */
export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('target');

  // Local health check
  if (!target || target === 'local') {
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadRatio = loadAvg / cpuCount;
    const memUsed = 1 - os.freemem() / os.totalmem();

    let status: 'green' | 'yellow' | 'red' = 'green';
    if (loadRatio > 0.9 || memUsed > 0.95) status = 'red';
    else if (loadRatio > 0.7 || memUsed > 0.85) status = 'yellow';

    return json({
      status,
      latency: 0,
      hostname: os.hostname(),
      uptime: Math.floor(os.uptime() / 3600),
      load: Math.round(loadAvg * 100) / 100,
      memPercent: Math.round(memUsed * 100),
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
    if (latency > 2000) status = 'red';
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
