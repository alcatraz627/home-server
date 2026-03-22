import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import { queryLogs, getLogFiles, getLogStats, type LogLevel } from '$lib/server/logger';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RequestHandler } from './$types';

const LOG_DIR = path.join(os.homedir(), '.home-server', 'logs');

/** GET /api/logs — query logs with filters */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  // List log files
  if (action === 'files') {
    return json({ files: getLogFiles() });
  }

  // Raw file content for preview
  if (action === 'raw') {
    const filename = url.searchParams.get('file');
    if (!filename) return json({ error: 'file param required' }, { status: 400 });
    const safeName = path.basename(filename);
    const filePath = path.join(LOG_DIR, safeName);
    try {
      if (!fs.existsSync(filePath)) return json({ error: 'Not found' }, { status: 404 });
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      // Return last 500 lines (most recent)
      return json({ content: lines.slice(-500).join('\n'), totalLines: lines.length, filename: safeName });
    } catch (e: unknown) {
      return json({ error: errorMessage(e) }, { status: 500 });
    }
  }

  // Download log file
  if (action === 'download') {
    const filename = url.searchParams.get('file');
    if (!filename) return json({ error: 'file param required' }, { status: 400 });
    const safeName = path.basename(filename);
    const filePath = path.join(LOG_DIR, safeName);
    try {
      if (!fs.existsSync(filePath)) return json({ error: 'Not found' }, { status: 404 });
      const data = fs.readFileSync(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${safeName}"`,
        },
      });
    } catch (e: unknown) {
      return json({ error: errorMessage(e) }, { status: 500 });
    }
  }

  // Get stats/summary
  if (action === 'stats') {
    return json(getLogStats());
  }

  // Diagnose — return recent errors and warnings for agent analysis
  if (action === 'diagnose') {
    const errors = queryLogs({ level: 'error', limit: 50 });
    const warnings = queryLogs({ level: 'warn', limit: 50 });
    const stats = getLogStats();
    return json({
      stats,
      recentErrors: errors,
      recentWarnings: warnings,
      summary: `${stats.errorCount} errors, ${stats.warnCount} warnings in ${stats.totalFiles} log files (${(stats.totalSize / 1024).toFixed(1)} KB)`,
    });
  }

  // Query with filters
  const level = url.searchParams.get('level') as LogLevel | null;
  const module = url.searchParams.get('module');
  const since = url.searchParams.get('since');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '200');
  const logName = url.searchParams.get('log') || 'app';

  const entries = queryLogs({
    logName,
    level: level || undefined,
    module: module || undefined,
    since: since || undefined,
    search: search || undefined,
    limit: Math.min(limit, 1000),
  });

  return json({ entries, count: entries.length });
};

/** POST /api/logs — receive client-side error reports */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { createLogger } = await import('$lib/server/logger');
  const log = createLogger('client');

  const message = body.message || 'Unknown client error';
  const data: Record<string, unknown> = {};
  if (body.stack) data.stack = body.stack;
  if (body.url) data.url = body.url;
  if (body.component) data.component = body.component;
  if (body.userAgent) data.userAgent = body.userAgent;

  log.error(message, data);
  return json({ ok: true });
};
