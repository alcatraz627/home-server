/**
 * Centralized numeric limits, timeouts, and size caps.
 * Tier 2 constants — developer/power-user values extracted from inline literals.
 *
 * For user-editable Tier 1 settings, see defaults.ts.
 */

// ---- Benchmarks ----
export const BENCHMARK_CPU_PRIME_LIMIT = 100_000;
export const BENCHMARK_MEMORY_SIZE_MB = 64;
export const BENCHMARK_DISK_SIZE_MB = 32;

// ---- Speed Test ----
export const SPEEDTEST_DEFAULT_SIZE_KB = 1024;
export const SPEEDTEST_MAX_SIZE_KB = 10240;

// ---- File Search ----
export const FILE_SEARCH_MAX_DEPTH = 5;
export const FILE_SEARCH_MAX_RESULTS = 50;

// ---- Logs ----
export const LOG_QUERY_DEFAULT_LIMIT = 200;
export const LOG_QUERY_MAX_LIMIT = 1000;
export const LOG_PREVIEW_MAX_LINES = 500;

// ---- Network / Traceroute ----
export const TRACEROUTE_MAX_HOPS = 20;
export const TRACEROUTE_TIMEOUT_MS = 30_000;

// ---- Port Scanner ----
export const PORT_SCAN_MAX_RANGE = 1023;
export const PORT_SCAN_LARGE_CAP = 1024;
export const PORT_SCAN_CONCURRENCY = 20;
export const PORT_SCAN_TIMEOUT_MS = 1500;
export const PORT_SCAN_FULL_CONCURRENCY = 50;
export const PORT_SCAN_FULL_TIMEOUT_MS = 800;

// ---- Terminal ----
export const TERMINAL_SCROLLBACK_LIMIT = 5000;
export const TERMINAL_DEFAULT_COLS = 80;
export const TERMINAL_DEFAULT_ROWS = 24;

// ---- Agent ----
export const AGENT_KILL_GRACE_MS = 5000;
