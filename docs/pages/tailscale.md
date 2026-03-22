# Tailscale

The Tailscale page displays the status of your Tailscale VPN mesh network. It shows connected nodes, their IP addresses, connection status, and lets you manage the local Tailscale instance.

## How to Use

- **View** all nodes in your tailnet with hostname, Tailscale IP, and OS info
- **Check status** of each node: connected, idle, or offline
- **See your node** highlighted at the top with its current exit node and relay status
- **Refresh** the node list to get the latest network state

## Data Flow

1. `src/routes/tailscale/+page.svelte` renders the node list and status cards
2. `src/routes/tailscale/+page.server.ts` runs `tailscale status --json` on load
3. `src/routes/api/tailscale/+server.ts` provides a JSON endpoint for live refresh
4. `src/lib/server/tailscale.ts` wraps the Tailscale CLI commands

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Tailscale must be installed and running on the server for this page to work
- Nodes shown as "idle" are reachable but have no active connections
- The local node's Tailscale IP is useful for accessing services from other devices on your tailnet
- If the node list is empty, verify `tailscale status` works from the server terminal
