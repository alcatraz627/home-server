# Home Server

Personal device management platform running across devices connected via **Tailscale VPN**. Built with SvelteKit.

See [PROJECT.md](PROJECT.md) for the full vision, goals, and milestones.

## Features

| Widget | Description |
|--------|-------------|
| **File Transfer** | Drag-and-drop upload, download, rename, delete. In-browser preview for images, video, audio, PDF, Excel, Markdown, JSON, Word, and text files. |
| **Smart Lights** | Wiz bulb control — on/off, brightness, color, temperature, scenes. Group control, naming, auto-polling. |
| **Process Manager** | Sortable/filterable process list. Starred processes, tree view, expandable detail rows, signal dropdown, active inspection (open files, threads, network connections). |
| **Tailscale** | View all connected devices on your tailnet with online status. |
| **Backups** | rsync-based backups with configurable source/dest, excludes, cron scheduling, and run history. |
| **Tasks** | Config-driven shell task runner with timeout, retry (exponential backoff), cron scheduling, output capture, and disk usage monitoring. |
| **Terminal** | Full web-based terminal via xterm.js + node-pty. Session persistence across reconnects. |

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

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5555` | Dev server port |
| `UPLOAD_DIR` | `./uploads` | File storage directory |
| `MAX_FILE_SIZE` | `524288000` (500MB) | Max upload size |
| `NTFY_TOPIC` | _(disabled)_ | ntfy.sh topic for push notifications |
| `NTFY_SERVER` | `https://ntfy.sh` | ntfy.sh server URL (for self-hosted) |

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
│   ├── server/          # Server-side helpers (one per domain)
│   │   ├── files.ts     # File CRUD + MIME detection
│   │   ├── metadata.ts  # Per-file metadata sidecar store
│   │   ├── processes.ts # Process list, kill, detail inspection
│   │   ├── tailscale.ts # Tailscale CLI wrapper
│   │   ├── wiz.ts       # Wiz bulb UDP control
│   │   ├── backups.ts   # rsync backup runner
│   │   ├── operator.ts  # Task runner with retry/timeout
│   │   ├── terminal.ts  # PTY session management
│   │   ├── ws.ts        # WebSocket server for terminal
│   │   ├── scheduler.ts # Cron scheduling for tasks/backups
│   │   ├── notify.ts    # ntfy.sh notification service
│   │   └── config.ts    # Upload dir + size limit config
│   ├── renderers/       # Pluggable file preview renderers
│   │   ├── index.ts     # Registry + DocumentRenderer interface
│   │   ├── excel.ts     # SheetJS (.xlsx/.xls/.csv)
│   │   ├── word.ts      # Mammoth (.docx)
│   │   ├── markdown.ts  # Custom regex parser
│   │   ├── json.ts      # Collapsible tree viewer
│   │   └── text.ts      # Plain text catch-all
│   ├── components/      # Reusable UI components
│   │   └── DataTable.svelte  # Sort, search, filter, pagination
│   ├── constants/app.ts # Version tag
│   ├── theme.ts         # Dark/light mode store
│   ├── markdown.ts      # Markdown→HTML renderer
│   ├── json-viewer.ts   # JSON→HTML tree renderer
│   └── types.ts         # Shared types
├── routes/
│   ├── api/             # REST API endpoints
│   └── [page]/          # SvelteKit pages
└── app.css              # Theme variables + global styles
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
