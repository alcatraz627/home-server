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

// ---- Shell Command Timeouts ----
export const SHELL_TIMEOUT_SHORT_MS = 3000;
export const SHELL_TIMEOUT_MEDIUM_MS = 5000;
export const SHELL_TIMEOUT_LONG_MS = 10_000;

// ---- Task Scheduler ----
export const TASK_COMPLETION_MAX_ATTEMPTS = 900;
export const TASK_COMPLETION_POLL_MS = 2000;
export const TASK_RETRY_BACKOFF_BASE_MS = 1000;

// ---- Backup ----
export const BACKUP_RSYNC_TIMEOUT_MS = 30_000;

// ---- Processes ----
export const PROCESS_LSOF_MAX_FILES = 50;
export const PROCESS_LSOF_MAX_CONNECTIONS = 20;

// ---- Services ----
export const SERVICE_HISTORY_LIMIT = 100;

// ---- Rate Limiting ----
export const RATE_LIMITER_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ---- Messages (macOS) ----
export const MACOS_SQLITE3_MAX_BUFFER = 20 * 1024 * 1024;
export const MACOS_EPOCH_OFFSET_SECONDS = 978307200;
export const MACOS_NANOSECOND_THRESHOLD = 1e14;
export const MACOS_CONVERSATIONS_LIMIT = 50;
export const MACOS_MESSAGES_LIMIT = 100;
export const MACOS_CONTACTS_LIMIT = 200;

// ---- Network Protocols ----
export const WIZ_UDP_PORT = 38899;
export const WIZ_UDP_TIMEOUT_MS = 2000;
export const WOL_BROADCAST_PORT = 9;
export const WOL_MAC_REPETITIONS = 16;
export const NTFY_DEFAULT_SERVER = 'https://ntfy.sh';

// ---- Speedtest ----
export const SPEEDTEST_DOWNLOAD_SIZE_BYTES = 10_000_000;
export const SPEEDTEST_UPLOAD_SIZE_BYTES = 2_097_152;
export const SPEEDTEST_PING_COUNT = 3;
export const SPEEDTEST_CURL_MAX_TIME_SECS = 15;
export const SPEEDTEST_CURL_TIMEOUT_MS = 20_000;
export const SPEEDTEST_LATENCY_TIMEOUT_MS = 10_000;

// ---- WiFi Diagnostics ----
export const WIFI_DIAG_GATEWAY_TIMEOUT_MS = 3000;
export const WIFI_DIAG_PING_TIMEOUT_MS = 15_000;
export const WIFI_DIAG_DNS_TIMEOUT_MS = 5000;
export const WIFI_DIAG_TRACEROUTE_TIMEOUT_MS = 15_000;
export const WIFI_DIAG_INTERNET_TIMEOUT_MS = 8000;
export const WIFI_DIAG_INTERNET_MAX_TIME_SECS = 5;

// ---- Messages (macOS send) ----
export const MACOS_SEND_MESSAGE_TIMEOUT_MS = 10_000;
export const MACOS_SEND_ATTACHMENT_TIMEOUT_MS = 15_000;

// ---- Search ----
export const SEARCH_EXCERPT_MAX_LEN = 80;
export const SEARCH_RESULTS_LIMIT = 20;

// ---- Health ----
export const HEALTH_LATENCY_THRESHOLD_MS = 2000;

// ---- Error Handling ----
export const ERROR_MESSAGE_TRUNCATE_LENGTH = 200;

// ---- Terminal ----
export const TERMINAL_RESIZE_DEBOUNCE_MS = 100;
