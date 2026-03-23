# API Reference

All endpoints return JSON unless otherwise noted. Base URL: `http://<host>:5555`

**50+ API routes across 35 domains.** Last updated: v4.8.1

## New in v4.3–4.8

| Endpoint                    | Method              | Description                                               |
| --------------------------- | ------------------- | --------------------------------------------------------- |
| `/api/health`               | GET                 | Server health check (green/yellow/red + latency)          |
| `/api/status`               | GET                 | Full app status (version, server info, storage breakdown) |
| `/api/notes`                | GET/POST/PUT/DELETE | Notes CRUD with block-based content                       |
| `/api/databases`            | GET/POST            | Database service status (PostgreSQL, Redis, MongoDB, PM2) |
| `/api/dns/trace`            | POST                | DNS path trace via `dig +trace`                           |
| `/api/wifi/diagnostics`     | POST                | Network diagnostics (ping, DNS, traceroute, internet)     |
| `/api/terminal/pin`         | GET/POST            | Terminal PIN gate management                              |
| `/api/apps/{name}`          | GET                 | App process details (CPU, MEM, PIDs, version)             |
| `/api/apps/icon/{name}`     | GET                 | macOS app icon extraction (PNG)                           |
| `/api/logs`                 | POST                | Client-side error reporting                               |
| `/api/logs?action=raw`      | GET                 | Raw log file content for preview                          |
| `/api/logs?action=download` | GET                 | Download log file                                         |

---

## Files

### `GET /api/files`

List all files in the upload directory with metadata.

**Query params:** `path` (optional) — subdirectory path

**Response:** `200`

```json
[
  {
    "name": "photo.jpg",
    "size": 2048576,
    "modified": "2026-03-21T12:00:00.000Z",
    "created": "2026-03-21T11:00:00.000Z",
    "isDirectory": false,
    "permissions": "rw-r--r--",
    "mime": "image/jpeg",
    "meta": {
      "uploadedFrom": "100.88.194.107",
      "uploadedAt": "2026-03-21T11:00:00.000Z"
    }
  }
]
```

### `POST /api/files`

Upload a file. Records upload source device in metadata.

**Body:** `multipart/form-data` with fields:

- `file` (required) — the file
- `path` (optional) — subdirectory

**Response:** `201` — the created `FileInfo` object

### `GET /api/files/:filename`

Download or preview a file.

**Query params:**

- `path` (optional) — subdirectory
- `preview=true` (optional) — serve with correct MIME type and `Content-Disposition: inline` instead of download

**Response:** `200` — file stream with appropriate headers

### `PATCH /api/files/:filename`

Rename a file. Updates metadata sidecar.

**Body:** `{ "name": "new-name.txt" }`

**Response:** `200` — `{ "ok": true, "name": "new-name.txt" }`

### `DELETE /api/files/:filename`

Delete a file. Removes metadata entry.

**Query params:** `path` (optional) — subdirectory

**Response:** `204` — no content

---

## Processes

### `GET /api/processes`

List all running processes.

**Query params:** `sort` (optional) — `cpu` (default), `mem`, `name`, `pid`

**Response:** `200`

```json
[
  {
    "pid": 1234,
    "ppid": 1,
    "user": "alcatraz627",
    "name": "node",
    "cpu": 12.5,
    "mem": 2.3,
    "vsz": 1048576,
    "rss": 65536,
    "state": "S+",
    "startTime": "8:56PM",
    "command": "node build/index.js"
  }
]
```

### `GET /api/processes/:pid`

Get detailed inspection data for a process (active tier — may take 1-5s).

**Response:** `200`

```json
{
  "pid": 1234,
  "openFiles": ["/usr/lib/libSystem.B.dylib", "/dev/ttys001"],
  "env": { "HOME": "/Users/alcatraz627", "PATH": "..." },
  "threads": 8,
  "connections": ["localhost:5555->localhost:52431"]
}
```

### `DELETE /api/processes/:pid`

Send a signal to a process.

**Query params:** `signal` (optional) — `TERM` (default), `KILL`, `HUP`, `INT`, `STOP`, `CONT`, `USR1`, `USR2`

**Response:** `204` — signal sent

---

## Lights (Wiz Bulbs)

### `GET /api/lights`

Discover all Wiz bulbs on the local network. Takes ~3s (UDP broadcast timeout).

**Response:** `200`

```json
[
  {
    "ip": "192.168.1.42",
    "mac": "A1B2C3D4E5F6",
    "state": true,
    "brightness": 80,
    "color": { "r": 255, "g": 200, "b": 100 },
    "colorTemp": null,
    "sceneId": null,
    "moduleName": "ESP01_SHRGB_03",
    "fwVersion": "1.22.0",
    "signal": null,
    "rssi": -45
  }
]
```

### `GET /api/lights/:ip`

Get current state of a specific bulb.

**Response:** `200` — single `WizBulb` object

