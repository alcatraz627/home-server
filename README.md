<div align="center">

# Home Server

**A personal device management platform for your Tailscale network**

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-FF3E00?logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Svelte](<https://img.shields.io/badge/Svelte-5_(Runes)-FF3E00?logo=svelte&logoColor=white>)](https://svelte.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Tailscale](https://img.shields.io/badge/Tailscale-VPN-0A1F44?logo=tailscale&logoColor=white)](https://tailscale.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

_36 pages · 50+ API routes · 24 components · 25 themes · 38 tests · PWA · Multi-device_

<!-- TODO: Replace with actual screenshot -->
<!-- ![Home Server Dashboard](docs/assets/screenshot-dashboard.png) -->

[Getting Started](#quick-start) · [Features](#features) · [What's New](#whats-new-in-v48) · [Configuration](#configuration) · [Architecture](docs/architecture.md) · [API Reference](docs/api-reference.md)

</div>

---

> **Home Server** is a self-hosted dashboard that runs on your laptop, Raspberry Pi, or any device on your Tailscale VPN. Manage files, smart lights, processes, backups, and 20+ tools from a single web UI — no cloud required.

See [PROJECT.md](PROJECT.md) for the full vision, goals, and milestones.

## Features

### Core Pages

| Page                                     | Description                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Dashboard**](docs/pages/dashboard.md) | System stats (CPU/MEM/disk), task/backup/keeper status, activity timeline, top processes. Auto-refreshes every 30s.                                            |
| [**Files**](docs/pages/files.md)         | Drag-and-drop upload, download, rename, delete. In-browser preview for images, video, audio, PDF, Excel, Markdown, JSON, Word. Media streaming with playlists. |
| [**Smart Lights**](docs/pages/lights.md) | Wiz bulb control — on/off, brightness, color, scenes. Room grouping, quick presets, session cache.                                                             |
| [**Processes**](docs/pages/processes.md) | Real-time system monitor (CPU/MEM/Network/Load SVG charts), sortable process list, starred processes, tree view, expandable detail rows.                       |
| [**Tailscale**](docs/pages/tailscale.md) | Full device details — IPv4/IPv6, DNS name, version, last seen, key expiry warnings, traffic stats, advertised routes.                                          |
| [**Backups**](docs/pages/backups.md)     | rsync-based backups with visual source→dest diagram, CronBuilder, tag-style excludes, rsync preview. Dry-run diff preview.                                     |
| [**Tasks**](docs/pages/tasks.md)         | Shell task runner with templates (100+), inline terminal output, pagination, status icons, animated transitions.                                               |
| [**Keeper**](docs/pages/keeper.md)       | Feature tracker with Claude agent integration — spawn agents, live log streaming, ANSI color rendering, resume/chat.                                           |
| [**Terminal**](docs/pages/terminal.md)   | Full web-based terminal via xterm.js + node-pty. Tab renaming, middle-click close, session persistence.                                                        |

### Tools & Utilities

| Page                                          | Description                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [**QR Code**](docs/pages/qr.md)               | Pure client-side QR generator with WiFi shortcut, size slider, error correction, PNG download. |
| [**Bookmarks**](docs/pages/bookmarks.md)      | Link manager with tags, search/filter, favicon display, HTML export.                           |
| [**Kanban**](docs/pages/kanban.md)            | Drag-and-drop project board (Todo/Doing/Done) with color labels and due dates.                 |
| [**Wake-on-LAN**](docs/pages/wol.md)          | UDP magic packet sender with device management and ping status.                                |
| [**DNS Lookup**](docs/pages/dns.md)           | Multi-provider comparison (Google, Cloudflare, system) with 7 record types.                    |
| [**Port Scanner**](docs/pages/ports.md)       | Scan ports with service detection, common ports preset, concurrent scanning.                   |
| [**Speed Test**](docs/pages/speedtest.md)     | Download/upload/latency measurement with SVG gauges and history.                               |
| [**Clipboard Sync**](docs/pages/clipboard.md) | Share clipboard across tailnet devices with auto-refresh.                                      |
| [**Screenshots**](docs/pages/screenshots.md)  | Capture and browse screenshots with gallery view and full-size modal.                          |
| [**Benchmarks**](docs/pages/benchmarks.md)    | CPU/disk/memory benchmarks with history comparison.                                            |

### Security & Network

| Page                                         | Description                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [**WiFi Scanner**](docs/pages/wifi.md)       | Nearby networks with signal bars, channel, security type. Highlights open networks.                         |
| [**Packet Sniffer**](docs/pages/packets.md)  | tcpdump-based live packet capture with configurable filters.                                                |
| [**Network Toolkit**](docs/pages/network.md) | 7 tools: traceroute, ping sweep, ARP table, whois, bandwidth monitor, SSL inspector, HTTP header inspector. |
| [**Peripherals**](docs/pages/peripherals.md) | WiFi and Bluetooth device scanning (macOS + Linux).                                                         |

### App Infrastructure

| Feature            | Description                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **20 Themes**      | Dark, Light, Monokai, Dracula, Solarized (2), Nord, GitHub Dark, Catppuccin, Tokyo Night, One Dark, Gruvbox (2), Everforest, Rose Pine, Ayu (2), Material Dark, Kanagawa, Cyberpunk                                                                                |
| **Settings Panel** | Theme grid, accent colors, font size/family, border radius, high contrast toggle                                                                                                                                                                                   |
| **App Launcher**   | macOS application launcher with search, open, and quit controls                                                                                                                                                                                                    |
| **PWA**            | Installable as app, service worker with offline caching, install prompt banner                                                                                                                                                                                     |
| **Multi-Device**   | Device selector in navbar, API proxying via Tailscale                                                                                                                                                                                                              |
| **AI Chat**        | Floating Claude chat with conversation tabs, rename, typing indicator, copy buttons                                                                                                                                                                                |
| **24 Components**  | Button, Badge, Tabs, SearchInput, Loading, Collapsible, Icon, Tooltip, Modal, Card, Toolbar, PageHeader, DataChip, InteractiveChip, InfoRow, MiniChart, CommandPalette, AiChat, CronBuilder, MediaPlayer, SettingsPanel, DataTable, FileBrowser, Toast, EmptyState |

## What's New in v4.8

- **Notes Module** — Notion-like block editor with 10 block types, auto-save, sidebar navigation, nested pages
- **App Status Page** — server health, version/git info, memory visualization, storage breakdown per directory
- **14 Dashboard Modules** — added notifications, notes, docker, services widgets; all customizable with drag reorder + S/M/L sizing
- **DNS Path Trace** — full `dig +trace` with visual hop chain showing root → TLD → authoritative nameservers
- **Port Scanner** — sort/search/filter table, "All 65535" streaming mode via SSE, 60+ known services
- **Databases Page** — PostgreSQL, Redis, MongoDB, PM2 status + management with expandable details
- **Command Palette** — `Cmd+K` page search with keyboard navigation
- **Security Complete** — all 11 security items resolved: terminal PIN gate, rate limiting, browse allowlist, spawnSync migration, env filtering
- **Full Linux Support** — 17/17 features cross-platform including audio, displays, battery, network interfaces
- **38 Tests** — 100% passing across API, integration, SSR page rendering, and platform tests
- **Type Safety** — `catch(unknown)` migration across 26 files with shared `errorMessage()` helper
- **AI Chat Polish** — conversation rename, animated FAB with gradient shimmer, rounded message bubbles, copy buttons, and typing indicator
- **Navbar Enhancements** — collapsible groups, pinned favorites, muted stat colors with hover reveal, device selector dropdown
- **Documentation Sprint** — per-page usage guides for all 24+ pages, component library specs, and roadmap tracking

## Quick Start

### 1. Prerequisites

- **Node.js** 20+ (v23 works with `--engine-strict=false`)
- **Tailscale** installed and signed in on your devices
- **rsync** (for backups — pre-installed on macOS/Linux)

### 2. Install & Run

```sh
git clone <this-repo>
cd home-server
npm install --engine-strict=false
cp .env.example .env    # Edit as needed
npm run dev
```

The dashboard opens at `http://localhost:5555`.

### 3. Access from Phone

1. Install [Tailscale](https://tailscale.com/download) on your phone
2. Sign in with the same account
3. Open `http://<your-tailscale-hostname>:5555` in your phone's browser

Find your hostname:

```sh
# macOS
/Applications/Tailscale.app/Contents/MacOS/Tailscale status
```

### 4. Optional: Custom Hostname

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale set --hostname=homeserver
# Then access via http://homeserver:5555
```

## Configuration

All config via `.env`:

| Variable        | Default             | Description                          |
| --------------- | ------------------- | ------------------------------------ |
| `PORT`          | `5555`              | Dev server port                      |
| `UPLOAD_DIR`    | `./uploads`         | File storage directory               |
| `MAX_FILE_SIZE` | `524288000` (500MB) | Max upload size                      |
| `NTFY_TOPIC`    | _(disabled)_        | ntfy.sh topic for push notifications |
| `NTFY_SERVER`   | `https://ntfy.sh`   | ntfy.sh server URL (for self-hosted) |

### Notifications

Set `NTFY_TOPIC` in `.env` to enable push notifications for task/backup completion:

```sh
NTFY_TOPIC=home-server-alerts
```

Then subscribe to the topic in the [ntfy app](https://ntfy.sh/) on your phone.

## Project Structure

```
src/
├── lib/
│   ├── server/            # Server-side helpers (14 modules)
│   │   ├── files.ts       # File CRUD + MIME detection
│   │   ├── agent-runner.ts# Claude CLI subprocess management
│   │   ├── backups.ts     # rsync backup runner + dry-run
│   │   ├── keeper.ts      # Feature request tracking
│   │   ├── operator.ts    # Task runner with retry/timeout
│   │   ├── processes.ts   # Process list, kill, detail
│   │   ├── wiz.ts         # Wiz bulb UDP control
│   │   ├── tailscale.ts   # Tailscale CLI wrapper
│   │   ├── terminal.ts    # PTY session management
│   │   ├── wol.ts         # Wake-on-LAN magic packets
│   │   ├── scheduler.ts   # node-cron scheduling
│   │   ├── notify.ts      # ntfy.sh notifications
│   │   ├── metadata.ts    # File metadata sidecar store
│   │   └── config.ts      # Upload dir config
│   ├── components/        # 17 reusable UI components
│   │   ├── Button.svelte       # Variants, sizes, confirm mode
│   │   ├── Badge.svelte        # Status pills/dots with colors
│   │   ├── Tabs.svelte         # Tab bar with keyboard nav
│   │   ├── SearchInput.svelte  # Debounced search + clear
│   │   ├── Loading.svelte      # Skeleton/spinner/dots
│   │   ├── Collapsible.svelte  # Animated expand/collapse
│   │   ├── Icon.svelte         # Icon wrapper
│   │   ├── Tooltip.svelte      # Hover tooltips
│   │   ├── Modal.svelte        # Dialog overlay
│   │   ├── AiChat.svelte       # AI chat with tabs + history
│   │   ├── CronBuilder.svelte  # Visual cron builder
│   │   ├── MediaPlayer.svelte  # Video/audio player
│   │   ├── SettingsPanel.svelte# Theme/font controls
│   │   ├── DataTable.svelte    # Sortable table
│   │   ├── FileBrowser.svelte  # File picker modal
│   │   ├── Toast.svelte        # Toast notifications
│   │   └── EmptyState.svelte   # Empty state placeholder
│   ├── renderers/         # Pluggable file preview
│   ├── constants/app.ts   # Version tag
│   ├── theme.ts           # 20 themes + setTheme
│   ├── stars.ts           # Universal starring store
│   ├── device-context.ts  # Multi-device switching
│   ├── toast.ts           # Toast store with dedupe
│   ├── markdown.ts        # Markdown→HTML
│   └── types.ts           # Shared types
├── routes/                # 26 pages + 35 API routes
└── app.css                # 20 themes + animations
```

## Building for Production

```sh
npm run build
# Or via Docker:
docker compose up --build
```

## Adding a New Feature

1. **Server helper**: `src/lib/server/myfeature.ts` — business logic + types
2. **API route**: `src/routes/api/myfeature/+server.ts` — thin wrapper
3. **Page**: `src/routes/myfeature/+page.svelte` — UI
4. **Dashboard**: Add widget card in `src/routes/+page.svelte`
5. **Nav**: Add entry in `src/routes/+layout.svelte`

For file preview, implement `DocumentRenderer` in `src/lib/renderers/` and register in `index.ts`.

## Screenshots

<!-- TODO: Add actual screenshots -->
<!--
<details>
<summary>Dashboard</summary>
<img src="docs/assets/screenshot-dashboard.png" alt="Dashboard" width="800" />
</details>

<details>
<summary>File Manager</summary>
<img src="docs/assets/screenshot-files.png" alt="Files" width="800" />
</details>

<details>
<summary>Terminal</summary>
<img src="docs/assets/screenshot-terminal.png" alt="Terminal" width="800" />
</details>

<details>
<summary>Smart Lights</summary>
<img src="docs/assets/screenshot-lights.png" alt="Lights" width="800" />
</details>
-->

_Screenshots coming soon — run the app and explore!_

## Documentation

| Document                               | Description                                       |
| -------------------------------------- | ------------------------------------------------- |
| [Architecture](docs/architecture.md)   | System design, module boundaries, data flow       |
| [API Reference](docs/api-reference.md) | All 50+ API routes with request/response examples |
| [Setup Guide](docs/setup-guide.md)     | Detailed installation and configuration           |
| [Extending](docs/extending.md)         | How to add new features and widgets               |
| [Roadmap](docs/roadmap.md)             | Feature status and planned work                   |
| [Page Guides](docs/pages/)             | Per-page usage documentation (34 guides)          |
| [Security](docs/security.md)           | Security audit, hardening checklist (11/11 done)  |
| [Linux Support](docs/linux-support.md) | Cross-platform compatibility (17/17 features)     |
| [Components](docs/components/)         | Component library specs and standardization plan  |

## Tech Stack

| Layer         | Technology                                             |
| ------------- | ------------------------------------------------------ |
| Frontend      | SvelteKit 2, Svelte 5 (Runes), CSS Custom Properties   |
| Backend       | Node.js, adapter-node, child_process, node-pty         |
| Storage       | JSON files in `~/.home-server/` (no database)          |
| Network       | Tailscale VPN, WebSocket (terminal), UDP (smart bulbs) |
| Scheduling    | node-cron                                              |
| Notifications | ntfy.sh                                                |
| AI            | Claude API (chat), Claude CLI (agent)                  |

## Troubleshooting

### node-pty build errors during `npm install`

`node-pty` requires native compilation. On macOS, ensure Xcode Command Line Tools are installed:

```sh
xcode-select --install
```

If errors persist with Node v23, try:

```sh
npm install --engine-strict=false
npm rebuild node-pty
```

### Tailscale connection issues

Ensure Tailscale is running and authenticated on both devices:

```sh
# macOS
/Applications/Tailscale.app/Contents/MacOS/Tailscale status

# Linux
tailscale status
```

If the status shows "Stopped", start Tailscale from the menu bar (macOS) or run `sudo tailscale up` (Linux). Verify both devices are signed in with the same Tailscale account.

### Screen recording permission for screenshots

On macOS, the screenshot capture requires Screen Recording permission. When you first use the Screenshots page, macOS will prompt for permission. Grant it to the terminal or Node.js process in **System Settings > Privacy & Security > Screen Recording**.

### blueutil not found (Bluetooth on macOS)

The Peripherals page uses `blueutil` for Bluetooth device scanning on macOS. Install it via Homebrew:

```sh
brew install blueutil
```

Without `blueutil`, the Bluetooth section will show an error but the rest of the Peripherals page will work normally.

### "Blocked request" from Vite dev server

If you see "Blocked request. This host is not allowed", the Vite dev server is rejecting requests from an unrecognized hostname. The project already sets `allowedHosts: true` in `vite.config.ts` — simply restart the dev server.

## License

MIT
