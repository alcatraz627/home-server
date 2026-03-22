# Project Index

**Generated:** 2026-03-21
**Project:** home-server
**Location:** /Users/alcatraz627/Code/Personal/home-server

## Overview

- **Framework:** SvelteKit 2.x (Svelte 5 with Runes)
- **Language:** TypeScript (strict mode)
- **Package Manager:** npm
- **Project Type:** Fullstack — personal device management dashboard
- **Runtime:** Node.js 20 (Alpine Docker image)
- **Adapter:** @sveltejs/adapter-node (SSR, outputs to `build/`)
- **Version:** 1.1.1-still-lake-9

## Vision

A personal device management platform running across devices (laptop, phone, Raspberry Pi) connected via **Tailscale VPN**. Provides a unified control plane for file transfers, smart home control, backups, process management, and operator tasks — all accessible from any device on the tailnet with zero cloud dependency.

## Directory Structure

- `src/` — Application source code
  - `app.html` — HTML shell template
  - `app.css` — Global CSS with design token system (dark/light themes)
  - `app.d.ts` — SvelteKit type declarations
  - `hooks.server.ts` — Server hooks (request logging, lazy scheduler init)
  - `lib/` — Shared library code
    - `constants/` — App-wide constants (`app.ts` with version)
    - `components/` — Reusable UI components (`DataTable.svelte`)
    - `renderers/` — Plugin-style document renderer registry (Excel, Word, Markdown, JSON, Text)
    - `server/` — Server-only modules (one file per domain)
      - `backups.ts` — Rsync-based incremental backup engine
      - `config.ts` — Upload directory and file size config
      - `files.ts` — File CRUD with path traversal protection
      - `metadata.ts` — JSON sidecar metadata store for uploads
      - `notify.ts` — Push notifications via ntfy.sh
      - `operator.ts` — Task runner with retry, timeout, exponential backoff
      - `processes.ts` — OS process listing, signal sending, deep inspection
      - `scheduler.ts` — Cron-based job scheduling (node-cron)
      - `tailscale.ts` — Tailscale CLI status parser
      - `terminal.ts` — PTY session management (node-pty)
      - `wiz.ts` — Wiz smart bulb UDP discovery and control
      - `ws.ts` — WebSocket server for terminal connections
    - `types.ts` — Shared TypeScript interfaces (DeviceInfo, Widget)
    - `theme.ts` — Dark/light theme Svelte store with localStorage persistence
    - `markdown.ts` — Lightweight regex-based Markdown-to-HTML renderer
    - `json-viewer.ts` — JSON syntax highlighting and tree viewer
  - `routes/` — SvelteKit file-based routing
    - `+page.svelte` — Dashboard home (widget grid)
    - `+layout.svelte` — App shell (sidebar nav, header, theme toggle, loading bar)
    - `+layout.server.ts` — Provides device hostname/platform/arch to all pages
    - `files/` — File manager page (upload, download, preview, rename)
    - `lights/` — Wiz smart bulb control page
    - `processes/` — Process manager page (list, inspect, signal, tree view)
    - `tailscale/` — Tailscale device status page
    - `backups/` — Backup management page (configure, run, schedule)
    - `tasks/` — Operator task runner and disk usage page
    - `terminal/` — Web-based xterm.js terminal
    - `api/` — REST API endpoints
      - `files/` — File list (GET), upload (POST)
      - `files/[filename]/` — File download/delete/rename
      - `processes/` — Process list (GET)
      - `processes/[pid]/` — Process detail/signal
      - `lights/` — Bulb discovery
      - `lights/[ip]/` — Individual bulb control
      - `tailscale/` — Tailscale status
      - `backups/` — Backup management
      - `tasks/` — Task management
- `static/` — Static assets
  - `favicon.svg` — App favicon
  - `robots.txt` — Robots exclusion
  - `xterm.css` — Terminal styles
- `uploads/` — Default file upload directory (configurable via UPLOAD_DIR env)
- `docker-compose.yml` — Single-service Docker Compose config
- `Dockerfile` — Multi-stage Node.js 20 Alpine build

