# Backups

The Backups page manages data protection by creating, scheduling, and restoring file backups. It provides a UI for configuring backup jobs and viewing backup history.

## How to Use

- **View** existing backup snapshots with timestamp, size, and status
- **Create** a new backup manually by clicking the backup button
- **Schedule** automatic backups using cron-style scheduling
- **Restore** from a previous snapshot by selecting it from the history list
- **Delete** old backups to reclaim disk space

## Data Flow

1. `src/routes/backups/+page.svelte` renders the backup management UI
2. `src/routes/backups/+page.server.ts` lists backup snapshots and configuration
3. `src/routes/api/backups/+server.ts` handles create, restore, delete, and schedule operations
4. `src/lib/server/backups.ts` performs the actual file copy/archive operations

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Backup size depends on the source directory; large directories may take time
- Scheduled backups use server-side cron; the browser does not need to be open
- Always verify a restore on non-critical data first
- Disk usage is shown to help decide when to prune old snapshots
