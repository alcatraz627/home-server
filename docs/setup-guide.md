# Setup Guide

Complete walkthrough to get Home Server running from scratch.

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | 20+ (v23 works) | `node --version` |
| npm | 9+ | `npm --version` |
| Tailscale | Latest | `/Applications/Tailscale.app/Contents/MacOS/Tailscale status` |
| rsync | Any (pre-installed on macOS/Linux) | `which rsync` |

## Step 1: Clone & Install

```sh
git clone <repo-url> home-server
cd home-server
npm install --engine-strict=false
```

> The `--engine-strict=false` flag is needed if running Node v23 due to some dependencies declaring stricter engine requirements.

## Step 2: Configure Environment

```sh
cp .env.example .env
```

Edit `.env`:

```sh
# Dev server port (default: 5555)
PORT=5555

# Where uploaded files are stored
UPLOAD_DIR=./uploads

# Max upload size in bytes (default: 500MB)
MAX_FILE_SIZE=524288000

# Push notifications (optional — see Notifications section)
# NTFY_TOPIC=home-server-alerts
```

## Step 3: Start Development Server

```sh
npm run dev
```

The dashboard opens at `http://localhost:5555`. You should see the sidebar with all widgets.

## Step 4: Connect Your Phone

### Install Tailscale

- **iOS**: [App Store](https://apps.apple.com/app/tailscale/id1470499037)
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

Sign in with the same account as your laptop.

### Find Your Laptop's Tailscale Address

```sh
# macOS
/Applications/Tailscale.app/Contents/MacOS/Tailscale status
```

Output shows your hostname and IP:

```
100.88.194.107  your-macbook  you@email.com  macOS  -
```

### Access from Phone

Open your phone's browser and navigate to:

```
http://your-macbook:5555
```

Or use the IP directly: `http://100.88.194.107:5555`

### Custom Hostname (Optional)

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale set --hostname=homeserver
# Now accessible at http://homeserver:5555
```

## Step 5: Set Up Notifications (Optional)

Home Server uses [ntfy.sh](https://ntfy.sh/) for push notifications on task/backup completion.

### Subscribe on Your Phone

1. Install the ntfy app ([iOS](https://apps.apple.com/app/ntfy/id1625396347) / [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy))
2. Subscribe to your chosen topic (e.g., `home-server-alerts`)

### Enable in .env

```sh
NTFY_TOPIC=home-server-alerts
# For self-hosted ntfy:
# NTFY_SERVER=https://ntfy.your-domain.com
```

Restart the dev server. Task and backup notifications will now push to your phone.

## Step 6: Create Your First Backup (Optional)

1. Navigate to **Backups** in the sidebar
2. Click **New Backup**
3. Fill in:
   - **Name**: e.g., "Phone Photos"
   - **Source Path**: e.g., `/Volumes/phone/DCIM/` (mounted phone storage)
   - **Destination Path**: e.g., `/Volumes/ExternalDrive/backups/photos/`
   - **Schedule**: e.g., `0 2 * * *` (daily at 2am)
   - **Excludes**: e.g., `.thumbnails`
4. Click **Create**, then **Run Now** to test

## Step 7: Create Your First Task (Optional)

1. Navigate to **Tasks** in the sidebar
2. Click **New Task**
3. Fill in:
   - **Name**: e.g., "Disk Space Alert"
   - **Command**: e.g., `df -h / | awk 'NR==2 {print $5}'`
   - **Schedule**: e.g., `0 */6 * * *` (every 6 hours)
4. Click **Create**, then **Run** to test

## Production Deployment

### Build

```sh
npm run build
```

Output goes to `build/`. Run with:

```sh
PORT=5555 node build
```

### Docker

```sh
docker compose up --build -d
```

The `Dockerfile` uses a multi-stage build with `node:20-alpine`. The container exposes port 5555.

### Environment Variables for Production

```sh
ORIGIN=http://your-tailscale-hostname:5555
BODY_SIZE_LIMIT=Infinity
```

## Troubleshooting

### "Blocked request. This host is not allowed."

Vite is blocking requests from an unrecognized hostname. `allowedHosts: true` is already set in `vite.config.ts` — restart the dev server.

### Terminal page shows "Disconnected"

The WebSocket server needs the Vite dev server running. Ensure `npm run dev` is active. In production, you'll need a custom server entry that attaches the WebSocket handler.

### No Wiz bulbs found

Wiz bulbs must be on the same LAN subnet (not just the tailnet). UDP broadcast doesn't cross subnets. Check that your laptop and bulbs are on the same Wi-Fi network.

### File upload fails with large files

Increase `MAX_FILE_SIZE` in `.env`. For production, also set `BODY_SIZE_LIMIT=Infinity`.

### Tailscale shows only one device

Ensure Tailscale is installed, running, and signed in with the same account on all devices. Check the [Tailscale admin console](https://login.tailscale.com/admin/machines).
