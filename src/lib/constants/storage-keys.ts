/**
 * Single source of truth for all localStorage and sessionStorage key names.
 * All keys use the `hs:` prefix for namespace isolation.
 *
 * Convention: SCREAMING_SNAKE for the export name, hs:kebab-case for the value.
 */

// ---- Layout & Navigation ----
export const SK_THEME = 'hs:theme';
export const SK_SIDEBAR_COLLAPSED = 'hs:sidebar-collapsed';
export const SK_SIDEBAR_WIDTH = 'hs:sidebar-width';
export const SK_NAV_GROUPS = 'hs:nav-groups';
export const SK_NAV_PINNED = 'hs:nav-pinned';
export const SK_STATS_CONFIG = 'hs:stats-config';
export const SK_INSTALL_DISMISSED = 'hs:install-dismissed';
export const SK_DASHBOARD_LAYOUT = 'hs:dashboard-layout'; // v1, used in migration only
export const SK_DASHBOARD_LAYOUT_V2 = 'hs:dashboard-layout-v2';
export const SK_STARRED = 'hs:starred';

// ---- Device Context ----
export const SK_DEVICE_CONTEXT = 'hs:device-context';
export const SK_REMOTE_DEVICES = 'hs:remote-devices';

// ---- Files ----
export const SK_FILE_VIEW = 'hs:file-view';
export const SK_FILE_TABS = 'hs:file-tabs';

// ---- Tools ----
export const SK_CLIPBOARD_DEVICE_ID = 'hs:clipboard-device-id';
export const SK_CLIPBOARD_DEVICE_NAME = 'hs:clipboard-device-name';
export const SK_SPEEDTEST_HISTORY = 'hs:speedtest-history';
export const SK_DNS_HISTORY = 'hs:dns-history';
export const SK_DNS_TRACE_HISTORY = 'hs:dns-trace-history';
export const SK_PORT_SCAN_HISTORY = 'hs:port-scan-history';

// ---- Productivity ----
export const SK_AI_CONVOS = 'hs:ai-convos';
export const SK_CUSTOM_TEMPLATES = 'hs:custom-templates';
export const SK_HIDDEN_TASKS = 'hs:hidden-tasks';

// ---- Smart Home ----
export const SK_LIGHTS_CONFIG = 'hs:lights-config';
export const SK_LIGHTS_CACHE = 'hs:lights-cache'; // sessionStorage
export const SK_BULB_ORDER = 'hs:bulb-order';
export const SK_PERIPHERALS_CACHE = 'hs:peripherals-cache'; // sessionStorage
export const SK_WIFI_PRIVACY = 'hs:wifi-privacy'; // blur SSIDs/BSSIDs in UI

// ---- Terminal ----
export const SK_TERMINAL_SESSIONS = 'hs:terminal-sessions'; // sessionStorage
