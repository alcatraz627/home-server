# Home Server Roadmap

## Completed Features

### T1 — Toast & Error Reporting

- [x] Toast dedupe with key-based replacement
- [x] API error toasts on all fetch calls
- [x] Server-side error detail in JSON responses

### T2 — New Pages

- [x] Documentation page (`/docs`)
- [x] UI Showcase page (`/showcase`)
- [x] Peripherals page (`/peripherals`)

### T3 — Terminal Improvements

- [x] Tab renaming (double-click)
- [x] Allow 0 tabs with empty state
- [x] Mouse middle-click kill

### T4 — Empty State Placeholders

- [x] EmptyState component across Terminal, Keeper, Tasks, Backups, Files

### T5 — Dashboard Enrichment

- [x] Activity timeline, top processes, two-column layout
- [x] Auto-refresh every 30s with smooth transitions

### T6 — System Monitor

- [x] Real-time SVG charts (CPU/MEM/Network/Load)
- [x] Area fills and grid lines

### T7 — Disk Info Fix

- [x] macOS APFS dedup fix

### T8 — Starring System

- [x] Universal `$lib/stars.ts` store
- [x] Star animation CSS
- [x] `.star-btn` shared class

### T9 — Global Theme & Font Control

- [x] Settings panel (slide-out from right)
- [x] Theme grid, accent color presets + custom hex
- [x] Font size (12/14/16px), body font, heading font
- [x] Border radius (sharp/rounded/pill)
- [x] High contrast toggle
- [x] Reset to defaults

### T10 — Mobile Experience

- [x] Improved drawer sidebar with smooth animation
- [x] 44px touch targets on coarse pointer devices
- [x] PWA manifest + service worker

### T11 — Desktop App Experience

- [x] `manifest.json` with `display: standalone`
- [x] `beforeinstallprompt` handler with install banner
- [x] Service worker with offline caching

### T12 — Tailscale Extended Device Info

- [x] IPv6, DNS name, version, last seen, created date
- [x] Key expiry with warning badges
- [x] Relay/address, traffic stats, exit node status
- [x] Advertised routes display

### T13 — Keeper Agent Integration

- [x] Status flow: draft → ready → running → halted → done
- [x] Agent execution engine (`agent-runner.ts`)
- [x] Live log streaming with polling
- [x] Resume & chat via stdin
- [x] ANSI color rendering in log viewer

### T14 — Multi-Computer Support

- [x] Device context store (`device-context.ts`)
- [x] Device selector dropdown in navbar
- [x] API base URL switching for remote devices

### T15 — Animations Plan

- [x] Card stagger entrance, page slide transitions
- [x] Pulse, spin, counter transition utilities
- [x] Skeleton variants (text, circle, card)
- [x] Hover lift, status pulse, tooltip animation
- [x] Slide down panel animation
- [x] `prefers-reduced-motion` support

### T16 — Cross-Device Backup

- [x] Dry-run preview (rsync -n) with file list
- [x] Preview panel in backup cards
- [x] Remote source already supported via backup type detection

### T19 — Media Server

- [x] HTTP range streaming endpoint
- [x] MediaPlayer component (video + audio)
- [x] File browser integration
- [x] VLC launch link
- [x] Playlist support

### T20 — Task/Template Page Overhaul

- [x] Template runner terminal
- [x] Template edit/delete
- [x] Form polish with section headers
- [x] Button and task card icons
- [x] Task pagination
- [x] Animated transitions

### T21 — New Fun Pages

- [x] QR Code Generator
- [x] Bookmark Manager
- [x] Kanban Board
- [x] Wake-on-LAN
- [x] DNS Lookup
- [x] Port Scanner
- [x] Speed Test
- [x] Clipboard Sync
- [x] Screenshot Gallery
- [x] System Benchmarks

### T22 — Security/Network Tools

- [x] WiFi Scanner
- [x] Packet Sniffer
- [x] Network Toolkit (traceroute, ping sweep, ARP, whois, bandwidth, SSL, HTTP headers)

### T23 — AI Chat Polish

- [x] Rename conversations (double-click)
- [x] Animated FAB with gradient shimmer
- [x] Rounded message bubbles with copy buttons
- [x] Typing indicator (bouncing dots)

### T24 — Navbar Enhancements

- [x] Muted stat colors with hover reveal
- [x] Device selector dropdown

### T25 — App-Wide Polish

