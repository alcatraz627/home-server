# Home Server

Personal device management platform running across devices connected via **Tailscale VPN**. Built with SvelteKit.

See [PROJECT.md](PROJECT.md) for the full vision, goals, and milestones.

## Features

### Core Pages

| Page             | Description                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**    | System stats (CPU/MEM/disk), task/backup/keeper status, activity timeline, top processes. Auto-refreshes every 30s.                                            |
| **Files**        | Drag-and-drop upload, download, rename, delete. In-browser preview for images, video, audio, PDF, Excel, Markdown, JSON, Word. Media streaming with playlists. |
| **Smart Lights** | Wiz bulb control — on/off, brightness, color, scenes. Room grouping, quick presets, session cache.                                                             |
| **Processes**    | Real-time system monitor (CPU/MEM/Network/Load SVG charts), sortable process list, starred processes, tree view, expandable detail rows.                       |
| **Tailscale**    | Full device details — IPv4/IPv6, DNS name, version, last seen, key expiry warnings, traffic stats, advertised routes.                                          |
| **Backups**      | rsync-based backups with visual source→dest diagram, CronBuilder, tag-style excludes, rsync preview. Dry-run diff preview.                                     |
| **Tasks**        | Shell task runner with templates (100+), inline terminal output, pagination, status icons, animated transitions.                                               |
| **Keeper**       | Feature tracker with Claude agent integration — spawn agents, live log streaming, ANSI color rendering, resume/chat.                                           |
| **Terminal**     | Full web-based terminal via xterm.js + node-pty. Tab renaming, middle-click close, session persistence.                                                        |

### Tools & Utilities

| Page               | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **QR Code**        | Pure client-side QR generator with WiFi shortcut, size slider, error correction, PNG download. |
| **Bookmarks**      | Link manager with tags, search/filter, favicon display, HTML export.                           |
| **Kanban**         | Drag-and-drop project board (Todo/Doing/Done) with color labels and due dates.                 |
| **Wake-on-LAN**    | UDP magic packet sender with device management and ping status.                                |
| **DNS Lookup**     | Multi-provider comparison (Google, Cloudflare, system) with 7 record types.                    |
| **Port Scanner**   | Scan ports with service detection, common ports preset, concurrent scanning.                   |
| **Speed Test**     | Download/upload/latency measurement with SVG gauges and history.                               |
| **Clipboard Sync** | Share clipboard across tailnet devices with auto-refresh.                                      |
| **Screenshots**    | Capture and browse screenshots with gallery view and full-size modal.                          |
| **Benchmarks**     | CPU/disk/memory benchmarks with history comparison.                                            |

### Security & Network

| Page                | Description                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **WiFi Scanner**    | Nearby networks with signal bars, channel, security type. Highlights open networks.                         |
| **Packet Sniffer**  | tcpdump-based live packet capture with configurable filters.                                                |
| **Network Toolkit** | 7 tools: traceroute, ping sweep, ARP table, whois, bandwidth monitor, SSL inspector, HTTP header inspector. |
| **Peripherals**     | WiFi and Bluetooth device scanning (macOS + Linux).                                                         |

### App Infrastructure

| Feature            | Description                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **10 Themes**      | Dark, Light, Monokai, Dracula, Solarized (2), Nord, GitHub Dark, Catppuccin, Tokyo Night |
| **Settings Panel** | Theme grid, accent colors, font size/family, border radius, high contrast toggle         |
| **PWA**            | Installable as app, service worker with offline caching, install prompt banner           |
| **Multi-Device**   | Device selector in navbar, API proxying via Tailscale                                    |
| **AI Chat**        | Floating Claude chat with conversation tabs, rename, typing indicator, copy buttons      |

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
│   ├── components/        # 8 reusable UI components
│   │   ├── AiChat.svelte  # AI chat with tabs + history
│   │   ├── CronBuilder.svelte  # Visual cron builder
│   │   ├── MediaPlayer.svelte  # Video/audio player
│   │   ├── SettingsPanel.svelte# Theme/font controls
│   │   ├── DataTable.svelte    # Sortable table
│   │   ├── FileBrowser.svelte  # File picker modal
│   │   ├── Toast.svelte        # Toast notifications
│   │   └── EmptyState.svelte   # Empty state placeholder
│   ├── renderers/         # Pluggable file preview
│   ├── constants/app.ts   # Version tag
│   ├── theme.ts           # 10 themes + setTheme
│   ├── stars.ts           # Universal starring store
│   ├── device-context.ts  # Multi-device switching
│   ├── toast.ts           # Toast store with dedupe
│   ├── markdown.ts        # Markdown→HTML
│   └── types.ts           # Shared types
├── routes/                # 25 pages + 31 API endpoints
└── app.css                # 10 themes + animations
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