### `PUT /api/lights/:ip`

Set bulb state.

**Body:** Any combination of:

```json
{
  "state": true,
  "dimming": 80,
  "r": 255,
  "g": 200,
  "b": 100,
  "temp": 4000,
  "sceneId": 6
}
```

**Response:** `200` — updated bulb state

---

## Tailscale

### `GET /api/tailscale`

Get all devices on the tailnet.

**Response:** `200`

```json
{
  "devices": [
    {
      "hostname": "macbook-pro",
      "ipv4": "100.88.194.107",
      "ipv6": "fd7a:...",
      "os": "macOS",
      "online": true,
      "isSelf": true,
      "exitNode": false,
      "exitNodeOption": true,
      "tags": [],
      "tailscaleVersion": "1.62.0",
      "lastSeen": "2026-03-22T01:00:00Z",
      "created": "2025-01-15T00:00:00Z",
      "keyExpiry": "2026-06-15T00:00:00Z",
      "relay": "derp1",
      "rxBytes": 1048576,
      "txBytes": 524288,
      "advertisedRoutes": [],
      "user": "user@example.com",
      "dnsName": "macbook-pro.tail1234.ts.net"
    }
  ],
  "error": null
}
```

---

## Backups

### `GET /api/backups`

Get all backup configurations with last run status.

**Response:** `200`

```json
{
  "statuses": [
    {
      "config": {
        "id": "abc123",
        "name": "Phone Photos",
        "sourcePath": "/Volumes/phone/DCIM/",
        "destPath": "/Volumes/Backup/photos/",
        "schedule": "0 2 * * *",
        "excludes": [".thumbnails"],
        "enabled": true
      },
      "lastRun": {
        "id": "abc123-1711036800000",
        "configId": "abc123",
        "startedAt": "2026-03-21T02:00:00.000Z",
        "completedAt": "2026-03-21T02:05:30.000Z",
        "status": "success",
        "filesTransferred": 42,
        "bytesTransferred": 1048576,
        "error": null
      },
      "nextRun": "scheduled"
    }
  ],
  "rsyncAvailable": true
}
```

### `POST /api/backups`

Create or update a backup configuration.

**Body:**

```json
{
  "name": "Phone Photos",
  "sourcePath": "/Volumes/phone/DCIM/",
  "destPath": "/Volumes/Backup/photos/",
  "schedule": "0 2 * * *",
  "excludes": [".thumbnails"]
}
```

**Response:** `201` — the created config

### `PUT /api/backups`

Trigger a backup run.

**Body:** `{ "configId": "abc123" }`

**Response:** `200` — the `BackupRun` object (status: "running")

---

## Tasks (Operator)

### `GET /api/tasks`

Get all task configurations with last run status and disk usage.

**Response:** `200`

```json
{
  "statuses": [
    {
      "config": {
        "id": "disk-check",
        "name": "Disk Space Check",
        "command": "df -h /",
        "schedule": "0 */6 * * *",
        "timeout": 30,
        "maxRetries": 0,
        "notify": true,
        "enabled": true
      },
      "lastRun": {
        "id": "disk-check-1711036800000",
        "taskId": "disk-check",
        "startedAt": "2026-03-21T06:00:00.000Z",
        "completedAt": "2026-03-21T06:00:01.200Z",
        "status": "success",
        "exitCode": 0,
        "output": "Filesystem  Size  Used  Avail  Use%\n/dev/disk1  500G  280G  220G  56%",
        "attempt": 1,
        "duration": 1200
      },
      "isRunning": false
    }
  ],
  "disk": [{ "mount": "/", "total": "500G", "used": "280G", "available": "220G", "usePercent": "56%" }]
}
```

### `POST /api/tasks`

Create or update a task configuration.

**Body:**

```json
{
  "name": "Disk Space Check",
  "command": "df -h /",
  "timeout": 30,
  "maxRetries": 0,
  "schedule": "0 */6 * * *"
}
```

**Response:** `201` — the created config

### `PUT /api/tasks`

Trigger a task run.

**Body:** `{ "taskId": "disk-check" }`

**Response:** `200` — the `TaskRun` object (status: "running")

### `DELETE /api/tasks`

Delete a task configuration.

**Body:** `{ "id": "disk-check" }`

**Response:** `204` — no content

---

## Terminal (WebSocket)

### `WS /ws/terminal`

Full-duplex terminal session over WebSocket.

**Query params:**

- `cols` (optional, default: 80) — terminal columns
- `rows` (optional, default: 24) — terminal rows
- `session` (optional) — session ID to resume

**Messages (client → server):**

