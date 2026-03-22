import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * UI Audit API — helps Claude inspect the running app.
 *
 * GET /api/audit — returns page inventory with health checks
 * GET /api/audit?page=/files — checks a specific page's server data
 */

const PAGES = [
  '/',
  '/files',
  '/lights',
  '/processes',
  '/tailscale',
  '/backups',
  '/tasks',
  '/keeper',
  '/terminal',
  '/peripherals',
  '/apps',
  '/logs',
  '/qr',
  '/bookmarks',
  '/kanban',
  '/wol',
  '/dns',
  '/ports',
  '/speedtest',
  '/clipboard',
  '/screenshots',
  '/benchmarks',
  '/wifi',
  '/packets',
  '/network',
  '/services',
  '/notifications',
  '/docker',
  '/docs',
  '/showcase',
];

const API_ENDPOINTS = [
  '/api/system',
  '/api/processes',
  '/api/tailscale',
  '/api/wifi',
  '/api/peripherals',
  '/api/apps',
  '/api/bookmarks',
  '/api/kanban',
  '/api/wol',
  '/api/clipboard',
  '/api/screenshots',
  '/api/benchmarks',
  '/api/backups',
  '/api/tasks',
  '/api/keeper',
  '/api/lights',
  '/api/services',
  '/api/notifications',
  '/api/docker',
  '/api/logs?action=stats',
];

export const GET: RequestHandler = async ({ url, fetch: serverFetch }) => {
  const targetPage = url.searchParams.get('page');

  if (targetPage) {
    // Check a specific page's data endpoint
    try {
      const res = await serverFetch(targetPage);
      return json({
        page: targetPage,
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get('content-type'),
      });
    } catch (e: any) {
      return json({ page: targetPage, status: 500, ok: false, error: e.message });
    }
  }

  // Full audit — check all API endpoints
  const results: { endpoint: string; status: number; ok: boolean; responseTime: number; error?: string }[] = [];

  for (const endpoint of API_ENDPOINTS) {
    const start = Date.now();
    try {
      const res = await serverFetch(endpoint);
      results.push({
        endpoint,
        status: res.status,
        ok: res.ok,
        responseTime: Date.now() - start,
      });
    } catch (e: any) {
      results.push({
        endpoint,
        status: 0,
        ok: false,
        responseTime: Date.now() - start,
        error: e.message,
      });
    }
  }

  const passing = results.filter((r) => r.ok).length;
  const failing = results.filter((r) => !r.ok).length;
  const avgResponseTime = Math.round(results.reduce((s, r) => s + r.responseTime, 0) / results.length);

  return json({
    summary: `${passing} passing, ${failing} failing, avg ${avgResponseTime}ms`,
    pages: PAGES,
    apiHealth: results,
    timestamp: new Date().toISOString(),
  });
};
