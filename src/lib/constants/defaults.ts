/**
 * Tier 1 user-editable defaults — values users would reasonably want to change.
 * These will become the foundation for Phase 2 server-side settings.json.
 *
 * For developer/power-user limits, see limits.ts.
 */

// ---- Clipboard ----
export const CLIPBOARD_MAX_ENTRIES = 50;
export const CLIPBOARD_MAX_CONTENT_LENGTH = 10_000;

// ---- Tasks ----
export const TASK_HISTORY_LIMIT = 200;
export const TASK_OUTPUT_BUFFER_SIZE = 10_240;

// ---- Backups ----
export const BACKUP_HISTORY_LIMIT = 100;

// ---- Logging ----
export const LOG_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const LOG_MAX_FILES = 10;
export const LOG_RETENTION_DAYS = 30;

// ---- Toast notifications ----
export const TOAST_DURATION = {
  success: 4000,
  warning: 5000,
  error: 0, // manual dismiss
  info: 2000,
} as const;

// ---- Lights ----
export const LIGHTS_DISCOVERY_TIMEOUT_MS = 3000;
export const LIGHTS_POLL_INTERVAL_MS = 5000;
