import { json } from '@sveltejs/kit';
import { queryLogs, getLogFiles, getLogStats, type LogLevel } from '$lib/server/logger';
import type { RequestHandler } from './$types';

/** GET /api/logs — query logs with filters */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  // List log files
  if (action === 'files') {
    return json({ files: getLogFiles() });
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
