# Home Server — Project Blueprint

## Vision

A personal device management platform that runs across my devices (laptop, phone, Raspberry Pi) connected via **Tailscale VPN**. The system should feel like a unified control plane for my digital life — file transfers, smart home control, backups, process management — accessible from any device on my tailnet.

---

## Goals

### G1: Seamless File Transfer

- Move files between laptop, phone, and any tailnet device with minimal friction
- Support both push ("send this to my phone") and pull ("grab that file from my laptop")
- No cloud intermediary — all traffic stays on the tailnet
- Simple UI: drag-and-drop or share-sheet integration on mobile

### G2: Extensible Home Dashboard

- A web-based dashboard accessible from any device on the tailnet
- Widget-based architecture — easy to add new capabilities without touching existing ones
- Initial widgets:
  - **Wiz Bulb Control** — on/off, brightness, color, scenes
  - **Process Manager** — view and manage running processes on the laptop
  - **Backup Status** — see last backup time, trigger manual backup, view backup health
- Future widgets can be added by dropping in a new module

### G3: Automated Phone Backups

- Regular, scheduled backups from phone to an external hard drive
- Hard drive can be plugged into laptop OR Raspberry Pi — system adapts
- Incremental backups (don't re-copy unchanged files)
- Backup verification — confirm integrity after transfer
- Notifications on backup success/failure

### G4: Operator Automation

- The system can run autonomous tasks on a schedule or on-demand
- Tasks like: search + download content for a topic, monitor a service, run a cron job
- Push status updates to the user via WhatsApp or a custom notification channel
- Each task is isolated, logged, and can be paused/resumed

---

## Roles

The system operates through three distinct roles. Each role has its own responsibilities, rules, and boundaries.

### Role 1: Product Manager (PM)

**Purpose:** Translate vague user needs into concrete, prioritized goals.

**Responsibilities:**

- Maintain the goals list above — add, refine, reprioritize
- Break goals into deliverable milestones
- Resolve ambiguity by asking the user targeted questions
- Evaluate trade-offs: reliability vs speed, simplicity vs flexibility

**Runtime Rules:**

- [x] Never assume a requirement — ask when unclear
- [x] Prioritize reliability over feature count. A working file transfer beats a half-working dashboard
- [x] Prioritize UX over technical elegance. If it's annoying to use, it's broken
- [x] Every goal must have a "definition of done" before work begins
- [x] Track what's shipped vs what's planned. Avoid scope creep within a milestone
- [x] Consider the "bus factor" — if the user forgets how this works in 6 months, can they still operate it?

### Role 2: Architect

**Purpose:** Design the technical system — what to build, what to reuse, how to deploy.

**Responsibilities:**

- Choose build-vs-buy for each component
- Define the tech stack, project structure, and deployment strategy
- Ensure components are loosely coupled — adding a widget shouldn't require changing the core
- Design for the constraint: this runs on a laptop and/or a Raspberry Pi, not a datacenter

**Runtime Rules:**

- [x] Prefer existing, battle-tested tools over custom code where possible
- [x] All services must work over Tailscale — no port forwarding, no public exposure
- [x] Local dev runs natively (no Docker) for fast iteration; Docker is for deployment only
- [x] Config lives in version control. Secrets live in environment variables or a secrets manager
- [x] No single point of failure for critical paths (backups especially)
- [x] Document every architectural decision with rationale (ADRs or inline)
- [x] Keep resource usage low — this shares hardware with daily-use devices
- [x] Prefer pull-based architectures where possible (polling > always-on connections) to save resources
- [x] All inter-service communication happens over the tailnet using Tailscale IPs/MagicDNS

**Initial Technical Direction:**

- **Runtime:** Docker Compose on each host device
- **Dashboard:** Lightweight web app (SvelteKit — already available in tooling)
- **File Transfer:** Tailscale + a thin API layer, or evaluate Syncthing for the heavy lifting
- **Backups:** Restic or Borg for incremental encrypted backups, triggered via cron
- **Smart Home:** Direct Wiz bulb API (UDP-based, local network only — works on tailnet)
- **Notifications:** WhatsApp via Twilio API, or ntfy.sh for self-hosted push notifications
- **Process Manager:** Lightweight agent running on the laptop, exposing a REST API

### Role 3: Operator

**Purpose:** Execute defined tasks autonomously — scheduled or on-demand.

**Responsibilities:**

- Run background jobs: backups, downloads, monitoring, health checks
- Push status updates and alerts to the user
- Log all actions for auditability
- Recover gracefully from failures (retry with backoff, then alert)

**Runtime Rules:**

- [x] Every task must be idempotent — safe to re-run without side effects
- [x] Every task must have a timeout — no runaway processes
- [x] Every task must log: start time, end time, outcome, errors
- [x] Failed tasks retry up to 3 times with exponential backoff, then alert the user
- [x] Never delete user data without explicit confirmation (even in automated flows)
- [x] Resource limits: operator tasks must not consume more than 25% CPU / 512MB RAM on shared devices
- [x] Notification rules:
  - **Success:** Silent by default, unless user opted in to success notifications
  - **Failure:** Always notify immediately
  - **Progress:** Only for long-running tasks (>5 min), update every 25% progress
- [x] All operator tasks are defined as config files — no hardcoded jobs
- [x] Tasks can be triggered via: cron schedule, API call, dashboard button, or CLI command

---

## Deployment Model

```
┌─────────────────────────────────────────────────────────┐
│                    Tailscale VPN (tailnet)              │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Laptop     │  │  Raspberry   │  │    Phone      │  │
│  │              │  │     Pi       │  │               │  │
│  │ - Dashboard  │  │ - Backup     │  │ - File send/  │  │
│  │ - File API   │  │   storage    │  │   receive     │  │
│  │ - Process    │  │ - File API   │  │ - Dashboard   │  │
│  │   manager    │  │ - Operator   │  │   (browser)   │  │
│  │ - Wiz bulbs  │  │   tasks      │  │ - Backup      │  │
│  │ - Operator   │  │              │  │   source      │  │
│  │   tasks      │  │              │  │               │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Dashboard runs on the laptop (primary) with optional failover to Pi
- Both laptop and Pi can serve as backup storage targets
- Phone is a client — it connects to the dashboard via browser and to file/backup APIs
- All communication uses Tailscale MagicDNS hostnames (e.g., `laptop.tail1234.ts.net`)

---

## Architecture Principles

As features grow, keep the codebase modular and expandable:

- **Server helpers** (`src/lib/server/`) — one file per domain (files, processes, tailscale, wiz). Each exports interfaces + pure functions. No cross-imports between helpers.
- **Renderers** (`src/lib/renderers/`) — plugin-style registry. Add a new renderer by implementing `DocumentRenderer` and registering it. No page changes needed.
- **Components** (`src/lib/components/`) — generic, reusable UI building blocks (DataTable, etc.). No business logic — just props in, events out.
- **API routes** (`src/routes/api/`) — thin wrappers calling server helpers. Keep logic in helpers, not routes.
- **Data tiers** — for expensive operations (GPU stats, lsof, etc.), separate into passive (auto-fetched) and active (user-triggered) tiers to avoid performance overhead.

---

## Milestones

### M1: Foundation

- [x] Project structure with Docker Compose
- [x] Basic dashboard skeleton (SvelteKit)
- [x] Tailscale connectivity verified between devices
- [x] File transfer API — upload/download between devices

### M2: Smart Home + Process Management

- [x] Wiz bulb widget on dashboard
- [x] Process manager widget on dashboard
- [x] Dashboard accessible from phone browser
- [x] View all connected Tailscale clients from the dashboard
- [x] Configurable auto-refresh interval for process manager

### M2.1: File Manager Enhancements

- [x] In-browser file preview for common types (images, text, PDF, video, audio)
- [x] File renaming
- [x] Show OS file info (size, created/modified dates, permissions, MIME type)
- [x] Excel/Office file preview via SheetJS client-side renderer with DataTable (sort, search, filter, pagination)
- [x] Rich markdown renderer (parsed HTML preview instead of raw text)
- [x] JSON viewer with syntax highlighting and collapsible tree
- [x] Track which device uploaded each file (record source IP in .meta.json sidecar)
- [x] File metadata storage — JSON sidecar store (.meta.json) with per-file metadata

### M2.2: Process Manager — Deep Observability

Architecture note: split process stats into two tiers — **passive** (low-overhead, shown for all rows: CPU, MEM, user, uptime) and **active** (on-demand behind a button: GPU usage, disk I/O, open files, network sockets). Expandable row pattern for detailed view.

- [x] Expandable process rows — click to reveal detailed stats (command, PPID, VSZ, RSS, state)
- [x] Active stats tier — "Inspect" button fetches open files (lsof), thread count, environment vars
- [x] Starred/pinned processes — persist to localStorage, always shown at top of list
- [x] Process tree view — parent/child hierarchy via PPID (toggle between flat list and tree)
- [x] Process detail inspection — open files, threads, network connections via active tier
- [x] Send signals to processes — dropdown with TERM, KILL, HUP, INT, STOP, CONT, USR1, USR2
- [x] Web-based terminal — xterm.js + node-pty, WebSocket-backed with session persistence

### M3: Backups

- [x] Incremental backup via rsync — configurable source/dest/excludes
- [x] Manual trigger with live status polling
- [x] Backup status widget — last run status, files/bytes transferred, error details
- [x] Backup scheduling (cron via node-cron, configurable in UI)
- [x] Success/failure notifications via ntfy.sh

### M4: Operator Framework

- [x] Task definition format — JSON config with name, command, timeout, retries
- [x] Task runner with logging, retry (exponential backoff), and timeout
- [x] Disk space monitoring — visual bar chart on tasks page
- [x] Notification pipeline via ntfy.sh (configurable topic + server)
- [x] Cron-based task scheduling (node-cron, UI field for cron expression)

### M2.3: Smart Lights — Enhanced

- [x] Pull detailed bulb info on discovery (firmware version, module name, signal/RSSI)
- [x] Bulb naming — user-assigned names stored in localStorage, double-click to rename
- [x] Scene presets — 16 Wiz scene buttons (Cozy, Warm White, Party, Ocean, etc.)
- [x] Group control — select all / individual checkboxes, group ON/OFF/brightness
- [x] Bulb status polling — 5s auto-refresh toggle to detect external changes

### M2.4: Process Manager — UX

- [x] Better tree hierarchy — visual connector lines (├─ └─ │) with proper last-child tracking
- [x] Signal tooltips — description text for each signal explaining its purpose

### M2.5: File Manager — UX

- [x] File list search, sort (name/type/size/date), and type filter
- [x] Better upload input — styled dropzone with upload icon and file type hint text

### M2.6: Smart Lights — UX

- [x] Show bulb names + module/firmware/signal prominently in card header
- [x] Improved control layout — header with name + toggle, meta row below
- [x] Extended scene presets — 32 Wiz scenes organized by category (Functional, Ambient, Nature, Festive, Dynamic)

### M4.1: Operator Templates

- [x] Predefined task templates — 31 built-in with tags, search, pagination
- [x] Template picker UI — grid of template cards, click to auto-fill form fields
- [x] Custom template creation — save any task config as a reusable template
- [x] Run templates directly — "Run" button on template cards that creates + immediately executes the task
- [x] 50 more templates — categories: security/audit, Docker, Git, database, macOS-specific, SSL/certs, user management, service watchdog, log analysis, file integrity. Sources: TecMint sysadmin scripts, awesome-bash, admin-scripts repo, TECMINT_MONITOR, health-checks repo
- [x] Task list UI improvements — status badges (running/idle/failed), last-run timestamp inline, quick-run button without expanding, sortable columns

### M5: UI & Polish (completed)

- [x] Page navigation loading spinner — shimmer bar on route transitions
- [x] CSS custom properties design system — all colors via `var(--token)` tokens
- [x] Dark / light mode toggle with localStorage persistence
- [x] Page transitions — fadeIn animation on route changes
- [x] Focus-visible styles for keyboard navigation
- [x] Active nav indicator — left border accent on current page
- [x] Custom scrollbar styling
- [x] Mobile-optimized — reduced padding, hamburger menu
- [x] Light mode color fixes — global input/button/table styles via CSS tokens
- [x] Expanded color palette — success-bg, danger-bg, warning-bg, purple-bg, cyan, orange
- [x] Navbar enhancements — system stats (MEM%, CPU load, uptime) in header bar
- [x] Better fonts — Inter for UI, JetBrains Mono for code/data
- [x] Onboarding docs — comprehensive README with setup guide and project structure

### M5.1: Terminal Fixes (completed)

- [x] Auto-reconnect on WebSocket drop (3s retry)
- [x] Tab support — multiple terminal tabs, add/close/switch, independent sessions
- [x] Terminal toolbar — clear, font size +/- controls
- [x] Per-tab connection status indicator (green/red dot)
- [x] Node v23 fallback — child_process.spawn when node-pty unavailable

### M6: Claude Keeper

See [docs/claude-keeper.md](docs/claude-keeper.md) for full planning document.

- [x] Feature requests CRUD — goal, scope selector, details, status workflow, search, filter
- [x] Expandable detail panel — output/notes editor with save + copy
- [x] Agent interface — view, start, stop running Claude agents on the server
- [x] Agent task runner — auto-sweeps pending feature requests
- [x] Agent output viewer — live streaming of agent activity and decisions

---

## Completed (v1.11.0)

- [x] Dark/light mode contrast fix — bumped `--text-muted`/`--text-faint`, replaced 59 hardcoded hex colors across 10 files
- [x] Toast notification system — global component with success/warning/error/info, wired to all user actions
- [x] Dashboard rebuild — system stats cards (CPU/MEM/disk with thresholds), task/backup/keeper status, quick-access grid
- [x] Navbar stats — bigger font, color-coded by severity thresholds (green/yellow/red)
- [x] Template Run button — creates + immediately executes task from template cards
- [x] 50 new templates — security, Docker, Git, DB, macOS, SSL, user-mgmt, watchdog, log-analysis, file-integrity
- [x] Task list UI — inline status badges (running/success/failed/scheduled/idle), timestamps, quick-run button
- [x] Smart lights — color swatch headers, brightness arc rings, room grouping (localStorage), quick presets, power estimate
- [x] CronBuilder component — visual frequency picker, human-readable descriptions, next-run preview, enable/disable toggle
- [x] Tailscale — clickable IPs (copy), expandable device rows, MagicDNS, mDNS hostnames
- [x] Process manager — command reference helper (22 processes), CPU/MEM sparkline history
- [x] File manager — star/favorite files, bulk select, file size visualization bars
- [x] Backup configs — edit existing configs, delete with confirm, toast feedback
- [x] Prettier + plugin-svelte — `.prettierrc` (2-space, single quotes, 120 width), pre-commit hook, initial format pass

---

## Remaining Todos

### T1 — Toast & Error Reporting (quick wins)

- [x] Toast dedupe — add unique `key` param; if a toast with the same key exists, replace it instead of stacking (e.g. "running task..." shouldn't stack)
- [x] API error toasts — wrap all `fetch()` calls in pages with try/catch, show `toast.error(message)` on non-ok responses. Cover: files (upload/rename/delete/mkdir), processes (signal), lights (setBulb), backups (create/edit/delete/trigger), tasks (create/run/delete), keeper (CRUD)
- [x] Server-side error detail — in API route handlers that run shell commands (`child_process.exec`, `execSync`), catch stderr and return it in the JSON error response so the UI can display the actual failure reason

### T2 — New Pages

- [x] **Documentation page** (`/docs`) — server-side reads all `.md` files from the repo root and `docs/` directory. Renders as a list of expandable sections with the filename as title, rendered markdown content inside. Use the existing markdown renderer from `$lib/renderers/markdown.ts`
- [x] **UI Showcase page** (`/showcase`) — static demo page showing the design system: buttons (all variants), cards (single + grid layout), DataTable with sample data (sort/search/filter), terminal-like component mock, color palette with all CSS vars, typography samples. Useful for design consistency review
- [x] **Peripherals page** (`/peripherals`) — manage WiFi and Bluetooth on the server machine. Backend: `networksetup -listallhardwareports`, `networksetup -listpreferredwirelessnetworks`, `networksetup -setairportpower`, `system_profiler SPBluetoothDataType`. Frontend: list networks/devices, scan button, connect/disconnect. Responsive layout. macOS-focused with Linux fallback stubs

### T3 — Terminal Improvements

- [x] **Tab renaming** — double-click a tab label to edit inline (same pattern as bulb rename). Store in tab object
- [x] **Allow 0 tabs** — when last tab is closed, show an empty placeholder with a "New Terminal" button instead of auto-creating
- [x] **Mouse middle-click kill** — `mousedown` event on tab with `event.button === 1` should close/kill that tab
- [x] **Persistent sessions** — keep PTY sessions alive on the server even when the browser disconnects. On reconnect, reattach to existing session by ID. Server stores a map of `sessionId → pty` that survives page navigation. Only kill PTY when explicitly closed or server restarts

### T4 — Empty State Placeholders

- [x] Add an empty state component with icon, message, and primary action button to: Terminal (no tabs), Keeper (no requests), Tasks (no tasks), Backups (no configs), Files (empty directory). Use consistent design: centered, muted icon, descriptive text, accent-colored CTA button

### T5 — Dashboard Enrichment

- [x] Richer dashboard — terminal preview (latest output line from active session, click to open), starred files quick-access list, starred bulbs with toggle, recent task runs timeline, disk usage mini-charts. Make the dashboard feel like a command center, not just a nav page

### T6 — Process Page: System Monitor

- [x] **System monitor graphs** — add a collapsible section at the top of the process page with real-time charts for: CPU usage (all cores), Memory (used/free/cached), Network I/O (bytes in/out per second), Disk I/O (read/write per second). Backend: new `/api/system/stats` endpoint that returns a snapshot. Frontend polls every 2s, stores last 60 data points, renders as SVG line charts. GPU info if available (`system_profiler SPDisplaysDataType`)
- [x] **CPU/MEM toggle** — in the process table, add a toggle button to switch between percentage (%) and absolute values (MB for memory, time for CPU). Column header clicks should sort by the displayed metric
- [x] **Column sort/filter** — make process table columns sortable (click header to sort asc/desc). Add a column filter dropdown to show/hide columns

### T7 — Disk Info Fix + Enhancement

- [x] **Fix duplicate "/"** — the `getSystemDiskUsage()` function in `src/lib/server/operator.ts` likely returns both `/` and `/System/Volumes/Data` (macOS APFS quirk) which both report as mounted on `/`. Deduplicate by mount point, preferring the real root
- [x] **More disk info everywhere** — show filesystem type (APFS/ext4), device name, total inodes, read-only status. In the dashboard disk cards and the tasks page disk section

### T8 — Starring System (Universal)

- [x] **Generic star store** — create `$lib/stars.ts` with a localStorage-backed store that manages starred items by type (`process`, `file`, `bulb`, `backup`, `task`, `device`). API: `toggle(type, id)`, `isStarred(type, id)`, `getStarred(type)`
- [x] **Star animation** — when toggling star, add a brief scale+rotate CSS animation (keyframe: scale 1→1.3→1, rotate 0→15°→0, ~300ms). Use a shared `.star-btn` class
- [x] **Wire to all entity types** — add star buttons to: file rows, bulb cards, backup cards, task cards, tailscale device rows. Starred items sort to top in their respective lists

### T9 — Global Theme & Font Control

- [x] **Theme settings panel** — accessible from navbar (gear icon or settings page). Controls: accent color picker (preset swatches + custom hex), font size (12/14/16px), font family toggle (Inter / System / Mono), border radius scale (sharp/rounded/pill). Persist in localStorage under `hs:theme-config`, apply via CSS custom property overrides on `:root`
- [x] **Contrast mode** — optional high-contrast toggle that further bumps text brightness and border visibility

### T10 — Mobile Experience

- [x] **Drawer sidebar** — on mobile (<640px), the sidebar becomes a bottom drawer that slides up on tap. Show icons only in collapsed state, full labels when expanded. Swipe-down to dismiss
- [x] **Touch compatibility** — ensure all interactive elements have minimum 44px touch targets. Replace hover-dependent interactions with tap equivalents. Test: sliders, color pickers, table rows, template cards
- [x] **PWA setup** — create `manifest.json` (name, icons, theme_color, display: standalone), service worker for offline shell caching, add `<link rel="manifest">` to app.html. Register for push notifications via ntfy.sh (already integrated on backend). Add "Install App" prompt banner on mobile

### T11 — Desktop App Experience

- [x] **Installable Chrome app** — manifest.json with `display: standalone` enables Chrome "Install" prompt. Add `beforeinstallprompt` handler to show a custom install banner
- [x] **Offline support** — service worker caches app shell (HTML/CSS/JS). API calls gracefully degrade with "offline" state indicators. Dashboard shows cached last-known values

### T12 — Tailscale: More Device Info

- [x] **Extended device data** — backend: use `tailscale status --json` to get full device details (Tailscale version, created date, last seen, key expiry, is exit node, is relay, advertised routes, tags, user/login name). Frontend: show all fields in the expanded detail row. Add a "last seen" relative time and key expiry warning badge

### T13 — Keeper: Agent Integration (Architecture)

**Implementation Plan (Option A: Claude CLI Subprocess)**

#### Phase 1: Status Flow Simplification

- [x] Replace 6-status flow with: `draft` → `ready` → `running` → `halted` → `done`
- [x] Update `src/lib/server/keeper.ts` types and `STATUS_FLOW` in the page
- [x] "Draft" = user composing, "Ready" = user approved for agent pickup

#### Phase 2: Agent Execution Engine (`src/lib/server/agent-runner.ts`)

- [x] New server module with: `startAgent(requestId)`, `stopAgent(requestId)`, `getAgentLog(requestId)`
- [x] On "ready" → user clicks "Start Agent": server spawns `claude -p "<task context>" --output-format stream-json` as a child process using `child_process.spawn`
- [x] Context file: generate a temporary `.md` file with the request's title, goal, details, and relevant codebase context (similar to AI chat's `getCodebaseContext()`)
- [x] Store active agents in a Map: `requestId → { process, logPath, startedAt }`
- [x] Pipe stdout/stderr to `~/.home-server/keeper-logs/{requestId}.log` (append mode)
- [x] Monitor process exit: on exit, check exit code, mark as `done` (success) or `halted` (error)

#### Phase 3: Live Log Streaming

- [x] New API: `GET /api/keeper/{id}/log` — returns the log file content (with `offset` param for polling)
- [x] New API: `POST /api/keeper/{id}/message` — appends user message to agent's stdin pipe
- [x] Keeper page: expanded card shows log output in a scrollable monospace container
- [x] Poll log every 1s while status is `running`, stop when `halted` or `done`

#### Phase 4: Resume & Chat

- [x] "Resume" button: spawns a NEW agent with the existing log as context prefix
- [x] User messages in the card input are sent via `/api/keeper/{id}/message` to stdin
- [x] Agent responses appear in the log stream
- [x] "Mark Done" button: kills process if running, sets status to `done`

#### Phase 5: UI Polish

- [x] Running tasks show a pulsing status badge with elapsed time
- [x] Completed tasks greyed out, hidden behind "Show completed" toggle
- [x] Log viewer with ANSI color rendering (use a lightweight ANSI→HTML converter)

**Key decisions:**

- Use `claude` CLI (not API) so the agent has tool access (file read/write, bash)
- Context file approach (not stdin piping) for initial prompt — more reliable
- Log file as persistence layer — survives server restarts, easy to debug
- Polling-based log view (not WebSocket) — simpler, adequate for 1s refresh

### T14 — Multi-Computer Support (Plan Required)

- [x] **Architecture plan** — design how the app manages multiple machines. Options: (A) Each machine runs its own Home Server instance, one acts as "hub" that proxies API calls to others via Tailscale IPs. (B) Single server with SSH-based remote execution (`ssh user@host command`). (C) Agent-based: lightweight agent on each machine that reports to the hub. Recommend option (A) with a device selector in the navbar that switches the API base URL
- [x] **Device selector in navbar** — dropdown showing Tailscale devices. Selecting a device sets a `targetHost` context. All API calls prefix with `http://{tailscaleIP}:5555` when remote. Local device is default
- [x] **Cross-device backups** — rsync over Tailscale SSH (`rsync -avz user@100.x.y.z:/path /local/dest`). Already partially designed in backup config (just needs remote source support)

### T15 — Animations Plan

- [x] **Page transitions** — enhance existing `fadeIn` with slide direction based on nav position (left→right when going deeper, right→left when going back). Use `navigating` store for direction detection
- [x] **Card enter animations** — stagger grid card appearances using `animation-delay` based on index (`i * 50ms`). Apply to dashboard, templates, bulb grid, file list
- [x] **Micro-interactions** — button press scale (0.97), toggle switches with spring easing, expanding rows with height transition (not just display toggle), toast slide-in from right, loading skeleton shimmer for async content
- [x] **Star animation** — scale+rotate burst on toggle (already specced in T8)
- [x] **Theme transition** — smooth cross-fade when toggling dark/light mode (currently instant via CSS transition on `background`/`color`, extend to all color properties)
- [x] **Loading states** — skeleton screens for pages that fetch data (processes, lights, tailscale). Show grey pulsing placeholder shapes matching the eventual layout

### T19 — Media Server (Files Integration)

- [x] **Stream large video/audio** — add a `/api/files/stream/{filename}` endpoint that serves files with `Range` header support (HTTP 206 Partial Content) for seeking in browser `<video>` / `<audio>` players
- [x] **Media player modal** — in the file browser, clicking a video/audio file opens an in-browser player with seek, volume, playback speed, and fullscreen
- [x] **Thumbnail generation** — generate thumbnails for video files using `ffmpeg -i file.mp4 -ss 00:00:05 -vframes 1 thumb.jpg` (if ffmpeg is installed)
- [x] **Playlist support** — select multiple media files, create an auto-play queue
- [x] **VLC launch** — "Open in VLC" button that generates a `vlc://` protocol link for the file's HTTP stream URL (works if VLC is installed on the client)
- [x] **Cast/DLNA** — optional: discover DLNA renderers on the network and cast media to them

### T16 — Cross-Device Backup Enhancement

- [x] Backup diff preview — dry-run rsync (`rsync -avzn`) and show what would transfer before actually running
- [x] Cross-device source — allow backup source to be `user@tailscale-host:/path` for remote machines

### T17 — AI Agent Chat (Floating)

- [x] Floating button (bottom-right) that opens a chat panel for talking to Claude about the codebase
- [x] Backend: `/api/ai/chat` endpoint that proxies to Anthropic API (or runs `claude` CLI)
- [x] Chat persists across page navigation (store in layout-level state)
- [x] Context-aware: include current page/widget info in system prompt

### T18 — Homelab Features (Research-Based)

- [x] **Service Health Dashboard** — sidebar widget with online/offline indicators for configurable HTTP endpoints (internal services, databases, APIs). Configurable check interval + timeout. Alerts on state change
- [x] **Notification Center** — persistent event log aggregating: backup completions, task failures, process crashes, Tailscale events. Store in JSON, badge counter in navbar, filterable list view
- [x] **Docker/Container Management** — list, start, stop, restart containers via Docker API socket. View logs, resource usage. Only visible if Docker is installed
- [x] **Network Device Discovery** — ARP scan / mDNS to show all devices on local network with IP, hostname, MAC, vendor, response time. Periodic refresh, history tracking
- [x] **Uptime Monitoring** — track and chart uptime of the server itself + configured services. Show availability percentage over 24h/7d/30d. Simple ping-based checks

### T20 — Task/Template Page Overhaul

- [x] **Template runner terminal** — when "Run" is clicked on a template, show a shared inline terminal below the template list displaying live output. Overwritten by next run. Closeable with ✕
- [x] **Template edit/delete** — custom templates show edit (pencil) and delete (✕) buttons. Edit opens the form pre-filled. Delete with confirm
- [x] **New Task form polish** — better visual hierarchy, consistent card layout, section headers, improved spacing to match the backup form redesign
- [x] **Button icons** — add Unicode/emoji icons to all buttons on the page (New Task, Templates, Refresh, Run, Delete, Save as Template)
- [x] **Task card icons** — status-specific icons next to task names (running spinner, checkmark, error, clock for scheduled)
- [x] **Task pagination** — paginate the task list (10 per page) with prev/next controls
- [x] **Animated transitions** — animate template panel show/hide (slide down), task filtering (layout shift), card enter/exit. Use Svelte `animate:flip` for list reordering and `transition:slide` for sections

### T21 — New Fun Pages (Research)

- [x] **Speed Test** — run bandwidth tests (download/upload) against Cloudflare/fast.com, display results with gauges. History chart over time. Uses `curl` with timing
- [x] **Clipboard Sync** — share clipboard content across devices on the tailnet. Paste text/images on one device, copy on another. Uses a simple WebSocket + localStorage
- [x] **Screenshot Gallery** — auto-capture and browse screenshots from the server. Uses `screencapture` on macOS, stores in `~/.home-server/screenshots/`, gallery view with timestamps
- [x] **QR Code Generator** — generate QR codes for any URL, text, or WiFi credentials. Useful for sharing server URLs with phones. Pure JS (no dependencies)
- [x] **Bookmark Manager** — save and organize links with tags, descriptions, and favicons. Search/filter. Export as HTML bookmarks. Stored in JSON
- [x] **Kanban Board** — simple drag-and-drop kanban for personal project tracking. Columns: Todo, Doing, Done. Cards with title, color labels, due dates
- [x] **Wake-on-LAN** — send magic packets to wake sleeping machines on the network. Configure MAC addresses for each device. One-click wake button
- [x] **DNS Lookup Tool** — interactive dig/nslookup with visual record display (A, AAAA, MX, CNAME, TXT). Compare across DNS providers (Google, Cloudflare, ISP)
- [x] **Port Scanner** — scan a target IP for open ports with service detection. Uses `nc` or `nmap` if installed. Visual port map
- [x] **System Benchmarks** — run CPU (sysbench), disk (dd), memory, and network benchmarks. Store results, compare over time. Good for detecting degradation

### T22 — Security / Network Tools (Hackerman Mode)

- [x] **WiFi Scanner** — scan nearby WiFi networks showing SSID, BSSID, channel, signal strength (dBm), encryption type, vendor. Uses `airport -s` on macOS, `nmcli dev wifi list` on Linux. Sortable table with signal strength bars. Highlight open networks in red. Auto-refresh toggle. Option to deauth-detect (monitor for sudden signal drops)
- [x] **Packet Sniffer** — capture and display live network packets in a scrollable log. Uses `tcpdump` with configurable interface, filter expression (e.g. `port 80`, `host 192.168.1.1`), and packet count limit. Show: timestamp, src→dst, protocol, size, payload preview (hex + ASCII). Start/stop capture button. Export as `.pcap`. Requires sudo — show permission prompt
- [x] **Network Toolkit** — collection of networking tools in one page:
  - **Traceroute** — visual hop-by-hop path to any host with latency per hop (uses `traceroute` / `mtr`)
  - **Ping Sweep** — scan a subnet (e.g. 192.168.1.0/24) for live hosts with response times
  - **ARP Table** — show all known MAC↔IP mappings from `arp -a`, with vendor lookup
  - **Whois Lookup** — query domain/IP ownership info
  - **Bandwidth Monitor** — real-time bytes/sec per interface using `nettop` (macOS) or `/proc/net/dev` (Linux)
  - **SSL Certificate Inspector** — enter any domain, show full cert chain, expiry, issuer, SANs
  - **HTTP Header Inspector** — enter a URL, show all request/response headers with timing breakdown

### T23 — AI Chat Polish

- [x] **Rename conversations** — double-click title in history/sidebar to rename. Persist to localStorage
- [x] **Animated FAB button** — replace plain "AI" text with an animated gradient icon (purple→blue shimmer, or a Claude-style logo SVG with subtle pulse animation). Professional but eye-catching
- [x] **UI improvements** — better message bubbles (rounded, subtle shadow), typing indicator animation (3 bouncing dots), code block syntax highlighting in responses, copy button per message

### T24 — Navbar Enhancements

- [x] **Custom theme dropdown** — replace native `<select>` with a custom dropdown component showing theme name + 4 color swatches (bg, accent, text, border) per option. Smooth open/close animation. Better performance than re-rendering native select
- [x] **Font picker dropdown** — new dropdown next to theme selector with three sections: Header font, Body font, Monospace font. List system fonts from `document.fonts` API or hardcoded common ones. Group by type (sans-serif, serif, monospace, display). Preview each font in its own typeface. Persist to localStorage, apply via CSS var overrides on `:root`
- [x] **System monitor expanded controls** — for each stat (CPU, MEM, Load, Disk), allow toggling between: load average, absolute value, percentage. Dropdown per metric type
- [x] **More system info types** — add to navbar stats: disk I/O, network throughput, swap usage, process count, open file descriptors, TCP connections count. Show as expandable chips
- [x] **Muted stat colors** — reduce navbar stat color saturation/opacity further (opacity: 0.7), make them pop only on hover (opacity: 1 on hover with transition)

### T25 — App-Wide Polish

- [x] **Dashboard animations** — auto-refresh system stats every 30s with smooth number transitions (counter animation), card entrance stagger on load, pulse on status change
- [x] **Dashboard live refresh** — poll `/api/system` and dashboard data periodically, update stat values with CSS counter transitions instead of hard-swapping text
- [x] **Toast UI v3** — research Sonner (shadcn), react-hot-toast, Vercel's toast design. Implement: stacked toasts with offset, richer content (title + description), action buttons, swipe-to-dismiss on mobile, dark shadow depth
- [x] **Smart lights cache** — on first load, store bulb data in `sessionStorage`. On page revisit, immediately render cached data, then refresh in background and merge (already uses `mergeBulbs` — just add the cache layer)

### T26 — Documentation Sprint

- [x] **Page-by-page documentation** — for every page in the app, write a `docs/pages/{page-name}.md` with:
  - Feature overview
  - How it works (data flow: page → API → server module)
  - Caveats and known issues
  - Keyboard shortcuts (if any)
  - Changelog of major changes
- [x] Pages to document (in order): Dashboard, Files, Lights, Processes, Tailscale, Backups, Tasks, Keeper, Terminal, Docs, Showcase
- [x] **Planned features doc** — `docs/roadmap.md` summarizing T1-T26 with status indicators
- [x] Auto-include new docs in the `/docs` page viewer

---

## v3.1 — Refinements & Gaps

User feedback + audit findings from the v3.0.0 sprint. Organized by area.

### F1 — Bug Fixes (Critical)

- [x] **Peripherals WiFi scan returns no items** — the `airport -s` parser is likely failing on current macOS output format. Debug the column parsing in `/api/peripherals/+server.ts`. Bluetooth lists devices but has no connect/disconnect actions — add `blueutil` (macOS) or `bluetoothctl` (Linux) integration for toggle
- [x] **Speed test keeps erroring out** — debug `/api/speedtest/+server.ts`. Likely the download/upload blob generation or timing logic is failing. Add proper try/catch with descriptive error messages
- [x] **Toast deduplication not applied everywhere** — many actions (e.g. deleting a task, running a backup) fire multiple toasts. Ensure all repeated-action toasts use the `key` parameter for dedup. Audit every `toast.success()`/`toast.error()` call across all pages
- [x] **API error toasts missing** — files page `deleteSelected()`, `createDir()`, `refreshFiles()` have bare `fetch()` with no try/catch. Lights page catch blocks don't call `toast.error()`. Wrap ALL fetch calls in ALL pages with try/catch + `toast.error(message)`

### F2 — Terminal Fixes

- [x] **Sessions killed on navigation** — navigating away and returning starts a new shell instead of reconnecting to the existing one. The server-side session map exists but the client doesn't reattach by session ID on remount. Fix: store `sessionId` in component state or sessionStorage, pass it as query param on reconnect
- [x] **Launch shell in project directory** — set the PTY spawn `cwd` option to the project root (or the server's working directory) instead of defaulting to `$HOME`
- [x] **Mobile horizontal overflow** — terminal container has a small horizontal scroll on mobile. Fix: set `max-width: 100vw` or `overflow-x: hidden` on the terminal wrapper, and ensure xterm.js `cols` fits the viewport width
- [x] **Mobile extra keys bar** — add a row of frequently-needed terminal keys below the terminal (like Termux). Keys: `TAB`, `CTRL`, `ESC`, `|`, `/`, `-`, `~`, arrow keys (←↑→↓). Each key button sends the corresponding escape sequence to the PTY via the WebSocket. Style as a thin fixed bar at the bottom of the terminal page on touch devices (`@media (pointer: coarse)`)

### F3 — Navbar Overhaul

- [x] **Remove theme `<select>` dropdown** — the SettingsPanel gear icon makes the native select redundant. Replace it with a compact theme indicator: show the current theme name as a small label + 3-4 color dots (bg, accent, text, border) sampled from the active theme. Clicking it opens the SettingsPanel. Define a `THEME_SWATCHES` map in `theme.ts` mapping each theme ID to its 4 representative colors
- [x] **Add more system stats** — the CPU display only shows load avg or percent. Add: disk I/O (reads/writes per sec), network throughput (bytes in/out), swap usage, process count, open file descriptor count, TCP connection count. Show as expandable stat chips in the `.system-stats` row. Pull data from the existing `/api/system` endpoint (extend it if needed). Let user toggle which stats are visible via the stats gear dropdown
- [x] **Device selector UX** — add a "Manage Devices" option at the bottom of the device `<select>`. When selected, open a small modal/panel where users can add remote devices (hostname, Tailscale IP, port) and remove existing ones. Store in localStorage via `device-context.ts`. Show a brief explanation: "Add other Home Server instances on your Tailscale network"
- [x] **Help button** — add a `(?)` icon button in the header (near the settings gear). On click: navigate to `/docs#{current-page-slug}` if a doc section exists for the current route, otherwise navigate to `/docs`. Derive the page slug from `$page.url.pathname`

### F4 — Sidebar Restructure

- [x] **Group nav items by category** — move the `nav` array from `+layout.svelte` to a new constants file `src/lib/constants/nav.ts`. Define groups with labels:
  - **Core**: Dashboard, Files, Processes, Terminal
  - **Smart Home**: Lights, Peripherals
  - **Network**: Tailscale, WiFi Scanner, Packets, Network Tools, Wake-on-LAN
  - **Tools**: Tasks, Backups, Keeper, Bookmarks, Kanban, QR Code, DNS, Ports, Speed Test, Clipboard, Screenshots, Benchmarks
  - **Info**: Docs, Showcase
    Each item keeps its existing `{ href, label, desc, icon }` shape. Each group has `{ id, label, items }`.
- [x] **Collapsible groups** — render groups with a clickable header that expands/contracts the items below. Store expanded state in localStorage under `hs:nav-groups`. Default: all expanded. Use CSS `max-height` transition for smooth animation
- [x] **Star/pin sidebar links** — add a small star button on each nav link (visible on hover). Starred links float to the top of the sidebar in a "Pinned" section above the groups. Store in localStorage under `hs:nav-pinned` as an array of hrefs. Use the existing `.star-btn` CSS class

### F5 — Documentation System

- [x] **Write per-page docs** — create `docs/pages/{slug}.md` for EVERY page in the app (all 25 routes + navbar). Each doc should cover: feature overview, how to use it, data flow (page → API → server module), caveats/known issues, keyboard shortcuts (if any). Files to create: `dashboard.md`, `files.md`, `lights.md`, `processes.md`, `tailscale.md`, `backups.md`, `tasks.md`, `keeper.md`, `terminal.md`, `peripherals.md`, `qr.md`, `bookmarks.md`, `kanban.md`, `wol.md`, `dns.md`, `ports.md`, `speedtest.md`, `clipboard.md`, `screenshots.md`, `benchmarks.md`, `wifi.md`, `packets.md`, `network.md`, `docs.md`, `showcase.md`, `navbar.md`
- [x] **Category groups in /docs page** — update the docs page to group documents by type: "Page Guides", "Architecture", "API Reference", "Setup", etc. Add collapsible sections per category. Auto-categorize by path: `docs/pages/*.md` → "Page Guides", root `docs/*.md` → by filename heuristic
- [x] **Contextual help button** — the `(?)` button from F3 above should open the matching doc. The docs page should support hash-based navigation (`/docs#files`) to auto-expand and scroll to the relevant section

### F6 — Audit Gaps (from code review)

- [x] **Wire universal stars store** — `$lib/stars.ts` exists but is imported by 0 pages. Files page uses own `hs:starred-files`, processes uses `hs:starred-pids`. Migrate both to the shared store. Add star buttons to: bulb cards, backup cards, task cards, tailscale device rows. Starred items sort to top
- [x] **Skeleton loading screens** — CSS classes `.skeleton`, `.skeleton-text`, `.skeleton-card` are defined but used on 0 pages. Add skeleton placeholders to: processes (while fetching process list), lights (while discovering bulbs), tailscale (while loading devices), dashboard (while loading stats). Match the eventual layout shape
- [x] **Card stagger animation** — `.card-stagger` only used on 2 pages. Apply `card-stagger` with `animation-delay: {i * 40}ms` to card grids on: dashboard widgets, lights bulb grid, files list, bookmarks, kanban columns
- [x] **Multi-device API proxying** — `getApiBase()` function exists but no page uses it. Create a `fetchApi()` wrapper in `$lib/api.ts` that automatically prefixes the base URL from `targetDevice` store. Replace raw `fetch('/api/...')` calls with `fetchApi('/api/...')` across all pages
- [x] **Process table sort + toggle** — make column headers clickable to sort asc/desc. Add a toggle button for CPU/MEM columns to switch between percentage and absolute values (MB for memory, CPU time)
- [x] **Disk extended info** — populate the `fstype` field in `getSystemDiskUsage()`. Return device name and inode count. Show in dashboard disk cards and tasks page disk section
- [x] **AI chat code highlighting** — add a lightweight syntax highlighter (Prism.js or highlight.js) for code blocks in Claude responses. Detect ``` fenced blocks and apply language-specific highlighting
- [x] **Dashboard enrichment** — add: terminal preview (last output line from active session, clickable), starred files quick-access list, starred bulbs with toggle, disk usage trend mini-charts (SVG sparklines from last 10 data points)

### F7 — User Feedback (v3.0.1)

- [x] **Page descriptions + helper tips** — add a brief description/helper text at the top of EVERY page explaining what it does and how to use it. Use a consistent `.page-desc` styling
- [x] **Tab bar border-radius fix** — elements like tab bars with bottom borders look weird with border-radius. Use `border-radius: 0` on tab containers with connected bottom borders
- [x] **More peripherals** — add: USB devices (`system_profiler SPUSBDataType`), audio devices (`SPAudioDataType`), displays (`SPDisplaysDataType`), storage (`SPStorageDataType`), battery (`pmset -g batt`)
- [x] **Keeper status explanation** — show in Keeper UI whether `claude` CLI is installed, what the agent can do, how to use it
- [x] **Tasks cron lifecycle** — when deleting a scheduled task, unregister from `node-cron`. Add warning dialog. Show active cron count in tasks header
- [x] **Process monitor: swap + I/O** — add swap usage + disk I/O to system monitor charts. Extend `/api/system`
- [x] **Smart lights: save bulb name + room** — fix sessionStorage cache. Allow saving both bulb name AND room name per bulb separately
- [x] **File browser path bar** — editable breadcrumb path bar above file list. Clickable segments. Typeable path. Error on invalid
- [x] **10 more themes** — One Dark, Gruvbox Dark, Gruvbox Light, Everforest, Rosé Pine, Ayu Dark, Ayu Light, Material Dark, Kanagawa, Cyberpunk. Ensure header/body/mono fonts are independently configurable in SettingsPanel

---

## v3.3 — Bug Fixes & Polish

### B1 — Critical Bugs

- [x] **`crypto.randomUUID` not available on HTTP** — clipboard page and anywhere using `crypto.randomUUID()` crashes on non-HTTPS contexts. Replace with a manual UUID generator: `Math.random().toString(36).slice(2) + Date.now().toString(36)` or similar. Affects: `src/routes/clipboard/+page.svelte` line 23
- [x] **MediaPlayer copyStreamUrl crash** — `navigator.clipboard.writeText` fails on HTTP (non-secure context). Add the same `execCommand('copy')` textarea fallback used elsewhere. Fix in `src/lib/components/MediaPlayer.svelte` line 177
- [x] **MediaPlayer VLC link malformed** — URL shows `vlc://http//` instead of `vlc://http://`. Fix the protocol URL construction in MediaPlayer.svelte. The `vlc://` scheme may also not be registered — show the direct HTTP URL prominently as a copyable field instead of relying on the protocol handler
- [x] **MediaPlayer play/pause button shows raw HTML entity** — `&#9654;` renders as text instead of the triangle symbol. Use the actual Unicode character `▶` directly or ensure `{@html}` is used for entity rendering
- [x] **Screenshot capture fails** — `screencapture -x` fails with "could not create image from display" on macOS when run from a non-GUI context or without screen recording permission. Fix: add `-t png` flag, try with `-c` (clipboard) as fallback, and return a descriptive error message about System Preferences → Privacy → Screen Recording permission. Fix in `src/routes/api/screenshots/+server.ts`
- [x] **Terminal still loses sessions on navigation** — the session persistence fix may not be fully working. Verify: does `sessionStorage` actually store/restore session IDs? Is the WebSocket reconnecting to existing PTY sessions? Debug in `src/routes/terminal/+page.svelte` — check `loadSessionIds()` and `addTab(existingSessionId)` flow
- [x] **Lights page loader not showing** — the skeleton/loading state during bulb discovery is not visible. Check that `initialLoad` is true while `discovering` is true and bulbs are empty. The cached bulbs may be rendering immediately, making the loader invisible — only show loader when cache is also empty

### B2 — Icon System Overhaul

- [x] **Create central icon registry** — create `src/lib/icons.ts` exporting a `Record<string, string>` map of icon names to SVG strings (inline SVG, not font icons). Use clean 16×16 or 20×20 SVG paths. Include at minimum: `save`, `add`, `delete`, `edit`, `refresh`, `search`, `close`, `chevron-down`, `chevron-right`, `star`, `star-filled`, `play`, `pause`, `stop`, `copy`, `download`, `upload`, `settings`, `help`, `terminal`, `file`, `folder`, `check`, `warning`, `error`, `info`, `link`, `external-link`, `menu`, `filter`, `sort-asc`, `sort-desc`, `home`, `grid`, `list`
- [x] **Create `<Icon>` component** — `src/lib/components/Icon.svelte` with props `name: string`, `size?: number` (default 16), `class?: string`. Renders the SVG inline from the registry. Usage: `<Icon name="save" />` or `<Icon name="refresh" size={20} />`
- [x] **Replace HTML entities everywhere** — audit all `.svelte` files for `&#xxxx;` entities and Unicode symbols used as icons. Replace with `<Icon name="...">` from the registry. Key areas: navbar buttons, task card status icons, sidebar group chevrons, file browser action buttons, media player controls, AI chat FAB

### B3 — Common Components

- [x] **Tooltip component** — create `src/lib/components/Tooltip.svelte`. Props: `text: string`, `position?: 'top' | 'bottom' | 'left' | 'right'` (default top). Wraps a slot element, shows tooltip on hover with `position: absolute` and fade-in animation. Apply to: navbar help `(?)` button (tooltip: "Help"), settings gear (tooltip: "Settings"), stat chips, any icon-only button
- [x] **Modal component** — create `src/lib/components/Modal.svelte`. Props: `open: boolean` (bindable), `title?: string`, `width?: string` (default '500px'). Features: escape key closes, click-outside closes, slide-in animation, scrollable body, sticky header/footer. Migrate existing modals (device manager, media player, file preview) to use this shared component

### B4 — Feature Enhancements

- [x] **Files: global search toggle** — in the file browser, add a toggle next to the search input: "This folder" vs "All files". When "All files" is selected, search sends a query to a new API endpoint `GET /api/files/search?q=term` that recursively searches filenames. Results load async with a loading indicator. The API uses `fs.readdirSync` recursively with a depth limit of 5
- [x] **Lights: card reordering** — allow drag-and-drop reordering of bulb cards. Use HTML5 drag API (same pattern as kanban). Store order in localStorage under `hs:bulb-order` as an array of MAC addresses. On load, sort bulbs by stored order
- [x] **Peripherals: better loading + cache** — show skeleton cards during scan. Cache scan results in `sessionStorage` under `hs:peripherals-cache`. On return visit, render cached data immediately while refreshing in background (same pattern as lights cache)
- [x] **QR: image overlay + styles** — allow uploading a small logo image to overlay in the center of the QR code. Add QR style options: rounded dots, square dots, dot colors. Use canvas compositing for the overlay
- [x] **QR WiFi: auto-fill from connected network** — call `/api/peripherals` or `/api/wifi` to get the current SSID and pre-fill the WiFi QR form. Add a download button that triggers `canvas.toBlob()` → `URL.createObjectURL()` → download link. Add a share button using `navigator.share()` if available
- [x] **Speed test: explanation + visuals** — add a description section explaining how the test works (download blob from server → measure throughput, upload blob → measure, ping → measure latency). Add animated SVG gauge that fills during test. Show results as large bold numbers with units
- [x] **AI Chat FAB** — replace text "AI" with an SVG icon from the icon registry. Double-clicking the chat header bar should toggle maximize/minimize. Use a proper send arrow icon instead of `→`
- [x] **Benchmarks: more data + delete history** — add network benchmark (fetch speed to external endpoints). Add a "Clear History" button. Show more detail per run: timestamp, individual test durations, system info at time of test
- [x] **Network + tools docs** — write `docs/pages/` docs for any pages missing them (check if network.md, wifi.md, packets.md exist and are complete)

### B5 — Escape Key + Modal Cleanup

- [x] **Escape key closes modals globally** — add a `svelte:window on:keydown` handler in the layout or a shared action that dispatches escape to close the topmost open modal/panel. Modals to handle: SettingsPanel, MediaPlayer, FileBrowser, device manager, AI Chat fullscreen, any confirm dialogs

---

## v3.4 — UX Polish & Missing Pieces

### C1 — Terminal

- [x] **Floating terminal option** — add a "Float" button that detaches the terminal into a draggable, resizable floating panel (position: fixed, bottom-right). The floating terminal persists across page navigation since it lives in the layout. Store float state in `sessionStorage`. This also preserves output since the terminal DOM is never unmounted
- [x] **Output buffer** — when restoring a session, the old output is lost because PTY doesn't have a scrollback buffer on the server. Fix: capture the last 5000 chars of PTY output in a ring buffer on the server side (in `terminal.ts`). On reconnect, send the buffer as an initial `output` message before live data

### C2 — Peripheral Fixes

- [x] **Bluetooth connect/disconnect** — add `blueutil` (macOS) or `bluetoothctl` (Linux) integration. API: `POST /api/peripherals` with `{ action: 'bt-connect' | 'bt-disconnect', address: '...' }`. Add connect/disconnect toggle buttons on each Bluetooth device row. Show error if `blueutil` is not installed with install instructions (`brew install blueutil`)
- [x] **Fix audio HTML entities** — `&#x1F50A;` showing as text instead of icon. Replace with Unicode characters or `<Icon>` component in the peripherals audio tab
- [x] **5 more peripheral types** — research and add:
  1. **Displays/Monitors** — `system_profiler SPDisplaysDataType -json`: resolution, refresh rate, GPU, built-in vs external
  2. **Printers** — `system_profiler SPPrintersDataType -json` or `lpstat -p`: name, status, type
  3. **Network Interfaces** — `ifconfig` or `networksetup -listallhardwareports`: interface name, MAC, IP, speed, status
  4. **Thunderbolt/USB-C** — `system_profiler SPThunderboltDataType -json`: connected devices, bandwidth
  5. **Camera/Microphone** — `system_profiler SPCameraDataType -json`: built-in camera status, model, any connected webcams
- [x] **System Info tab in Peripherals** — add a "System" tab showing: CPU model, core count + details per core (frequency, architecture), total/available RAM, macOS version, kernel version, hostname, serial number. Use `system_profiler SPHardwareDataType -json` and `sysctl` commands

### C3 — Smart Lights

- [x] **Fix caching** — verify `cacheBulbs()` in `mergeBulbs()` is actually called and `sessionStorage.setItem` succeeds. Add `console.log` temporarily or check manually. The issue may be that `sessionStorage` key differs between the cache read (on mount) and write. Ensure both use `hs:lights-cache`
- [x] **Speed up return visits** — on mount, immediately render cached bulbs WITHOUT waiting for rediscovery. Currently `discovering = true` blocks rendering even when cache has data. Fix: set `discovering = false` initially if cache has bulbs, then run `rediscover()` in background with `mergeBulbs()` to update silently

### C4 — Process Monitor

- [x] **Different swap chart color** — swap chart uses `var(--purple)` but make it more distinct. Use a unique color like `var(--orange)` or a gradient fill. Add a legend showing which color is which metric
- [x] **Per-core CPU mode** — add a "Per Core" toggle button in the system monitor. When enabled, show one mini SVG chart per CPU core (in a grid layout) instead of the single averaged chart. Each mini chart shows that core's individual usage. Use the `cpu.cores` array from the API response

### C5 — Dashboard & Navbar

- [x] **Customizable dashboard** — allow users to show/hide dashboard sections. Add a gear icon in the dashboard header that opens a checklist of sections: System Stats, Tasks, Backups, Keeper, Disk, Activity, Top Processes, Quick Nav, Starred Files. Store preferences in localStorage `hs:dashboard-config`. Hidden sections are not rendered
- [x] **Better navbar icons** — the Icon component icons need vertical centering in their parent buttons. Fix: ensure all `.icon-btn` and header buttons use `display: inline-flex; align-items: center; justify-content: center;`. Check that SVG viewBox is consistent (20x20) across all icons
- [x] **CPU dropdown more options** — in the stats gear dropdown, add: network speed (bytes/sec with color — green for low, yellow for medium, red for high), I/O wait, swap percentage, disk throughput. Add small helper text under each toggle option explaining what it shows. Color the values: green < 50%, yellow 50-80%, red > 80%

### C6 — Page Consistency

- [x] **Helper text for every page** — add a `.page-desc` paragraph at the top of EVERY page that doesn't have one. Check all 25 routes. Use consistent wording: brief description of what the page does + one key tip
- [x] **Consistent title font + size** — audit all `<h2>` page titles. Ensure all use `font-size: 1.3rem`, `font-family: var(--font-heading)`, and consistent margin-bottom (`16px`). Create a `.page-title` CSS class in `app.css` if needed
- [x] **Sidebar search more subtle** — reduce the search input prominence: smaller font (0.7rem), less padding, muted border, placeholder text "Search..." instead of "Search pages...". Only show the search input on focus or when sidebar has many items. Maybe collapse to a small magnifying glass icon that expands on click

### C7 — Sidebar UX

- [x] **Double-click to star** — add `ondblclick` handler on nav links that calls `togglePin(item.href)`. Remove the hover-only star button (or keep it as alternative). Show a brief toast "Pinned {label}" or "Unpinned {label}"

---

## v3.5 — UX Overhaul & New Features

### D1 — Smart Lights UX

- [ ] **Card dragging blocks slider** — drag handle on card conflicts with brightness slider. Fix: only enable drag on the drag handle area (top bar), not the entire card. Use `e.target` check to prevent drag when interacting with sliders/inputs
- [ ] **Larger brightness slider** — move the brightness control to be larger and at the top of the card body. Make it a full-width horizontal slider that works well on both mobile and desktop. Increase touch target to 44px height
- [ ] **Collapsible presets section** — the color presets and scene buttons at the bottom of each bulb card should be collapsible. Show "Color" and "Temperature" always visible, collapse "Scenes" behind a toggle. Better custom color picker — use a proper color wheel or grid instead of `<input type="color">`
- [ ] **Get existing bulb state** — the WiZ protocol supports `getPilot` to read current state. Verify `discoverBulbs()` in `wiz.ts` actually sends `getPilot` after registration. If not, add an explicit `getPilot` call per bulb after discovery to populate state/brightness/color

### D2 — Application Launcher (New Page)

- [ ] **Launch Program page** (`/apps`) — new page showing installed applications as a card grid. Backend: scan `/Applications` folder on macOS (`fs.readdirSync('/Applications')` filtering `.app` bundles). Extract app name and icon (use `defaults read /Applications/AppName.app/Contents/Info.plist CFBundleName`). API: `GET /api/apps` returns list, `POST /api/apps/launch` with `{ path: '/Applications/...' }` uses `child_process.exec('open "/Applications/AppName.app"')` to launch. Frontend: grid of app cards with name and icon placeholder, click to launch. Show a toast "Launching {name}..."

### D3 — Navbar System Monitor

- [ ] **CPU uptime hover details** — show a tooltip (use Tooltip component) on the uptime stat showing: boot time, exact uptime (days/hours/minutes), load averages (1m/5m/15m)
- [ ] **Fix disk I/O "n/a"** — the system API returns disk I/O data but it may not be reaching the layout. Check if `/api/system` returns `disk` field and if the layout server load passes it through
- [ ] **Click outside closes dropdown** — the stats gear dropdown should close when clicking outside. Add a click-away overlay (same pattern as other dropdowns in the layout)
- [ ] **Better download/upload coloring** — when values are 0, show gray instead of green. Color scale: gray (0), green (< 1MB/s), yellow (1-10MB/s), red (> 10MB/s). Show actual values with units (KB/s, MB/s)

### D4 — Dashboard

- [ ] **Config dropdown position** — the dashboard section toggle dropdown opens left, covered by sidebar. Fix: add `right: 0` positioning so it opens to the right, or use a fixed position
- [ ] **More dashboard content** — add: quick actions row (common tasks like "Scan Lights", "Run Backup", "New Terminal"), system alerts section (disk > 90%, high CPU, key expiry), recent file uploads, active cron tasks countdown

### D5 — Terminal

- [ ] **"exit" closes tab** — detect when PTY process exits (exit code received) and auto-close the tab. Show a toast "Shell '{label}' closed"
- [ ] **Close tab kills session** — when user closes a tab, call `destroySession(sessionId)` via API to kill the PTY. Currently sessions persist even after tab close
- [ ] **Toast on tab close** — show `toast.info('Closed: {tab.label}')` when a terminal tab is closed
- [ ] **Fix header padding** — terminal page has inconsistent padding. Audit the `.terminal-page` and `.terminal-header` CSS for margin/padding issues
- [ ] **Fix "Pasted text" error on new tab** — the initial write to PTY may be sending clipboard data or the session restore message is being interpreted as a paste. Debug the `ws.onopen` handler — the `[Session restored]` message should use `\x1b[2m` (dim) escape

### D6 — Network Toolkit

- [ ] **Sample items per tab** — add 3 pre-filled example values for each tool tab: traceroute (google.com, 1.1.1.1, github.com), ping sweep (192.168.1.0/24, 10.0.0.0/24), whois (google.com, github.com, example.org), etc. Show as clickable suggestion chips below the input
- [ ] **In-page documentation** — add a help/info section per tab explaining what the tool does, what the output means, and common use cases. Use the Collapsible component with title "How it works"
- [ ] **Guided UI** — add placeholder text in inputs showing expected format, helper tooltips on buttons, and inline validation (e.g., "Enter a valid IP or hostname")

### D7 — Peripherals

- [ ] **More info per type** — expand each peripheral tab with additional data: WiFi (channel width, noise level, PHY mode), Bluetooth (battery level if available, device type icon), USB (bus number, port, power), Audio (sample format, channel count), Battery (health, temperature, power adapter wattage)
- [ ] **Search across peripherals** — add a SearchInput at the top that filters across all tabs simultaneously. Show matching tab name as prefix in results

### D8 — Files

- [ ] **Better checkbox styling** — the file selection checkbox looks odd. Use the global custom checkbox CSS or the existing `.hs-btn` pattern
- [ ] **Page header toolbar** — restructure the files page header: title + global actions (refresh, upload) in a toolbar bar. Move folder-specific actions (New Folder, search) to a secondary bar right above the file list
- [ ] **File path input position** — move the editable path bar below the file upload area. Add proper validation — always check if path exists before navigating. Show error toast + revert to last valid path on invalid
- [ ] **Media player enhancements** — add: playback speed dropdown (0.25x to 3x), picture-in-picture button, download button, subtitle support indicator
- [ ] **Inline terminal** — add a collapsible terminal panel at the bottom of the files page. Open with a "Terminal" button. Auto-set the PTY cwd to the current file browser directory. Reuse components from the terminal page
- [ ] **Folder view modes** — add view toggle: list (current), grid (card layout with thumbnails), tree (collapsible folder tree). Store preference in localStorage
- [ ] **Wildcard search** — use `find` command on the backend for wildcard search (e.g., `find . -name "*.jpg"`). Pass the pattern as a query param to the search API

### D9 — Documentation

- [ ] **Another docs refinement pass** — audit all docs, fix stale references, improve clarity, add links between related docs
- [ ] **Improve README.md** — add actual screenshots (or instructions for generating them), link to specific doc sections for common concerns, add troubleshooting section
- [ ] **Cross-reference links** — in README features table, add links to the relevant `docs/pages/` file for each feature
