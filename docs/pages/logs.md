# Logs

## Overview

View and manage application logs. Search, filter by level/module, and inspect error details with stack traces. Useful for debugging issues and monitoring server health.

## How to Use

- **Search:** Free-text search across all log messages and data
- **Level filter:** Show only errors, warnings, info, or debug entries
- **Module filter:** Filter by source module (operator, backups, terminal, etc.)
- **Expand:** Click any log entry to see full details, data payload, and error stack
- **Files tab:** View all log files with sizes and dates

## Data Flow

```
Server modules → createLogger('module') → ~/.home-server/logs/app.log
Page → GET /api/logs?level=error&search=fail → JSON entries
     → GET /api/logs?action=stats → error/warning counts
     → GET /api/logs?action=diagnose → agent-friendly error digest
```

## Log Format

JSON Lines — one JSON object per line:
```json
{"timestamp":"2026-03-22T12:00:00Z","level":"error","module":"backups","message":"Backup failed","error":{"message":"rsync: connection refused","stack":"..."}}
```

## Rotation & Retention

- **Max file size:** 5MB per log file (rotates to app.log.1, .2, etc.)
- **Max files:** 10 rotated files kept
- **Retention:** 30 days — older files auto-deleted on server start

## Agent Integration

The `/api/logs?action=diagnose` endpoint returns a structured error digest designed for AI agents to analyze and suggest fixes.
