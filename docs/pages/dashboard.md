# Dashboard

The Dashboard is the landing page of Home Server. It provides a real-time overview of system health, resource usage, and quick-access widgets for navigating to other pages. Data auto-refreshes every 30 seconds.

## How to Use

- **System stats cards** show CPU load, memory usage, disk capacity, and uptime at a glance
- **Quick-access widgets** at the bottom link to frequently used pages (Files, Lights, Processes, etc.)
- Stat colors shift from green to yellow to red as resource usage climbs
- CPU display mode (load average vs. percent) is configurable in the header gear icon

## Data Flow

1. `src/routes/+page.svelte` renders the dashboard UI
2. `src/routes/+page.server.ts` calls system modules to gather stats on load
3. `src/routes/api/system/+server.ts` exposes a JSON endpoint for live refresh
4. Client-side timer fetches fresh data every 30 seconds without a full page reload

## Keyboard Shortcuts

No dedicated shortcuts. Use the sidebar or browser navigation.

## Tips

- The dashboard auto-refreshes; no need to manually reload
- Header stats (MEM, CPU, uptime) are visible on every page, not just the dashboard
- Refresh interval can be changed in the header stats gear menu (2s, 5s, 10s, 30s, or off)
- On mobile, system stats are hidden to save space -- use the dashboard page instead