```json
{ "type": "input", "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

**Messages (server → client):**

```json
{ "type": "session", "id": "a1b2c3d4" }
{ "type": "output", "data": "total 64\ndrwxr-xr-x  12 user  staff  384 Mar 21 12:00 .\n" }
```

---

## Media Streaming

### `GET /api/files/stream/[...path]`

Serve files with HTTP Range support (206 Partial Content) for video/audio seeking.

**Headers:** `Range: bytes=start-end` (optional)

**Response:** `200` (full) or `206` (partial) with `Content-Range`, `Accept-Ranges: bytes`

---

## Keeper Agent

### `GET /api/keeper`

Get all feature requests with running agent status.

### `POST /api/keeper`

Create a new feature request. Status starts as `draft`.

### `GET /api/keeper/:id/log?offset=N`

Stream agent log content from byte offset N. Used for 1s polling.

### `POST /api/keeper/:id/message`

Send a message to the running agent's stdin.

**Body:** `{ "message": "..." }`

### `POST /api/keeper/:id/agent`

Control agent lifecycle.

**Body:** `{ "action": "start" | "stop" | "resume" }`

---

## Backup Preview

### `POST /api/backups/preview`

Dry-run rsync to preview what would transfer.

**Body:** `{ "configId": "abc123" }`

**Response:** `200` — `{ "files": [...], "summary": "..." }`

---

## AI Chat

### `POST /api/ai/chat`

Proxy to Claude API with codebase context injection.

**Body:** `{ "messages": [{ "role": "user", "content": "..." }] }`

**Response:** `200` — `{ "reply": "..." }`

---

## Bookmarks

### `GET /api/bookmarks` — List all bookmarks

### `POST /api/bookmarks` — Create bookmark

### `PUT /api/bookmarks` — Update bookmark

### `DELETE /api/bookmarks` — Delete bookmark

Stored in `~/.home-server/bookmarks.json`.

---

## Kanban

### `GET /api/kanban` — Get board state (3 columns + cards)

### `POST /api/kanban` — Add card

### `PUT /api/kanban` — Move/update card

### `DELETE /api/kanban` — Delete card

Stored in `~/.home-server/kanban.json`.

---

## Wake-on-LAN

### `GET /api/wol` — List configured devices

### `POST /api/wol` — Send magic packet or add device

### `DELETE /api/wol` — Remove device

Stored in `~/.home-server/wol-devices.json`.

---

## DNS Lookup

### `POST /api/dns`

Multi-provider DNS lookup.

**Body:** `{ "domain": "example.com", "type": "A" }`

Queries Google (8.8.8.8), Cloudflare (1.1.1.1), and system DNS.

---

## Port Scanner

### `POST /api/ports`

Scan ports on a target host.

**Body:** `{ "host": "192.168.1.1", "ports": [22, 80, 443] }`

Uses `net.createConnection` with concurrency limits.

---

## Speed Test

### `GET /api/speedtest` — Download test blob

### `POST /api/speedtest` — Upload test blob

Measures local network throughput.

---

## Clipboard Sync

### `GET /api/clipboard` — List clipboard entries

### `POST /api/clipboard` — Add entry

### `DELETE /api/clipboard` — Clear entries

In-memory storage (max 50 entries, FIFO).

---

## Screenshots

### `GET /api/screenshots` — List screenshots

### `POST /api/screenshots` — Capture screenshot (`screencapture` on macOS)

### `DELETE /api/screenshots` — Delete screenshot

Stored in `~/.home-server/screenshots/`.

---

## Benchmarks

### `POST /api/benchmarks`

Run CPU, memory, or disk benchmark.

**Body:** `{ "type": "cpu" | "memory" | "disk" }`

History stored in `~/.home-server/benchmarks.json`.

---

## WiFi

### `GET /api/wifi` — Scan nearby networks + current connection

### `POST /api/wifi` — Connect to network (macOS)

---

## Packets

### `GET /api/packets` — Get captured packets

### `POST /api/packets` — Start/stop/clear capture

Uses `tcpdump` subprocess. Requires sudo.

---

## Network Toolkit

### `POST /api/network`

Multi-tool endpoint. Tool selected via `tool` parameter.

**Body:** `{ "tool": "traceroute" | "ping" | "arp" | "whois" | "bandwidth" | "ssl" | "http", ... }`

---

## Peripherals

### `GET /api/peripherals`

WiFi networks + Bluetooth devices.

**Response:** `200` — `{ "wifi": [...], "bluetooth": [...], "currentWifi": { ... } }`

---

## Apps

### `GET /api/apps`

List running macOS applications.

### `POST /api/apps`

Launch or quit a macOS application.

**Body:** `{ "action": "launch" | "quit", "name": "AppName" }`

---

## File Search

### `GET /api/files/search`

Search files by name across the upload directory.

**Query params:** `q` (search term)

---

## Terminal Sessions

### `GET /api/terminal/:sessionId`

Get terminal session info or output history.

---

## System

### `GET /api/system`

System stats snapshot (CPU cores, memory, network, disk I/O, uptime).

### `GET /api/browse`

Directory listing for file browser.

**Query params:** `path` (optional)
