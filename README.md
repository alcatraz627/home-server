# Home Server

Personal device management platform running across devices connected via **Tailscale VPN**. Built with SvelteKit.

See [PROJECT.md](PROJECT.md) for the full vision, goals, and milestones.

## Getting Started

```sh
npm install
npm run dev
```

The dev server starts on port `5555` (configurable via `.env`).

## Accessing from Other Devices

The dashboard is accessible from any device on your Tailscale network.

### Prerequisites

- [Tailscale](https://tailscale.com/download) installed and signed in on both this machine and the client device (e.g., phone)
- Dev server running (`npm run dev`)

### Access URLs

| Method | URL | Notes |
|--------|-----|-------|
| Local | `http://localhost:5555` | Same machine |
| LAN | `http://<local-ip>:5555` | Same Wi-Fi network |
| Tailscale | `http://<tailscale-hostname>:5555` | Any device on your tailnet |

To find your Tailscale hostname and IP:

```sh
# macOS (Tailscale installed via App Store)
/Applications/Tailscale.app/Contents/MacOS/Tailscale status
```

### Custom Hostname

To use a shorter Tailscale hostname (e.g., `http://homeserver:5555`):

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale set --hostname=homeserver
```

### Configuration Notes

- **Vite `allowedHosts`** is set to `true` in `vite.config.ts` to allow access via Tailscale/LAN hostnames. Safe because the server is only reachable on private networks.
- **CSRF `trustedOrigins`** in `svelte.config.js` includes Tailscale and LAN IPs to allow form submissions and API calls from other devices.

## Building

```sh
npm run build
```

Production build uses `adapter-node`. Docker deployment config is in `Dockerfile` and `docker-compose.yml`.