## Key Files

### Configuration

- `package.json` — Project dependencies and scripts (dev, build, preview, start, docker:*)
- `tsconfig.json` — Extends SvelteKit-generated config, strict mode, bundler resolution
- `svelte.config.js` — adapter-node (output: build), CSRF trusted origins (Tailscale IPs), Svelte 5 runes enabled
- `vite.config.ts` — SvelteKit plugin + custom WebSocket terminal plugin, host 0.0.0.0, port from env
- `Dockerfile` — Multi-stage build: builder (npm ci + vite build) -> runner (node build/index.js)
- `docker-compose.yml` — Dashboard service on port 3000, volume-mounted uploads, ORIGIN from Tailscale hostname
- `CLAUDE.md` — Agent instructions: version bump format and rules
- `PROJECT.md` — Product blueprint: vision, goals, milestones, architecture, roles

### Entry Points

- `src/app.html` — HTML shell with SvelteKit head/body placeholders
- `src/routes/+layout.svelte` — Root layout: sidebar navigation, header with hostname, theme toggle, loading shimmer
- `src/routes/+layout.server.ts` — Provides `os.hostname()`, `os.platform()`, `os.arch()` to all pages
- `src/hooks.server.ts` — Lazy scheduler start on first request, request duration logging
- `src/lib/constants/app.ts` — App name and version constant (updated after every change)

## Dependencies

### Production

