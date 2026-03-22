# Notifications

## Overview

Central hub for all system events — backup completions, task failures, service outages, and agent activity. Replaces scattered toast notifications with a persistent, searchable log.

## How to Use

- **View:** All notifications listed newest-first with type badge, source, and timestamp
- **Filter:** By type (info/success/warning/error) or source (backup/task/service/system/agent)
- **Mark read:** Click to mark individual notifications read, or "Mark All Read" for bulk
- **Clear:** Remove all notifications with "Clear All"
- **Badge:** Unread count shown in the navbar

## Data Flow

```
Event (backup/task/service) → notifications.ts → notifications.json
Page → GET /api/notifications → list
     → POST /api/notifications → mark read / clear
```

## Notification Sources

| Source | Events |
|--------|--------|
| Backup | Completion (success/fail), dry-run results |
| Task | Execution complete, timeout, retry exhausted |
| Service | Status change (UP → DOWN, DOWN → UP) |
| System | Disk usage alerts, high memory |
| Agent | Keeper agent start/stop/complete |
