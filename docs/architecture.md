# Architecture

## Overview

Home Server is a SvelteKit application that serves as a unified control plane for devices connected via Tailscale VPN. It runs natively on macOS/Linux (no Docker for dev) and uses adapter-node for production deployment.

```
┌─────────────────────────────────────────────────────────┐
│                    Tailscale VPN (tailnet)               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Laptop     │  │  Raspberry   │  │    Phone      │  │
│  │              │  │     Pi       │  │               │  │
│  │ ● Dashboard  │  │ ● Backup     │  │ ● Browser     │  │
│  │ ● File API   │  │   storage    │  │   client      │  │
│  │ ● Process    │  │ ● File API   │  │ ● File        │  │
│  │   manager    │  │ ● Operator   │  │   upload      │  │
│  │ ● Wiz bulbs  │  │   tasks      │  │ ● Backup      │  │
│  │ ● Terminal   │  │              │  │   source      │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (SvelteKit Pages)                  │
│  ├─ Svelte 5 components with runes          │
│  ├─ Client-side renderers (SheetJS, etc.)   │
│  └─ xterm.js terminal                       │
├─────────────────────────────────────────────┤
│  API Layer (SvelteKit Routes)               │
│  ├─ REST: /api/files, /api/processes, ...   │
│  └─ WebSocket: /ws/terminal                 │
├─────────────────────────────────────────────┤
│  Server Helpers (src/lib/server/) — 14 modules│
│  ├─ files, processes, wiz, tailscale, ...   │
│  ├─ agent-runner.ts (Claude CLI subprocess) │
│  ├─ scheduler.ts (node-cron)                │
│  └─ notify.ts (ntfy.sh), wol.ts             │
├─────────────────────────────────────────────┤
│  System Layer                               │
│  ├─ child_process (ps, kill, lsof, rsync)   │
│  ├─ dgram (Wiz UDP protocol)               │
│  ├─ node-pty (terminal PTY)                 │
│  └─ fs (uploads, config storage)            │
└─────────────────────────────────────────────┘
```

## Module Boundaries

Each domain has a **server helper**, **API routes**, and a **page**. No cross-imports between server helpers — they are independent modules.

| Domain    | Server Helper             | API Routes                                 | Page         |
| --------- | ------------------------- | ------------------------------------------ | ------------ |
| Files     | `files.ts`, `metadata.ts` | `/api/files/`, `/api/files/[filename]/`    | `/files`     |
| Processes | `processes.ts`            | `/api/processes/`, `/api/processes/[pid]/` | `/processes` |
| Lights    | `wiz.ts`                  | `/api/lights/`, `/api/lights/[ip]/`        | `/lights`    |
| Tailscale | `tailscale.ts`            | `/api/tailscale/`                          | `/tailscale` |
| Backups   | `backups.ts`              | `/api/backups/`                            | `/backups`   |
| Tasks     | `operator.ts`             | `/api/tasks/`                              | `/tasks`     |
| Terminal  | `terminal.ts`, `ws.ts`    | WebSocket `/ws/terminal`                   | `/terminal`  |

## Data Flow

### Server-Rendered Pages

```
Browser → SvelteKit Route (+page.server.ts)
       → Server Helper (e.g., listProcesses())
       → System Call (e.g., ps -eo ...)
       → Parse + Return → SSR HTML → Hydrate
```

### Client-Side Refresh

```
User clicks "Refresh" → fetch('/api/processes')
                      → API Route (GET handler)
                      → Server Helper → System Call
                      → JSON Response → Update $state
```

### WebSocket (Terminal)

```
Browser (xterm.js) ↔ WebSocket (/ws/terminal)
                   ↔ node-pty (PTY session)
                   ↔ Shell process (zsh/bash)
```

## State Management

- **Server state**: No database. Config stored in `~/.home-server/*.json`. File metadata in `uploads/.meta.json`.
- **Client state**: Svelte 5 `$state` runes. Props from server load initialize local state, then refreshed independently via API calls.
- **Persistent client state**: `localStorage` for starred processes, bulb names, theme preference.

## Process Data Tiers

To avoid performance overhead, process inspection is split into two tiers:

| Tier        | Data                                                  | Cost                        | When                           |
| ----------- | ----------------------------------------------------- | --------------------------- | ------------------------------ |
| **Passive** | PID, PPID, CPU%, MEM%, RSS, VSZ, state, user, command | ~150ms (`ps -eo`)           | Always shown, auto-refreshable |
| **Active**  | Open files, network connections, threads, environment | 1-5s (`lsof`, thread count) | On-demand via "Inspect" button |

## Renderer Plugin System

File preview uses a registry pattern:

```
DocumentRenderer interface
├── canRender(mime, filename) → boolean
├── render(data, filename) → RenderResult
│
Registry (index.ts) — first match wins:
├── excelRenderer  (.xlsx, .xls, .csv)
├── wordRenderer   (.docx)
├── markdownRenderer (.md)
├── jsonRenderer   (.json)
└── textRenderer   (text/*)
```

`RenderResult` types:

- `html` — rendered via `{@html}` (markdown, word)
- `text` — displayed in `<pre>` (plain text)
- `data` — structured `SheetData[]` rendered by `DataTable` component (excel)

## Theme System

CSS custom properties with 20 theme variants (dark, light, monokai, dracula, solarized-dark/light, nord, github-dark, catppuccin, tokyo-night, one-dark, gruvbox-dark/light, everforest, rosé-pine, ayu-dark/light, material-dark, kanagawa, cyberpunk):

```css
:root, [data-theme='dark']  { --bg-primary: #0f1117; ... }
[data-theme='light']        { --bg-primary: #ffffff; ... }
```

Theme toggle sets `data-theme` attribute on `<html>` and persists to `localStorage`.

## Scheduling & Notifications

```
App Start (hooks.server.ts)
  → startScheduler()
    → Scan tasks.json + backups.json for cron expressions
    → Register node-cron jobs
    → On trigger: run task/backup → on completion: notify via ntfy.sh
```

## Security Considerations

- **No public exposure** — all traffic over Tailscale VPN
- **Path traversal protection** — `safePath()` validates all file operations
- **Signal allowlist** — only TERM, KILL, HUP, INT, STOP, CONT, USR1, USR2
- **PID validation** — integer check before any process signal
- **CSRF** — `trustedOrigins` configured for Tailscale/LAN IPs
- **Terminal** — WebSocket sessions are local-only (no auth needed on tailnet)
