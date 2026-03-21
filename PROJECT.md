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
- [ ] Never assume a requirement — ask when unclear
- [ ] Prioritize reliability over feature count. A working file transfer beats a half-working dashboard
- [ ] Prioritize UX over technical elegance. If it's annoying to use, it's broken
- [ ] Every goal must have a "definition of done" before work begins
- [ ] Track what's shipped vs what's planned. Avoid scope creep within a milestone
- [ ] Consider the "bus factor" — if the user forgets how this works in 6 months, can they still operate it?

### Role 2: Architect

**Purpose:** Design the technical system — what to build, what to reuse, how to deploy.

**Responsibilities:**
- Choose build-vs-buy for each component
- Define the tech stack, project structure, and deployment strategy
- Ensure components are loosely coupled — adding a widget shouldn't require changing the core
- Design for the constraint: this runs on a laptop and/or a Raspberry Pi, not a datacenter

**Runtime Rules:**
- [ ] Prefer existing, battle-tested tools over custom code where possible
- [ ] All services must work over Tailscale — no port forwarding, no public exposure
- [ ] Local dev runs natively (no Docker) for fast iteration; Docker is for deployment only
- [ ] Config lives in version control. Secrets live in environment variables or a secrets manager
- [ ] No single point of failure for critical paths (backups especially)
- [ ] Document every architectural decision with rationale (ADRs or inline)
- [ ] Keep resource usage low — this shares hardware with daily-use devices
- [ ] Prefer pull-based architectures where possible (polling > always-on connections) to save resources
- [ ] All inter-service communication happens over the tailnet using Tailscale IPs/MagicDNS

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
- [ ] Resource limits: operator tasks must not consume more than 25% CPU / 512MB RAM on shared devices
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
│                    Tailscale VPN (tailnet)               │
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
- [ ] Custom template creation — save any task config as a reusable template
- [ ] Run templates directly — "Run" button on template cards that creates + immediately executes the task
- [ ] 50 more templates — categories: security/audit, Docker, Git, database, macOS-specific, SSL/certs, user management, service watchdog, log analysis, file integrity. Sources: TecMint sysadmin scripts, awesome-bash, admin-scripts repo, TECMINT_MONITOR, health-checks repo
- [ ] Task list UI improvements — status badges (running/idle/failed), last-run timestamp inline, quick-run button without expanding, sortable columns

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
- [ ] Agent interface — view, start, stop running Claude agents on the server
- [ ] Agent task runner — auto-sweeps pending feature requests
- [ ] Agent output viewer — live streaming of agent activity and decisions

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
- [ ] Toast dedupe — add unique `key` param; if a toast with the same key exists, replace it instead of stacking (e.g. "running task..." shouldn't stack)
- [ ] API error toasts — wrap all `fetch()` calls in pages with try/catch, show `toast.error(message)` on non-ok responses. Cover: files (upload/rename/delete/mkdir), processes (signal), lights (setBulb), backups (create/edit/delete/trigger), tasks (create/run/delete), keeper (CRUD)
- [ ] Server-side error detail — in API route handlers that run shell commands (`child_process.exec`, `execSync`), catch stderr and return it in the JSON error response so the UI can display the actual failure reason

### T2 — New Pages
- [ ] **Documentation page** (`/docs`) — server-side reads all `.md` files from the repo root and `docs/` directory. Renders as a list of expandable sections with the filename as title, rendered markdown content inside. Use the existing markdown renderer from `$lib/renderers/markdown.ts`
- [ ] **UI Showcase page** (`/showcase`) — static demo page showing the design system: buttons (all variants), cards (single + grid layout), DataTable with sample data (sort/search/filter), terminal-like component mock, color palette with all CSS vars, typography samples. Useful for design consistency review
- [ ] **Peripherals page** (`/peripherals`) — manage WiFi and Bluetooth on the server machine. Backend: `networksetup -listallhardwareports`, `networksetup -listpreferredwirelessnetworks`, `networksetup -setairportpower`, `system_profiler SPBluetoothDataType`. Frontend: list networks/devices, scan button, connect/disconnect. Responsive layout. macOS-focused with Linux fallback stubs

### T3 — Terminal Improvements
- [ ] **Tab renaming** — double-click a tab label to edit inline (same pattern as bulb rename). Store in tab object
- [ ] **Allow 0 tabs** — when last tab is closed, show an empty placeholder with a "New Terminal" button instead of auto-creating
- [ ] **Mouse middle-click kill** — `mousedown` event on tab with `event.button === 1` should close/kill that tab
- [ ] **Persistent sessions** — keep PTY sessions alive on the server even when the browser disconnects. On reconnect, reattach to existing session by ID. Server stores a map of `sessionId → pty` that survives page navigation. Only kill PTY when explicitly closed or server restarts

### T4 — Empty State Placeholders
- [ ] Add an empty state component with icon, message, and primary action button to: Terminal (no tabs), Keeper (no requests), Tasks (no tasks), Backups (no configs), Files (empty directory). Use consistent design: centered, muted icon, descriptive text, accent-colored CTA button

### T5 — Dashboard Enrichment
- [ ] Richer dashboard — terminal preview (latest output line from active session, click to open), starred files quick-access list, starred bulbs with toggle, recent task runs timeline, disk usage mini-charts. Make the dashboard feel like a command center, not just a nav page

### T6 — Process Page: System Monitor
- [ ] **System monitor graphs** — add a collapsible section at the top of the process page with real-time charts for: CPU usage (all cores), Memory (used/free/cached), Network I/O (bytes in/out per second), Disk I/O (read/write per second). Backend: new `/api/system/stats` endpoint that returns a snapshot. Frontend polls every 2s, stores last 60 data points, renders as SVG line charts. GPU info if available (`system_profiler SPDisplaysDataType`)
- [ ] **CPU/MEM toggle** — in the process table, add a toggle button to switch between percentage (%) and absolute values (MB for memory, time for CPU). Column header clicks should sort by the displayed metric
- [ ] **Column sort/filter** — make process table columns sortable (click header to sort asc/desc). Add a column filter dropdown to show/hide columns

### T7 — Disk Info Fix + Enhancement
- [ ] **Fix duplicate "/"** — the `getSystemDiskUsage()` function in `src/lib/server/operator.ts` likely returns both `/` and `/System/Volumes/Data` (macOS APFS quirk) which both report as mounted on `/`. Deduplicate by mount point, preferring the real root
- [ ] **More disk info everywhere** — show filesystem type (APFS/ext4), device name, total inodes, read-only status. In the dashboard disk cards and the tasks page disk section

### T8 — Starring System (Universal)
- [ ] **Generic star store** — create `$lib/stars.ts` with a localStorage-backed store that manages starred items by type (`process`, `file`, `bulb`, `backup`, `task`, `device`). API: `toggle(type, id)`, `isStarred(type, id)`, `getStarred(type)`
- [ ] **Star animation** — when toggling star, add a brief scale+rotate CSS animation (keyframe: scale 1→1.3→1, rotate 0→15°→0, ~300ms). Use a shared `.star-btn` class
- [ ] **Wire to all entity types** — add star buttons to: file rows, bulb cards, backup cards, task cards, tailscale device rows. Starred items sort to top in their respective lists

### T9 — Global Theme & Font Control
- [ ] **Theme settings panel** — accessible from navbar (gear icon or settings page). Controls: accent color picker (preset swatches + custom hex), font size (12/14/16px), font family toggle (Inter / System / Mono), border radius scale (sharp/rounded/pill). Persist in localStorage under `hs:theme-config`, apply via CSS custom property overrides on `:root`
- [ ] **Contrast mode** — optional high-contrast toggle that further bumps text brightness and border visibility

### T10 — Mobile Experience
- [ ] **Drawer sidebar** — on mobile (<640px), the sidebar becomes a bottom drawer that slides up on tap. Show icons only in collapsed state, full labels when expanded. Swipe-down to dismiss
- [ ] **Touch compatibility** — ensure all interactive elements have minimum 44px touch targets. Replace hover-dependent interactions with tap equivalents. Test: sliders, color pickers, table rows, template cards
- [ ] **PWA setup** — create `manifest.json` (name, icons, theme_color, display: standalone), service worker for offline shell caching, add `<link rel="manifest">` to app.html. Register for push notifications via ntfy.sh (already integrated on backend). Add "Install App" prompt banner on mobile

### T11 — Desktop App Experience
- [ ] **Installable Chrome app** — manifest.json with `display: standalone` enables Chrome "Install" prompt. Add `beforeinstallprompt` handler to show a custom install banner
- [ ] **Offline support** — service worker caches app shell (HTML/CSS/JS). API calls gracefully degrade with "offline" state indicators. Dashboard shows cached last-known values

### T12 — Tailscale: More Device Info
- [ ] **Extended device data** — backend: use `tailscale status --json` to get full device details (Tailscale version, created date, last seen, key expiry, is exit node, is relay, advertised routes, tags, user/login name). Frontend: show all fields in the expanded detail row. Add a "last seen" relative time and key expiry warning badge

### T13 — Keeper: Agent Integration (Architecture)
- [ ] **Simplified status flow** — replace current 6-status flow with: `draft` → `ready` → `running` → `halted` → `done`. User creates in draft, marks as ready. Agent picks up ready items
- [ ] **Agent execution** — when status becomes `ready`, server spawns a Claude Code subprocess (`npx claude-code --print` or equivalent). Store PID, stream stdout/stderr to a log file. Show live log output in the expanded card view
- [ ] **Back-and-forth chat** — add a message input at the bottom of the expanded running/halted card. User messages are appended to the agent's stdin. Agent responses stream back to the log. This allows iterative guidance
- [ ] **Status transitions** — agent can write `[STATUS:halted]` or `[STATUS:done]` to signal status changes. User can click "Resume" (spawns new agent with existing context/log as input) or "Mark Done" (greys out, hidden behind "Show completed" toggle)
- [ ] **Log persistence** — store agent logs in `~/.home-server/keeper-logs/{requestId}.log`

### T14 — Multi-Computer Support (Plan Required)
- [ ] **Architecture plan** — design how the app manages multiple machines. Options: (A) Each machine runs its own Home Server instance, one acts as "hub" that proxies API calls to others via Tailscale IPs. (B) Single server with SSH-based remote execution (`ssh user@host command`). (C) Agent-based: lightweight agent on each machine that reports to the hub. Recommend option (A) with a device selector in the navbar that switches the API base URL
- [ ] **Device selector in navbar** — dropdown showing Tailscale devices. Selecting a device sets a `targetHost` context. All API calls prefix with `http://{tailscaleIP}:5555` when remote. Local device is default
- [ ] **Cross-device backups** — rsync over Tailscale SSH (`rsync -avz user@100.x.y.z:/path /local/dest`). Already partially designed in backup config (just needs remote source support)

### T15 — Animations Plan
- [ ] **Page transitions** — enhance existing `fadeIn` with slide direction based on nav position (left→right when going deeper, right→left when going back). Use `navigating` store for direction detection
- [ ] **Card enter animations** — stagger grid card appearances using `animation-delay` based on index (`i * 50ms`). Apply to dashboard, templates, bulb grid, file list
- [ ] **Micro-interactions** — button press scale (0.97), toggle switches with spring easing, expanding rows with height transition (not just display toggle), toast slide-in from right, loading skeleton shimmer for async content
- [ ] **Star animation** — scale+rotate burst on toggle (already specced in T8)
- [ ] **Theme transition** — smooth cross-fade when toggling dark/light mode (currently instant via CSS transition on `background`/`color`, extend to all color properties)
- [ ] **Loading states** — skeleton screens for pages that fetch data (processes, lights, tailscale). Show grey pulsing placeholder shapes matching the eventual layout

### T16 — Cross-Device Backup Enhancement
- [ ] Backup diff preview — dry-run rsync (`rsync -avzn`) and show what would transfer before actually running
- [ ] Cross-device source — allow backup source to be `user@tailscale-host:/path` for remote machines
