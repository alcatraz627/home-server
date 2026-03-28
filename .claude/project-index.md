# Project Index

**Generated:** 2026-03-27
**Project:** home-server
**Location:** /Users/alcatraz627/Code/Personal/home-server

## Overview

- **Framework:** SvelteKit 2.x (Svelte 5 with Runes)
- **Language:** TypeScript (strict mode)
- **Package Manager:** npm
- **Project Type:** Fullstack — personal device management dashboard
- **Runtime:** Node.js 20 (Alpine Docker image)
- **Adapter:** @sveltejs/adapter-node (SSR, outputs to `build/`)
- **Version:** 4.29.2-const-fix-7

## Vision

A personal device management platform running across devices (laptop, phone, Raspberry Pi) connected via **Tailscale VPN**. Provides a unified control plane for file transfers, smart home control, backups, process management, AI agents, and operator tasks — all accessible from any device on the tailnet with zero cloud dependency.

## Directory Structure

- `src/` — Application source code
  - `app.html` — HTML shell template
  - `app.css` — Global CSS with design token system (27 themes, dark/light)
  - `app.d.ts` — SvelteKit type declarations
  - `hooks.server.ts` — Server hooks (request logging, lazy scheduler init)
  - `service-worker.ts` — SvelteKit service worker (precaching, offline fallback)
  - `lib/` — Shared library code
    - `constants/` — App-wide constants (`app.ts` with version, `nav.ts` sidebar config)
    - `components/` — 34 reusable UI components
    - `renderers/` — Plugin-style document renderer registry (Excel, Word, Markdown, JSON, Text, ePub)
    - `widgets/` — Dashboard widget registry and type definitions
    - `types/` — Shared TypeScript interfaces by domain (`wifi.ts`, `docker.ts`, `network.ts`)
    - `utils/` — Client-side utilities
    - `server/` — Server-only modules (one file per domain, 23 modules)
    - `api.ts` — `fetchApi()` + `postJson()` for multi-device API routing
    - `auto-refresh.svelte.ts` — Reusable auto-refresh interval utility
    - `sort.svelte.ts` — Reusable table sort utility
    - `errors.ts` — Client-side `getErrorMessage()` for typed error handling
    - `shortcuts.ts` — Keyboard shortcut registration system
    - `types.ts` — Shared TypeScript interfaces (DeviceInfo, Widget, etc.)
    - `theme.ts` — Theme Svelte store with localStorage persistence
    - `markdown.ts` — Lightweight regex-based Markdown-to-HTML renderer
    - `json-viewer.ts` — JSON syntax highlighting and tree viewer
  - `routes/` — SvelteKit file-based routing (37 pages + 35 API route groups)
- `static/` — Static assets (favicon, xterm.css, manifest.json, icons/)
- `scripts/` — Build and utility scripts
- `docs/` — Project documentation (35+ files)
- `docker-compose.yml` — Single-service Docker Compose config
- `Dockerfile` — Multi-stage Node.js 20 Alpine build

## Key Components (34)

| Component                       | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `ActionGroup`                   | Grouped action buttons with overflow dropdown   |
| `AgentLogViewer`                | ANSI-colored log stream viewer for Keeper agent |
| `AsyncState`                    | Loading/error/empty tristate wrapper            |
| `Badge`                         | Colored status badges                           |
| `Button`                        | Themed button with icon support                 |
| `Card`                          | Container with themed border/background         |
| `Collapsible`                   | Animated expand/collapse sections               |
| `CommandPalette`                | Cmd+K fuzzy search navigation                   |
| `ConfirmDialog`                 | Destructive action confirmation modal           |
| `DashboardWidget`               | Widget renderer for configurable dashboard      |
| `DataChip`                      | Compact data display chip                       |
| `DataTable`                     | Sortable/filterable table component             |
| `DropdownMenu`                  | Context menu with keyboard navigation           |
| `EmptyState`                    | Placeholder for empty data states               |
| `FilterBar`                     | Unified filter/search bar with action slots     |
| `Icon`                          | 113-icon lucide-svelte wrapper                  |
| `InfoRow`                       | Label-value display row with code prop          |
| `InteractiveChip`               | Clickable filter chip with dot/count            |
| `Loading`                       | Spinner and skeleton loading states             |
| `MiniChart`                     | Inline sparkline SVG chart                      |
| `Modal`                         | Overlay dialog with close handling              |
| `PageHeader`                    | Page title bar with action buttons              |
| `ProgressBar`                   | Themed progress indicator                       |
| `SearchInput`                   | Debounced search input                          |
| `StatCard`                      | Metric display card with icon                   |
| `Tabs`                          | Tab bar with slide animation                    |
| `Toast`                         | Notification toast system                       |
| `Tooltip`                       | Hover tooltip component                         |
| + 6 more specialized components |