- [x] Dashboard auto-refresh (30s interval)
- [x] Smart lights sessionStorage cache
- [x] Animation utilities in app.css

### T26 — Documentation Sprint

- [x] Roadmap document (`docs/roadmap.md`)
- [x] Auto-included in `/docs` page viewer

### D1 — Component Library

- [x] 7 new shared components: Button, Badge, Tabs, SearchInput, Loading, Collapsible, Icon
- [x] Tooltip and Modal components
- [x] Component specs and standardization plan in `docs/components/`
- [x] Showcase page updated to demo all components

### D2 — App Launcher

- [x] `/apps` page for macOS application management
- [x] Search, launch, and quit apps from the browser
- [x] API endpoint at `/api/apps`

### D3 — Theme Expansion

- [x] Expanded from 10 to 20 CSS themes
- [x] Added: One Dark, Gruvbox Dark/Light, Everforest, Rose Pine, Ayu Dark/Light, Material Dark, Kanagawa, Cyberpunk

### D4 — Terminal Overhaul

- [x] Tab renaming (double-click)
- [x] Middle-click close
- [x] Font size controls
- [x] Session persistence across navigation
- [x] Mobile Ctrl key support

### D5 — AI Chat Polish

- [x] Conversation rename (double-click)
- [x] Animated FAB with gradient shimmer
- [x] Rounded message bubbles with copy buttons
- [x] Typing indicator (bouncing dots)

### D6 — Navbar Enhancements

- [x] Collapsible groups with persistent state
- [x] Pinned favorites section
- [x] Muted stat colors with hover reveal
- [x] Device selector dropdown

### D7 — Task Page Overhaul

- [x] Template runner terminal
- [x] Template edit/delete
- [x] Task pagination with animated transitions
- [x] Button and task card icons
- [x] Cron output indicator

### D8 — Security/Network Tools

- [x] WiFi Scanner with signal bars and channel info
- [x] Packet Sniffer with tcpdump and configurable filters
- [x] Network Toolkit: traceroute, ping sweep, ARP, whois, bandwidth, SSL, HTTP headers

### D9 — Fun Pages (10 new pages)

- [x] QR Code Generator, Bookmark Manager, Kanban Board
- [x] Wake-on-LAN, DNS Lookup, Port Scanner
- [x] Speed Test, Clipboard Sync, Screenshot Gallery, System Benchmarks

### D10 — Documentation Sprint

- [x] Per-page usage guides for all 24 pages in `docs/pages/`
- [x] Component library specs in `docs/components/`
- [x] Roadmap, architecture, API reference, setup guide, extending guide
- [x] Auto-included in `/docs` page viewer

---

### v4.0-v4.2 — Infrastructure & Homelab

- [x] Test suite: 25 test files with tiered runner (basic/full/module)
- [x] Logging: JSON Lines with rotation, /logs viewer page, all modules instrumented
- [x] Security: sanitizePath, sanitizeShellArg, validateRequired
- [x] Linux support: bluetoothctl, lsusb, lscpu, .desktop files
- [x] Service Health Dashboard (/services)
- [x] Notification Center (/notifications)
- [x] Docker Management (/docker)
- [x] lucide-svelte icon migration
- [x] Dashboard 2D CSS Grid with S/M/L sizing
- [x] Lights config server sync
- [x] 25 themes, custom color/font overrides
- [x] Multi-machine deployment strategy (Mac + Raspberry Pi)
- [x] /api/audit health checker endpoint
- [x] fetchApi wrapper for multi-device proxying
- [x] Toast behavior: errors persist, info 2s

### v4.3 — Keyboard, Components, & Bug Fixes

- [x] Keyboard accessibility: `/` focus sidebar, `Cmd+K` command palette, Notion-style hints
- [x] Keeper keyboard navigation: j/k/arrows, Enter expand, e/r/d/n shortcuts
- [x] Component consolidation phase 2: Card, Toolbar, PageHeader, DataChip, InteractiveChip, InfoRow, MiniChart, Tab slide animation + compact mode
- [x] Smart lights name persistence fix (MAC-based reconciliation)
- [x] WiFi scanner: extended info (SNR, noise, PHY, band, width, vendor OUI), inline diagnostics (ping, DNS, traceroute, internet)
- [x] System monitor: more data (FDs, TCP connections, context switches), MiniChart component
- [x] Apps: kill/force-kill with confirmation, process details (CPU/MEM/PIDs/files/version), macOS .icns icon extraction + cache
- [x] Kanban board: descriptions, assignees, P1/P2/P3 priority, archive column, drag animation with insertion indicator
- [x] macOS memory fix: vm_stat for accurate available memory
- [x] Process count fix: multi-fallback command chain
- [x] Error boundary: hooks.client.ts + +error.svelte + POST /api/logs
- [x] Notification badge wired to navbar header
- [x] fetchApi adoption: all 27 pages migrated from raw fetch
- [x] Terminal scrollback fix: clear + resize + reflow on reconnect