- [ws](https://npmjs.com/package/ws) (^8.19.0) — WebSocket server for terminal connections
- [node-pty](https://npmjs.com/package/node-pty) (^1.1.0) — Pseudo-terminal for web shell
- [@xterm/xterm](https://npmjs.com/package/@xterm/xterm) (^6.0.0) — Terminal emulator UI
- [@xterm/addon-fit](https://npmjs.com/package/@xterm/addon-fit) (^0.11.0) — Auto-fit terminal to container
- [node-cron](https://npmjs.com/package/node-cron) (^4.2.1) — Cron-based job scheduling
- [mammoth](https://npmjs.com/package/mammoth) (^1.12.0) — Word document (.docx) to HTML conversion
- [xlsx](https://npmjs.com/package/xlsx) (^0.18.5) — Excel/spreadsheet file parsing (SheetJS)
- [@types/node-cron](https://npmjs.com/package/@types/node-cron) (^3.0.11) — TypeScript types for node-cron
- [@types/ws](https://npmjs.com/package/@types/ws) (^8.18.1) — TypeScript types for ws

### Development

- [svelte](https://npmjs.com/package/svelte) (^5.51.0) — UI framework (Svelte 5 with Runes)
- [@sveltejs/kit](https://npmjs.com/package/@sveltejs/kit) (^2.50.2) — Full-stack web framework
- [@sveltejs/adapter-node](https://npmjs.com/package/@sveltejs/adapter-node) (^5.0.0) — Node.js server adapter
- [@sveltejs/vite-plugin-svelte](https://npmjs.com/package/@sveltejs/vite-plugin-svelte) (^6.2.4) — Vite integration for Svelte
- [vite](https://npmjs.com/package/vite) (^7.3.1) — Build tool and dev server
- [typescript](https://npmjs.com/package/typescript) (^5.9.3) — Static type checking
- [svelte-check](https://npmjs.com/package/svelte-check) (^4.4.2) — Svelte-specific type checking
- [@types/node](https://npmjs.com/package/@types/node) (^25.5.0) — Node.js type definitions

### System Dependencies (not in package.json)

- `rsync` — Used by backup engine for incremental file sync
- `tailscale` — CLI used to query tailnet device status
- `lsof` — Used for process inspection (open files, network connections)

## Architectural Patterns

### Server Module Pattern

Each domain has exactly one server-side module in `src/lib/server/`. Modules export typed interfaces and pure functions. No cross-imports between server helpers — API routes are thin wrappers calling into these modules.

| Module          | Domain                      | Key Exports                                              |
| --------------- | --------------------------- | -------------------------------------------------------- |
| `files.ts`      | File management             | `listFiles`, `saveFile`, `getFileStream`, `deleteFile`   |
| `metadata.ts`   | File metadata sidecar       | `getFileMetadata`, `setFileMetadata`, `getAllMetadata`    |
| `processes.ts`  | OS process management       | `listProcesses`, `sendSignal`, `getProcessDetail`        |
| `wiz.ts`        | Smart bulb control          | `discoverBulbs`, `setBulbState`, `getBulbState`          |
| `tailscale.ts`  | VPN device status           | `getTailscaleStatus`                                     |
| `backups.ts`    | Incremental rsync backups   | `runBackup`, `getBackupStatuses`, `saveBackupConfig`     |
| `operator.ts`   | Task runner                 | `runTask`, `getTaskStatuses`, `getSystemDiskUsage`       |
| `scheduler.ts`  | Cron scheduling             | `startScheduler`, `scheduleAll`                          |
| `notify.ts`     | Push notifications (ntfy)   | `sendNotification`, `notifyTaskComplete`                 |
| `terminal.ts`   | PTY sessions                | `createSession`, `getSession`, `resizeSession`           |
| `ws.ts`         | WebSocket server            | `setupWebSocket`                                         |
| `config.ts`     | Environment config          | `getUploadDir`, `MAX_FILE_SIZE`                          |

### Document Renderer Registry

Plugin-style pattern in `src/lib/renderers/`. Each renderer implements the `DocumentRenderer` interface (`name`, `canRender(mime, filename)`, `render(data, filename)`). Renderers are registered in priority order — first match wins. Adding a new file format requires only implementing the interface and adding to the registry array.

Current renderers: Excel (SheetJS), Word (Mammoth), Markdown (custom regex), JSON (syntax highlighting), Text (catch-all).

### Two-Tier Process Stats

Process data is split into passive (cheap, always fetched: CPU, MEM, PID, user) and active (expensive, on-demand via Inspect button: open files, threads, network connections, environment vars). This prevents performance overhead from `lsof` and proc filesystem reads.

### Cron Scheduling

Tasks and backups both support cron expressions. The scheduler is lazily initialized on the first HTTP request via `hooks.server.ts`. It polls `node-cron` validated expressions from JSON config files stored in `~/.home-server/`.

### Data Storage

No database — all persistent state is JSON files:
- `~/.home-server/tasks.json` — Task configurations
- `~/.home-server/task-history.json` — Task run history (capped at 200 entries)
- `~/.home-server/backups.json` — Backup configurations
- `~/.home-server/backup-history.json` — Backup run history (capped at 100 entries)
- `<uploads>/.meta.json` — Per-file metadata sidecar

### Styling

CSS custom properties design system with dark/light themes. All colors use `var(--token)` tokens defined in `app.css`. Theme preference persists to `localStorage` under `hs:theme`. GitHub-dark-inspired default palette. No CSS framework — hand-written CSS with scoped `<style>` blocks in Svelte components.

### State Management

Svelte 5 Runes (`$state`, `$derived`, `$effect`, `$props`) for component state. Svelte stores (`writable`) for global state (theme). No external state management library. Server-side data loaded via SvelteKit `+page.server.ts` load functions.

### API Communication

SvelteKit API routes (`+server.ts`) returning JSON via `json()` helper. Client pages use SvelteKit's built-in `fetch` and load functions. WebSocket for real-time terminal I/O. UDP datagrams for Wiz bulb communication.

### Notifications

Push notifications via [ntfy.sh](https://ntfy.sh) — configurable topic and server via `NTFY_TOPIC` / `NTFY_SERVER` environment variables. Notifications sent on task/backup completion (success or failure).

### Security

- Path traversal protection in file operations (`safePath` validates resolved paths stay within base directory)
- CSRF trusted origins configured for Tailscale IPs
- Signal sending restricted to a whitelist of POSIX signals
- No authentication — relies on Tailscale VPN for access control (tailnet-only access)

## Routes / Pages

| Route          | Purpose                                               | Data Source            |
| -------------- | ----------------------------------------------------- | ---------------------- |
| `/`            | Dashboard — widget grid linking to all features        | Static widget list     |
| `/files`       | File manager — upload, download, preview, rename       | API + server load      |
| `/lights`      | Wiz bulb control — discovery, on/off, brightness, RGB  | UDP broadcast          |
| `/processes`   | Process manager — list, sort, inspect, signal, tree    | `ps` command           |
| `/tailscale`   | Tailscale device status — online peers, IPs            | `tailscale status`     |
| `/backups`     | Backup manager — configure, run, schedule rsync jobs   | JSON config files      |
| `/tasks`       | Operator tasks — CRUD, run, schedule, disk usage chart | JSON config files      |
| `/terminal`    | Web terminal — xterm.js + node-pty via WebSocket       | PTY over WebSocket     |

## API Endpoints

| Method | Endpoint                    | Purpose                           |
| ------ | --------------------------- | --------------------------------- |
| GET    | `/api/files`                | List files (with metadata)        |
| POST   | `/api/files`                | Upload file (multipart form)      |
| GET    | `/api/files/[filename]`     | Download file                     |
| DELETE | `/api/files/[filename]`     | Delete file                       |
| PATCH  | `/api/files/[filename]`     | Rename file                       |
| GET    | `/api/processes`            | List processes (sortable)         |
| GET    | `/api/processes/[pid]`      | Process detail (active tier)      |
| POST   | `/api/processes/[pid]`      | Send signal to process            |
| GET    | `/api/lights`               | Discover Wiz bulbs                |
| GET    | `/api/lights/[ip]`          | Get bulb state                    |
| POST   | `/api/lights/[ip]`          | Set bulb state                    |
| GET    | `/api/tailscale`            | Get tailnet device status         |
| GET    | `/api/backups`              | Get backup configs and statuses   |
| POST   | `/api/backups`              | Create/update backup config       |
| GET    | `/api/tasks`                | Get task configs and statuses     |
| POST   | `/api/tasks`                | Create/update/run task            |
| WS     | `/ws/terminal`              | Terminal WebSocket connection      |

## Key Code Snippets

### `src/lib/constants/app.ts` — Version tracking constant

```ts
export const APP = {
	title: 'Home Server',
	version: '1.1.1-still-lake-9',
} as const;
```

### `src/hooks.server.ts` — Lazy scheduler init and request logging

```ts
import type { Handle } from '@sveltejs/kit';
import { startScheduler } from '$lib/server/scheduler';

let schedulerStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!schedulerStarted) {
		schedulerStarted = true;
		startScheduler().catch(err => console.error('Scheduler failed to start:', err));
	}

	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	console.log(`${event.request.method} ${event.url.pathname} ${response.status} ${duration}ms`);
	return response;
};
```

### `src/lib/renderers/index.ts` — Plugin-style document renderer registry

```ts
export interface DocumentRenderer {
	name: string;
	canRender: (mime: string, filename: string) => boolean;
	render: (data: ArrayBuffer, filename: string) => Promise<RenderResult>;
}

const RENDERERS: DocumentRenderer[] = [
	excelRenderer,
	wordRenderer,
	markdownRenderer,
	jsonRenderer,
	textRenderer,  // catch-all for text/* types
];

export function getRenderer(mime: string, filename: string): DocumentRenderer | null {
	return RENDERERS.find(r => r.canRender(mime, filename)) || null;
}
```

### `src/lib/server/wiz.ts` — Wiz bulb UDP discovery pattern

```ts
export async function discoverBulbs(): Promise<WizBulb[]> {
	const localIp = getLocalIp();
	const message = JSON.stringify({
		method: 'registration',
		params: { phoneMac: 'AAAAAAAAAAAA', register: false, phoneIp: localIp, id: '1' }
	});

	const bulbs = new Map<string, WizBulb>();
	const socket = dgram.createSocket('udp4');

	return new Promise((resolve) => {
		socket.on('message', (msg, rinfo) => {
			try {
				const data = JSON.parse(msg.toString());
				if (data.result?.mac) {
					bulbs.set(data.result.mac, parseBulbResult(rinfo.address, data.result));
				}
			} catch { /* ignore */ }
		});

		socket.bind(() => {
			socket.setBroadcast(true);
			socket.send(Buffer.from(message), 0, message.length, WIZ_PORT, '255.255.255.255');
		});

		setTimeout(() => { socket.close(); resolve(Array.from(bulbs.values())); }, DISCOVERY_TIMEOUT);
	});
}
```

### `src/lib/server/operator.ts` — Task runner with retry and exponential backoff

```ts
proc.on('close', async (code: number | null) => {
	clearTimeout(timer);
	run.completedAt = new Date().toISOString();
	run.exitCode = code;
	run.duration = Date.now() - startMs;

	if (run.status !== 'timeout') {
		run.status = code === 0 ? 'success' : 'failed';
	}

	runningTasks.delete(taskId);
	await appendTaskHistory(run);

	if (config.notify && (run.status === 'success' || attempt >= config.maxRetries)) {
		notifyTaskComplete(config.name, run.status as any, run.duration || undefined).catch(() => {});
	}

	// Retry on failure with exponential backoff: 2^attempt seconds
	if (run.status === 'failed' && attempt < config.maxRetries) {
		const delay = Math.pow(2, attempt) * 1000;
		setTimeout(() => runTask(taskId, attempt + 1), delay);
	}
});
```

### `src/lib/theme.ts` — Dark/light theme with localStorage persistence

```ts
export const theme = writable<Theme>(getInitialTheme());

export function toggleTheme() {
	theme.update(t => {
		const next = t === 'dark' ? 'light' : 'dark';
		if (browser) {
			localStorage.setItem('hs:theme', next);
			document.documentElement.setAttribute('data-theme', next);
		}
		return next;
	});
}
```

### `src/lib/server/ws.ts` — WebSocket terminal bridge (PTY to client)

```ts
function handleTerminalConnection(ws: WebSocket, url: URL) {
	const cols = parseInt(url.searchParams.get('cols') || '80');
	const rows = parseInt(url.searchParams.get('rows') || '24');
	const sessionId = url.searchParams.get('session');

	let session = sessionId ? getSession(sessionId) : undefined;
	if (!session) { session = createSession(cols, rows); }

	ws.send(JSON.stringify({ type: 'session', id: session.id }));

	const dataHandler = session.pty.onData((data: string) => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'output', data }));
		}
	});

	ws.on('message', (raw) => {
		const msg = JSON.parse(raw.toString());
		if (msg.type === 'input' && session) { session.pty.write(msg.data); }
		else if (msg.type === 'resize' && session) { resizeSession(session.id, msg.cols, msg.rows); }
	});

	ws.on('close', () => { dataHandler.dispose(); });
}
```

## Notes

- **No database** — All persistence is via JSON files in `~/.home-server/` and the uploads directory. Suitable for single-user personal use.
- **No authentication** — Security relies entirely on Tailscale VPN. The app is only accessible within the tailnet.
- **Svelte 5 Runes** — The project uses Svelte 5's new reactivity model (`$state`, `$derived`, `$effect`, `$props`) instead of the older `$:` reactive declarations.
- **CSRF trusted origins** include Tailscale and local network IPs, configured in `svelte.config.js`.
- **WebSocket terminal** is attached via a custom Vite plugin during dev and directly in production via the HTTP server upgrade event.
- **Version tagging** follows `major.minor.patch-word-word-number` format. Must be updated after every change per `CLAUDE.md` instructions.
- **Docker deployment** uses multi-stage build with Node 20 Alpine. Uploads volume-mounted at `/data/uploads`.
- **Config lives in `~/.home-server/`** — not in the project directory. Tasks and backups persist across deployments.
- **Notification integration** is optional — requires `NTFY_TOPIC` env var to enable ntfy.sh push notifications.
