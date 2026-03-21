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
- [ ] Every task must be idempotent — safe to re-run without side effects
- [ ] Every task must have a timeout — no runaway processes
- [ ] Every task must log: start time, end time, outcome, errors
- [ ] Failed tasks retry up to 3 times with exponential backoff, then alert the user
- [ ] Never delete user data without explicit confirmation (even in automated flows)
- [ ] Resource limits: operator tasks must not consume more than 25% CPU / 512MB RAM on shared devices
- [ ] Notification rules:
  - **Success:** Silent by default, unless user opted in to success notifications
  - **Failure:** Always notify immediately
  - **Progress:** Only for long-running tasks (>5 min), update every 25% progress
- [ ] All operator tasks are defined as config files — no hardcoded jobs
- [ ] Tasks can be triggered via: cron schedule, API call, dashboard button, or CLI command

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
- [ ] Process output viewer — attach to stdout/stderr of a running process (read from `/proc` or `dtrace` on macOS)
- [x] Send signals to processes — dropdown with TERM, KILL, HUP, INT, STOP, CONT, USR1, USR2
- [ ] Web-based terminal (SSH) — xterm.js + server-side PTY, accessible from browser like Render's shell (consider node-pty or similar)

### M3: Backups
- [x] Incremental backup via rsync — configurable source/dest/excludes
- [x] Manual trigger with live status polling
- [x] Backup status widget — last run status, files/bytes transferred, error details
- [ ] Backup scheduling (cron integration)
- [ ] Success/failure notifications

### M4: Operator Framework
- [x] Task definition format — JSON config with name, command, timeout, retries
- [x] Task runner with logging, retry (exponential backoff), and timeout
- [x] Disk space monitoring — visual bar chart on tasks page
- [ ] Notification pipeline (WhatsApp or ntfy.sh)
- [ ] Cron-based task scheduling

### M2.3: Smart Lights — Enhanced
- [x] Pull detailed bulb info on discovery (firmware version, module name, signal/RSSI)
- [x] Bulb naming — user-assigned names stored in localStorage, double-click to rename
- [x] Scene presets — 16 Wiz scene buttons (Cozy, Warm White, Party, Ocean, etc.)
- [x] Group control — select all / individual checkboxes, group ON/OFF/brightness
- [x] Bulb status polling — 5s auto-refresh toggle to detect external changes

### M5: UI & Polish
- [x] Page navigation loading spinner — shimmer bar on route transitions
- [x] CSS custom properties design system — all colors via `var(--token)` tokens
- [x] Dark / light mode toggle with localStorage persistence
- [x] Page transitions — fadeIn animation on route changes
- [x] Focus-visible styles for keyboard navigation
- [x] Active nav indicator — left border accent on current page
- [x] Custom scrollbar styling
- [x] Mobile-optimized — reduced padding, hamburger menu
- [ ] Consistent expandable-row pattern across widgets (processes, files, tailscale)
- [ ] Share-sheet integration for file transfer (if feasible)
- [ ] Onboarding docs — "how to set this up from scratch"