## Server Modules (23)

| Module             | Domain                         | Key Exports                                            |
| ------------------ | ------------------------------ | ------------------------------------------------------ |
| `agent-runner.ts`  | AI agent execution             | `runAgent`, `getAgentStatus`, `resumeAgent`            |
| `backups.ts`       | Incremental rsync backups      | `runBackup`, `getBackupStatuses`, `saveBackupConfig`   |
| `config.ts`        | Environment config             | `getUploadDir`, `MAX_FILE_SIZE`                        |
| `errors.ts`        | Server error utilities         | `errorMessage`                                         |
| `files.ts`         | File CRUD with path protection | `listFiles`, `saveFile`, `getFileStream`, `deleteFile` |
| `keeper.ts`        | Keeper task management         | `getKeepers`, `createKeeper`, `updateKeeper`           |
| `logger.ts`        | JSON Lines logging             | `log`, `queryLogs`, `getLogStats`                      |
| `messages.ts`      | iMessage reader (macOS)        | `getConversations`, `getMessages`                      |
| `metadata.ts`      | File metadata sidecar          | `getFileMetadata`, `setFileMetadata`                   |
| `network-utils.ts` | Network helpers                | `getLocalIp`, `getNetworkInterfaces`                   |
| `notifications.ts` | In-app notification center     | `getNotifications`, `markRead`                         |
| `notify.ts`        | Push notifications (ntfy.sh)   | `sendNotification`, `notifyTaskComplete`               |
| `operator.ts`      | Task runner with retry         | `runTask`, `getTaskStatuses`                           |
| `oui.ts`           | MAC vendor lookup (shared)     | `lookupVendor`, `OUI_MAP`                              |
| `processes.ts`     | OS process management          | `listProcesses`, `sendSignal`, `getProcessDetail`      |
| `rate-limit.ts`    | Per-IP rate limiting           | `rateLimit`, `rateLimitMiddleware`                     |
| `scheduler.ts`     | Cron scheduling                | `startScheduler`, `scheduleAll`                        |
| `security.ts`      | Path traversal, sanitization   | `sanitizePath`, `sanitizeShellArg`, `validateRequired` |
| `services.ts`      | Service health checks          | `getServiceStatuses`                                   |
| `tailscale.ts`     | Tailscale CLI parser           | `getTailscaleStatus`                                   |
| `terminal.ts`      | PTY session management         | `createSession`, `getSession`, `resizeSession`         |
| `wiz.ts`           | Wiz smart bulb UDP control     | `discoverBulbs`, `setBulbState`                        |
| `wol.ts`           | Wake-on-LAN                    | `sendWolPacket`                                        |

## Pages (37)

| Route            | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `/`              | Dashboard — configurable widget grid with builder UI                 |
| `/apps`          | macOS application manager — search, launch, quit                     |
| `/backups`       | Backup manager — configure, run, schedule rsync jobs                 |
| `/benchmarks`    | System benchmarks — CPU, disk, memory tests                          |
| `/bookmarks`     | Bookmark manager with tags and search                                |
| `/clipboard`     | Cross-device clipboard sync                                          |
| `/databases`     | Database management — PostgreSQL, Redis, MongoDB, PM2                |
| `/dns`           | DNS lookup tool                                                      |
| `/dns-trace`     | DNS path trace — `dig +trace` with visual hop chain                  |
| `/docker`        | Docker container management                                          |
| `/docs`          | Documentation viewer (renders project .md files)                     |
| `/files`         | File manager — upload, download, preview, rename, browse             |
| `/internals`     | App internals — routes, modules, config                              |
| `/kanban`        | Kanban board with priorities, assignees, drag-and-drop               |
| `/keeper`        | AI agent task runner (Claude integration)                            |
| `/lights`        | Wiz smart bulb control — discovery, RGB, scenes                      |
| `/logs`          | JSON Lines log viewer with filtering                                 |
| `/messages`      | iMessage reader (macOS-only)                                         |
| `/network`       | Network toolkit — traceroute, ping, ARP, whois, bandwidth, SSL, HTTP |
| `/notes`         | Notion-like block editor with auto-save                              |
| `/notifications` | Notification center with read/unread                                 |
| `/offline`       | PWA offline fallback page                                            |
| `/packets`       | Packet sniffer (tcpdump)                                             |
| `/peripherals`   | Hardware info — WiFi, Bluetooth, USB, audio, battery, displays       |
| `/ports`         | Port scanner with SSE streaming                                      |
| `/processes`     | Process manager — sort, inspect, signal, tree view, category tabs    |
| `/qr`            | QR code generator with center image overlay                          |
| `/screenshots`   | Screenshot gallery with metadata                                     |
| `/services`      | Service health dashboard                                             |
| `/shortcuts`     | Keyboard shortcut customization                                      |
| `/showcase`      | UI component showcase and design tokens                              |
| `/speedtest`     | Network speed test (local + Cloudflare)                              |
| `/status`        | App status — health, version, git, memory, storage                   |
| `/tailscale`     | Tailscale device status — peers, IPs, routes                         |
| `/tasks`         | Operator tasks — CRUD, run, schedule, templates                      |
| `/terminal`      | Web terminal — xterm.js + node-pty via WebSocket                     |
| `/wifi`          | WiFi scanner with signal, channel, vendor info                       |
| `/wol`           | Wake-on-LAN sender                                                   |

