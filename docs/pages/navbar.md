# Navbar / Sidebar

The sidebar navigation provides grouped, collapsible access to all Home Server pages. It supports pinned favorites, group expand/collapse, and persistent state across sessions.

## How to Use

- **Navigate** by clicking any link in the sidebar to go to that page
- **Pin** frequently used pages by hovering over a link and clicking the star icon
- **Unpin** pages by clicking the star again (in the Pinned section or inline)
- **Collapse** groups by clicking the group header; click again to expand
- **Pinned section** appears at the top when you have starred items
- **Mobile** — tap the hamburger menu to open/close the sidebar

## Groups

The sidebar organizes pages into five groups:

- **Core** — Dashboard, Files, Processes, Terminal
- **Smart Home** — Lights, Peripherals
- **Network** — Tailscale, WiFi Scanner, Packets, Network Tools, Wake-on-LAN, DNS, Ports
- **Tools** — Tasks, Backups, Keeper, Bookmarks, Kanban, QR Code, Speed Test, Clipboard, Screenshots, Benchmarks
- **Info** — Docs, Showcase

## Data Flow

1. Navigation groups are defined in `src/lib/constants/nav.ts`
2. The sidebar is rendered in `src/routes/+layout.svelte`
3. Expanded/collapsed group state is stored in `localStorage` under `hs:nav-groups`
4. Pinned items are stored in `localStorage` under `hs:nav-pinned`

## Keyboard Shortcuts

No dedicated sidebar shortcuts. Use browser Tab/Enter for keyboard navigation.

## Tips

- Group collapse state persists across page loads and browser sessions
- Pinned items provide quick access to your most-used pages without scrolling
- The active page is highlighted with an accent border in the sidebar
- On mobile (under 640px), the sidebar slides in from the left as an overlay
- The app version number is shown at the bottom of the sidebar
