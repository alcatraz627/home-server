/**
 * Unit tests for centralized constants.
 *
 * Ensures all exported constants have sensible values and no accidental
 * zero/NaN/negative values that could cause silent failures in production.
 *
 * Run: npx vitest run tests/unit/constants.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as limits from '../../src/lib/constants/limits';
import * as defaults from '../../src/lib/constants/defaults';

describe('limits.ts', () => {
  describe('timeouts', () => {
    const timeoutConstants = [
      ['SHELL_TIMEOUT_SHORT_MS', limits.SHELL_TIMEOUT_SHORT_MS],
      ['SHELL_TIMEOUT_MEDIUM_MS', limits.SHELL_TIMEOUT_MEDIUM_MS],
      ['SHELL_TIMEOUT_LONG_MS', limits.SHELL_TIMEOUT_LONG_MS],
      ['TRACEROUTE_TIMEOUT_MS', limits.TRACEROUTE_TIMEOUT_MS],
      ['PORT_SCAN_TIMEOUT_MS', limits.PORT_SCAN_TIMEOUT_MS],
      ['BACKUP_RSYNC_TIMEOUT_MS', limits.BACKUP_RSYNC_TIMEOUT_MS],
      ['WIZ_UDP_TIMEOUT_MS', limits.WIZ_UDP_TIMEOUT_MS],
      ['RATE_LIMITER_CLEANUP_INTERVAL_MS', limits.RATE_LIMITER_CLEANUP_INTERVAL_MS],
    ] as const;

    for (const [name, value] of timeoutConstants) {
      it(`${name} is a positive number`, () => {
        expect(value).toBeGreaterThan(0);
        expect(Number.isFinite(value)).toBe(true);
      });
    }

    it('short < medium < long timeout ordering', () => {
      expect(limits.SHELL_TIMEOUT_SHORT_MS).toBeLessThan(limits.SHELL_TIMEOUT_MEDIUM_MS);
      expect(limits.SHELL_TIMEOUT_MEDIUM_MS).toBeLessThan(limits.SHELL_TIMEOUT_LONG_MS);
    });
  });

  describe('numeric limits', () => {
    const limitConstants = [
      ['LOG_QUERY_DEFAULT_LIMIT', limits.LOG_QUERY_DEFAULT_LIMIT],
      ['LOG_QUERY_MAX_LIMIT', limits.LOG_QUERY_MAX_LIMIT],
      ['PROCESS_LSOF_MAX_FILES', limits.PROCESS_LSOF_MAX_FILES],
      ['PROCESS_LSOF_MAX_CONNECTIONS', limits.PROCESS_LSOF_MAX_CONNECTIONS],
      ['SERVICE_HISTORY_LIMIT', limits.SERVICE_HISTORY_LIMIT],
      ['TASK_COMPLETION_MAX_ATTEMPTS', limits.TASK_COMPLETION_MAX_ATTEMPTS],
      ['MACOS_CONVERSATIONS_LIMIT', limits.MACOS_CONVERSATIONS_LIMIT],
      ['MACOS_MESSAGES_LIMIT', limits.MACOS_MESSAGES_LIMIT],
      ['MACOS_CONTACTS_LIMIT', limits.MACOS_CONTACTS_LIMIT],
    ] as const;

    for (const [name, value] of limitConstants) {
      it(`${name} is a positive integer`, () => {
        expect(value).toBeGreaterThan(0);
        expect(Number.isInteger(value)).toBe(true);
      });
    }

    it('LOG_QUERY_DEFAULT_LIMIT < LOG_QUERY_MAX_LIMIT', () => {
      expect(limits.LOG_QUERY_DEFAULT_LIMIT).toBeLessThan(limits.LOG_QUERY_MAX_LIMIT);
    });
  });

  describe('network constants', () => {
    it('WIZ_UDP_PORT is valid port number', () => {
      expect(limits.WIZ_UDP_PORT).toBeGreaterThan(0);
      expect(limits.WIZ_UDP_PORT).toBeLessThanOrEqual(65535);
    });

    it('WOL_BROADCAST_PORT is 9 (standard)', () => {
      expect(limits.WOL_BROADCAST_PORT).toBe(9);
    });

    it('NTFY_DEFAULT_SERVER is valid URL', () => {
      expect(limits.NTFY_DEFAULT_SERVER).toMatch(/^https?:\/\//);
    });
  });

  describe('macOS constants', () => {
    it('MACOS_EPOCH_OFFSET_SECONDS is 2001-01-01 offset', () => {
      // 978307200 = seconds between Unix epoch (1970) and Mac epoch (2001-01-01)
      expect(limits.MACOS_EPOCH_OFFSET_SECONDS).toBe(978307200);
    });

    it('MACOS_SQLITE3_MAX_BUFFER is 20MB', () => {
      expect(limits.MACOS_SQLITE3_MAX_BUFFER).toBe(20 * 1024 * 1024);
    });
  });
});

describe('defaults.ts', () => {
  it('CLIPBOARD_MAX_ENTRIES is reasonable', () => {
    expect(defaults.CLIPBOARD_MAX_ENTRIES).toBeGreaterThanOrEqual(10);
    expect(defaults.CLIPBOARD_MAX_ENTRIES).toBeLessThanOrEqual(500);
  });

  it('TASK_OUTPUT_BUFFER_SIZE is reasonable', () => {
    expect(defaults.TASK_OUTPUT_BUFFER_SIZE).toBeGreaterThanOrEqual(1024);
  });

  it('LOG_MAX_FILE_SIZE is at least 1MB', () => {
    expect(defaults.LOG_MAX_FILE_SIZE).toBeGreaterThanOrEqual(1024 * 1024);
  });

  it('TOAST_DURATION values are non-negative', () => {
    expect(defaults.TOAST_DURATION.success).toBeGreaterThan(0);
    expect(defaults.TOAST_DURATION.warning).toBeGreaterThan(0);
    expect(defaults.TOAST_DURATION.error).toBeGreaterThanOrEqual(0); // 0 = manual dismiss
    expect(defaults.TOAST_DURATION.info).toBeGreaterThan(0);
  });
});