## Dependencies

### Production

- `ws` (^8) — WebSocket server for terminal
- `node-pty` (^1) — Pseudo-terminal for web shell
- `@xterm/xterm` (^6) — Terminal emulator UI
- `@xterm/addon-fit` — Auto-fit terminal to container
- `node-cron` (^4) — Cron-based job scheduling
- `mammoth` — Word document (.docx) to HTML conversion
- `xlsx` — Excel/spreadsheet file parsing (SheetJS)
- `epubjs` — ePub document rendering
- `lucide-svelte` — Icon library (113 mapped icons)

### Development

- `svelte` (^5.51) — UI framework (Svelte 5 with Runes)
- `@sveltejs/kit` (^2.50) — Full-stack web framework
- `@sveltejs/adapter-node` (^5) — Node.js server adapter
- `vite` (^7) — Build tool and dev server
- `typescript` (^5.9) — Static type checking
- `prettier` + `prettier-plugin-svelte` — Code formatting

## Architectural Patterns

### Server Module Pattern

Each domain has one server-side module in `src/lib/server/`. Modules export typed interfaces and pure functions. No cross-imports between server modules — API routes are thin wrappers.

### Document Renderer Registry

Plugin-style pattern in `src/lib/renderers/`. Each renderer implements `DocumentRenderer` interface. Renderers registered in priority order — first match wins. Current: Excel, Word, Markdown, JSON, Text, ePub.

### Widget Registry

Dashboard widgets defined in `src/lib/widgets/`. Each widget type specifies: component, default size (S/M/L), data source, refresh interval. `DashboardWidget` component renders any widget by type. Preset templates for common layouts.

### Data Storage

No database — all persistent state is JSON files in `~/.home-server/`. Includes tasks, backups, notes, bookmarks, kanban, keeper agents, notifications, and more.

### Styling

27 CSS custom property themes. All colors use `var(--token)` tokens in `app.css`. Scoped `<style>` in components. No CSS framework.

### State Management

Svelte 5 Runes (`$state`, `$derived`, `$effect`, `$props`). Global stores in `$lib/`. Shared utilities: `createAutoRefresh()`, `createTableSort()`. No external state lib.

### Security

- Path traversal protection (`sanitizePath`)
- CSRF trusted origins (Tailscale IPs)
- Signal whitelisting for process management
- Terminal PIN gate (SHA-256)
- Rate limiting on expensive endpoints
- Browse API restricted to configurable allowlist
- No authentication — relies on Tailscale VPN

### PWA

SvelteKit `src/service-worker.ts` with precaching of build assets. PNG icons (192/512 regular + maskable). Offline fallback page. SW update toast. Wake Lock API for terminal. Badging API for notifications.

## Notes

- **Version tagging** follows `major.minor.patch-word-word-number` format. Updated after every change.
- **Docker deployment** uses multi-stage build with Node 20 Alpine.
- **Config lives in `~/.home-server/`** — persists across deployments.
- **Notification integration** optional — requires `NTFY_TOPIC` env var.
- **Multi-device** support via Tailscale with device selector in navbar and `fetchApi()` routing.
