# Processes

The Processes page provides a real-time view of running system processes, similar to `top` or `htop`. You can sort, filter, and kill processes directly from the browser.

## How to Use

- **View** all running processes with PID, name, CPU%, memory%, and user columns
- **Sort** by any column header (click to toggle ascending/descending)
- **Filter** processes by typing in the search box to match by name or PID
- **Kill** a process by clicking its kill button (sends SIGTERM, confirm required)
- **Refresh** data manually or let it auto-update on an interval

## Data Flow

1. `src/routes/processes/+page.svelte` renders the process table
2. `src/routes/processes/+page.server.ts` gathers the initial process list
3. `src/routes/api/processes/+server.ts` handles list refresh and kill requests
4. `src/lib/server/processes.ts` wraps OS-level process inspection (ps/proc)

## Keyboard Shortcuts

No dedicated shortcuts. Use browser find (Ctrl+F / Cmd+F) for quick text search.

## Tips

- Killing system processes may require the server to run with elevated privileges
- CPU percentages are point-in-time snapshots; refresh for updated values
- High-CPU processes are highlighted with warning colors
- The process list supports click-to-expand for additional details on each process
