# API Reference

All endpoints return JSON unless otherwise noted. Base URL: `http://<host>:5555`

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
  "r": 255, "g": 200, "b": 100,
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
      "os": "macOS",
      "online": true,
      "isSelf": true,
      "exitNode": false,
      "tags": []
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
  "disk": [
    { "mount": "/", "total": "500G", "used": "280G", "available": "220G", "usePercent": "56%" }
  ]
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