### v4.4 — New Pages & Infrastructure

- [x] DNS Path Trace page (`/dns-trace`) — full `dig +trace` with visual hop chain, expandable detail per server
- [x] Port scanner overhaul — sort/search/filter table, "All (1-65535)" SSE streaming mode, 60+ service names
- [x] Health API (`/api/health`) — green/yellow/red ping indicator in navbar, auto-refresh 15s
- [x] Manage Devices modal — pre-select from Tailscale devices with online/offline indicators
- [x] Tasks page — sort by name/status/lastRun, filter by status, hide/show toggle per task
- [x] Security hardening: cross-platform network interface helper, crypto.randomUUID (11 files), PTY env filtering, security headers, interface validation

### v4.5 — Polish & New Features

- [x] Apps launch bug fix (sanitizeShellArg stripped `/` from paths)
- [x] Apps page UI — uniform card size, hover shadow, improved grid
- [x] Screenshots — download, rename (double-click), device/platform metadata storage
- [x] Speed test external mode — Cloudflare download/upload via curl, mode selector
- [x] Reusable history utility (`$lib/history.ts`), added to DNS trace and port scanner
- [x] Databases & Services page (`/databases`) — PostgreSQL, Redis, MongoDB, PM2 management
- [x] Log file preview — inline viewer modal with raw content, download button
- [x] Dashboard zoom responsive — `min()` grid tracks, single-column at 400px
- [x] Theme expansion — 17 color overrides (Brand/Text/Surface groups), 6 body fonts, 6 heading fonts
- [x] Files page — system browse mode for arbitrary file paths (`/`, `~`)

## Release Summary

| Version | Highlights                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| v3.1    | Starring system, global theme/font control (10 themes), mobile PWA                                             |
| v3.2    | Tailscale extended info, Keeper agent integration, multi-computer support                                      |
| v3.3    | Animations plan, cross-device backup preview, media server                                                     |
| v3.4    | Task page overhaul, 10 new fun pages (QR, bookmarks, kanban, etc.)                                             |
| v3.5    | Security/network tools (WiFi, packets, network toolkit), AI chat polish                                        |
| v3.6    | Component library (17 components), app launcher, 20 themes, documentation sprint                               |
| v4.0    | Test suite, toast behavior, 25 themes, font/color customization                                                |
| v4.1    | Logging (all modules), security hardening, Linux support, lucide-svelte                                        |
| v4.2    | Service health, notifications, Docker, fetchApi, /api/audit                                                    |
| v4.3    | Command palette, 7 new components, keyboard nav, WiFi diagnostics, app icons, kanban enhancements, 6 bug fixes |
| v4.4    | DNS trace page, port scanner SSE streaming, health API, Tailscale device picker, tasks filter/hide, security hardening |
| v4.5    | Databases page, screenshots metadata, speed test external mode, log preview, theme expansion, files system browse |

## Architecture Notes

- **Stack:** SvelteKit 2 + Svelte 5 (runes), adapter-node, Node v23
- **Persistence:** JSON files in `~/.home-server/` — no database
- **Themes:** 25 CSS custom property themes with custom color overrides
- **Components:** 24 reusable Svelte components (14 shared primitives + 10 feature)
- **Icons:** lucide-svelte with 80+ icon mappings
- **Logging:** JSON Lines to `~/.home-server/logs/` with rotation + /logs viewer
- **Security:** Input sanitization (path traversal, shell injection, body validation)
- **Testing:** 25 test files, tiered runner, no mocks
- **Styling:** Prettier with svelte plugin, 2-space indent
- **VPN:** Tailscale for multi-device access
- **Notifications:** ntfy.sh + in-app notification center
- **Deployment:** Mac (hub) + Raspberry Pi (node) via Tailscale, systemd + Docker
