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

## Release Summary

| Version | Highlights |
|---------|-----------|
| v3.1 | Starring system, global theme/font control (10 themes), mobile PWA |
| v3.2 | Tailscale extended info, Keeper agent integration, multi-computer support |
| v3.3 | Animations plan, cross-device backup preview, media server |
| v3.4 | Task page overhaul, 10 new fun pages (QR, bookmarks, kanban, etc.) |
| v3.5 | Security/network tools (WiFi, packets, network toolkit), AI chat polish |
| v3.6 | Component library (17 components), app launcher, 20 themes, documentation sprint |

## Architecture Notes

- **Stack:** SvelteKit 2 + Svelte 5 (runes), adapter-node, Node v23
- **Persistence:** JSON files in `~/.home-server/` — no database
- **Themes:** 20 CSS custom property themes
- **Components:** 17 reusable Svelte components in `src/lib/components/`
- **Styling:** Prettier with svelte plugin, 2-space indent
- **VPN:** Tailscale for multi-device access
- **Notifications:** ntfy.sh integration
