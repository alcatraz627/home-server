# Widgets

Each widget is a self-contained feature with its own page, API, and server helper.

> **Note:** For detailed per-page documentation, see the [Page Guides](pages/) directory (24 guides).
> This file covers the original core widgets in detail. New features (QR, Bookmarks, Kanban, Apps, etc.)
> are documented in their individual page guide files.

---

## File Transfer

**Route**: `/files` | **API**: `/api/files/`

A full file manager for uploading, downloading, previewing, renaming, and deleting files across devices.

### Features

- **Drag-and-drop upload** with progress bar (XHR-based for progress tracking)
- **In-browser preview** — click any previewable filename to open a modal:

  | Type         | Renderer             | Tech            |
  | ------------ | -------------------- | --------------- |
  | Images       | Native `<img>`       | Browser         |
  | Video        | Native `<video>`     | Browser         |
  | Audio        | Native `<audio>`     | Browser         |
  | PDF          | `<iframe>`           | Browser         |
  | Excel/CSV    | DataTable component  | SheetJS         |
  | Word (.docx) | HTML conversion      | Mammoth.js      |
  | Markdown     | Custom HTML renderer | Regex parser    |
  | JSON         | Collapsible tree     | Custom renderer |
  | Text/Code    | `<pre>` block        | Plain text      |

- **File info panel** — click `i` to see MIME type, exact size, created/modified dates, permissions, upload source device
- **Rename** — click `mv` for inline editing
- **Delete** — two-stage confirmation (`rm` → `sure?` with 3s auto-revert)
- **Device tracking** — records which IP uploaded each file in `.meta.json`

### DataTable (Excel Preview)

The Excel renderer produces structured data rendered by a reusable `DataTable` component:

- Column sorting (click headers — smart numeric vs. string detection)
- Global search across all columns
- Per-column filter inputs (toggle with "Filters" button)
- Pagination (50 rows per page)
- Multi-sheet workbooks with tab switching

---

## Smart Lights

**Route**: `/lights` | **API**: `/api/lights/`

Controls Wiz smart bulbs on the local network via UDP protocol (port 38899).

### Features

- **Discovery** — broadcasts UDP registration packet, collects responses within 3s
- **On/Off toggle** per bulb
- **Brightness slider** (10-100%, debounced 300ms)
- **Color picker** — native `<input type="color">`
- **Color temperature** presets — Warm (2700K), Neutral (4000K), Cool (6500K)
- **Scene presets** — 16 built-in Wiz scenes (Cozy, Warm White, Party, Ocean, Fireplace, etc.)
- **Bulb naming** — double-click name to rename, stored in localStorage
- **Group control** — select all / individual checkboxes, then group ON/OFF/brightness
- **Auto-polling** — toggle 5s refresh to detect external changes
- **Detailed info** — firmware version, module name, signal strength (RSSI)

### Protocol

Wiz bulbs use a JSON-over-UDP protocol:

- **Discovery**: `{"method":"registration",...}` → broadcast to `255.255.255.255:38899`
- **Get state**: `{"method":"getPilot","params":{}}` → specific bulb IP
- **Set state**: `{"method":"setPilot","params":{"state":true,"dimming":80,...}}` → specific bulb IP

---

## Process Manager

**Route**: `/processes` | **API**: `/api/processes/`

View and manage system processes with deep inspection capabilities.

### Features

- **Process list** — PID, name, CPU%, MEM%, RSS, state, user
- **Sorting** — by CPU, memory, name, or PID
- **Filter** — search by name, command, or PID
- **Auto-refresh** — configurable interval: 2s, 5s, 10s, 30s, 60s
- **Starred processes** — pin important processes to the top (persisted in localStorage)
- **Tree view** — toggle between flat list and PPID-based hierarchy with indentation
- **Expandable rows** — click `▸` to reveal:
  - **Passive tier** (always available): PPID, VSZ, RSS, state, start time, full command
  - **Active tier** (on-demand via "Inspect" button): open files, network connections, thread count, environment variables
- **Signal dropdown** — TERM, KILL, HUP, INT, STOP, CONT, USR1, USR2 with two-stage confirmation
- **Pagination** — shows top 50 by default, "Show all" to expand

---

## Tailscale

**Route**: `/tailscale` | **API**: `/api/tailscale/`

View all devices connected to your Tailscale VPN.

### Features

- **Device list** — hostname, IPv4 address, OS, online/offline status
- **Self indicator** — highlights the current device with "this device" tag
- **Online status** — green/gray dot
- **Refresh** button to re-query Tailscale CLI

### Implementation

Runs `/Applications/Tailscale.app/Contents/MacOS/Tailscale status --json` and parses the Self + Peer entries. Falls back to `tailscale` on non-macOS.

---

## Backups

**Route**: `/backups` | **API**: `/api/backups/`

Configurable rsync-based backup jobs with scheduling and status tracking.

### Features

- **Create backup config** — source path, destination path, exclude patterns, cron schedule
- **Manual trigger** — "Run Now" button with live polling for completion
- **Run history** — last run status (success/failed), files transferred, bytes transferred, duration
- **Error details** — expandable error output on failure
- **Cron scheduling** — standard cron expressions (e.g., `0 2 * * *` for daily at 2am)
- **rsync detection** — warns if rsync is not installed

### Storage

- Configs: `~/.home-server/backups.json`
- History: `~/.home-server/backup-history.json` (last 100 runs)

---

## Tasks (Operator)

**Route**: `/tasks` | **API**: `/api/tasks/`

Config-driven shell task runner with retry, timeout, and notifications.

### Features

- **Create task** — name, shell command, timeout (seconds), max retries, cron schedule
- **Manual trigger** — "Run" button with 1s polling for completion
- **Output viewer** — expandable panel showing captured stdout/stderr (capped at 10KB)
- **Retry** — exponential backoff (2^attempt seconds) on failure, up to maxRetries
- **Timeout** — SIGKILL after configured seconds
- **Cron scheduling** — tasks run automatically on schedule via node-cron
- **Notifications** — ntfy.sh alerts on final success or failure (after all retries exhausted)
- **Disk usage** — visual bar chart of mounted volumes at the top of the page

### Storage

- Configs: `~/.home-server/tasks.json`
- History: `~/.home-server/task-history.json` (last 200 runs)

---

## Terminal

**Route**: `/terminal` | **WebSocket**: `/ws/terminal`

Full web-based terminal emulator accessible from any device on the tailnet.

### Features

- **xterm.js** terminal with 256-color support
- **node-pty** backend — spawns a real shell (zsh/bash)
- **Tab management** — multiple tabs, tab renaming (double-click), middle-click close
- **Session persistence** — sessions survive page navigation via sessionStorage
- **Resize handling** — terminal resizes with the browser window via ResizeObserver
- **Font size controls** — adjustable terminal font size
- **Mobile support** — Ctrl mode button for touch devices
- **Theme-aware** — colors adapt to the active app theme

### Implementation

- Vite plugin hooks into the dev server's HTTP upgrade event for WebSocket
- Messages are JSON: `{type: "input"|"output"|"resize"|"session", ...}`
- PTY spawned with `xterm-256color` term type, user's home directory as CWD
