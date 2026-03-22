# Multi-Machine Deployment Strategy

Deploy Home Server across a Mac laptop (primary) and a Raspberry Pi (secondary), connected via Tailscale VPN.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tailscale VPN (tailnet)               │
│                                                         │
│  ┌────────────────────┐     ┌────────────────────────┐  │
│  │  MacBook (Hub)     │     │  Raspberry Pi (Node)   │  │
│  │                    │     │                        │  │
│  │  ● Full dashboard  │────▶│  ● Full dashboard      │  │
│  │  ● All features    │     │  ● Linux-supported     │  │
│  │  ● Device selector │     │    features only       │  │
│  │    proxies to Pi   │     │  ● Backup storage      │  │
│  │  ● Claude agent    │     │  ● Always-on cron      │  │
│  │                    │     │  ● File server          │  │
│  │  http://macbook    │     │  http://rpi             │  │
│  │  :5555             │     │  :5555                  │  │
│  └────────────────────┘     └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Each machine runs its own Home Server instance.** The Mac acts as the "hub" with the device selector in the navbar switching API calls between local and remote (Pi) endpoints.

---

## Pi Setup (One-Time)

### 1. Prerequisites

```bash
# On the Raspberry Pi (Raspberry Pi OS / Ubuntu)
sudo apt update && sudo apt install -y \
  curl git build-essential python3 \
  rsync nodejs npm

# Install Node 20+ (if apt gives old version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### 2. Clone & Install

```bash
git clone https://github.com/alcatraz627/home-server.git
cd home-server
npm install
```

> **Note:** `node-pty` requires build tools. On ARM64 Pi, if it fails:
>
> ```bash
> sudo apt install -y cmake
> npm rebuild node-pty
> ```

### 3. Configure

```bash
cp .env.example .env
# Edit .env:
#   PORT=5555
#   UPLOAD_DIR=/home/pi/.home-server/uploads
#   NTFY_TOPIC=home-server-pi  (optional)
```

### 4. Build & Run

```bash
# Option A: Direct Node (simple)
npm run build
node build/index.js

# Option B: Docker (recommended for production)
docker compose up -d --build

# Option C: systemd service (best for always-on)
# See "systemd Service" section below
```

---

## systemd Service (Pi)

Create `/etc/systemd/system/home-server.service`:

```ini
[Unit]
Description=Home Server Dashboard
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/home-server
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=5
Environment=PORT=5555
Environment=ORIGIN=http://rpi:5555
Environment=UPLOAD_DIR=/home/pi/.home-server/uploads
Environment=BODY_SIZE_LIMIT=Infinity

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable home-server
sudo systemctl start home-server
sudo systemctl status home-server
```

---

## Docker Deployment (Pi)

The existing Dockerfile uses `node:20-alpine` which supports ARM64. For Raspberry Pi:

```bash
# Build for ARM on the Pi itself
docker compose up -d --build

# Or cross-build on Mac and push
docker buildx build --platform linux/arm64 -t home-server:latest .
docker save home-server:latest | ssh pi@rpi 'docker load'
```

### Docker Compose for Pi

```yaml
services:
  dashboard:
    build: .
    ports:
      - '5555:3000'
    volumes:
      - /home/pi/.home-server:/data/uploads
      - /media/backup-drive:/mnt/backup # external backup drive
    environment:
      - PORT=3000
      - ORIGIN=http://rpi:5555
      - UPLOAD_DIR=/data/uploads
      - BODY_SIZE_LIMIT=Infinity
    restart: unless-stopped
```

---

## Connecting Mac ↔ Pi

### On the Mac (Hub)

1. Open Home Server at `http://macbook:5555`
2. Click the device selector dropdown in the navbar
3. Click "Manage Devices"
4. Add the Pi:
   - **Label:** Raspberry Pi
   - **Hostname:** rpi (or the Tailscale hostname)
   - **IP:** `100.x.y.z` (Tailscale IP from `tailscale status`)
   - **Port:** 5555

Now switching the device selector to "Raspberry Pi" routes all API calls to `http://100.x.y.z:5555/api/...`.

### Cross-Device Features

| Feature       |   Hub (Mac)   |  Node (Pi)   |        Cross-Device        |
| ------------- | :-----------: | :----------: | :------------------------: |
| File browsing |  Local files  |   Pi files   | Switch via device selector |
| Backups       |  Local rsync  |   Pi rsync   |  rsync over Tailscale SSH  |
| Processes     | Mac processes | Pi processes | Switch via device selector |
| Terminal      |   Mac shell   |   Pi shell   | Switch via device selector |
| Smart Lights  | Local network |  Pi network  |  Depends on bulb network   |
| Tasks/Cron    | Mac cron jobs | Pi cron jobs |  Independent per machine   |
| AI Chat       | Claude on Mac | Claude on Pi |   Needs Claude CLI on Pi   |

### Cross-Device Backups

```bash
# In the backup config on Mac, use Pi as source:
rsync -avz pi@100.x.y.z:/home/pi/documents/ /Volumes/Backup/pi-docs/

# Or from Pi, back up to an external drive:
rsync -avz /home/pi/documents/ /media/backup-drive/pi-docs/
```

---

## Pi-Specific Considerations

### What Works Out of the Box

- File management, upload/download
- Process monitoring
- Terminal (node-pty on ARM64)
- Task runner with cron
- Backups (rsync)
- Tailscale device listing
- WiFi scanning (nmcli)
- Network tools (ping, traceroute, DNS, whois)
- Smart bulbs (if on same network)
- QR code, bookmarks, kanban, clipboard sync, speed test, benchmarks

### What Needs Linux Equivalents (see linux-support.md)

| Feature       | macOS Tool        | Linux Equivalent            | Status               |
| ------------- | ----------------- | --------------------------- | -------------------- |
| Bluetooth     | `blueutil`        | `bluetoothctl`              | Needs implementation |
| USB devices   | `system_profiler` | `lsusb`                     | Needs implementation |
| Audio devices | `system_profiler` | `aplay -l` / `pactl`        | Needs implementation |
| Display info  | `system_profiler` | `xrandr`                    | Needs implementation |
| Battery       | `pmset`           | `/sys/class/power_supply/`  | Needs implementation |
| System info   | `sysctl`          | `lscpu` / `/etc/os-release` | Needs implementation |
| Screenshots   | `screencapture`   | `scrot`                     | Partial              |
| App launcher  | `/Applications`   | `.desktop` files            | Needs implementation |

### Performance on Pi

- **RAM:** 2GB minimum, 4GB recommended. Node.js + SvelteKit uses ~200-400MB
- **CPU:** Pi 4/5 handles the dashboard fine. Avoid heavy cron tasks (benchmarks, port scans) simultaneously
- **Storage:** Use an SSD via USB for better I/O. SD card works but slower
- **node-pty:** Works on ARM64. May need `cmake` installed for compilation

---

## Update Strategy

### Git Pull (Simple)

```bash
# On the Pi
cd ~/home-server
git pull
npm install
npm run build
sudo systemctl restart home-server
```

### Automated Updates (Advanced)

Create a cron job or use the Tasks page to schedule:

```bash
cd /home/pi/home-server && git pull && npm install && npm run build && sudo systemctl restart home-server
```

Or use a GitHub webhook + a small update script.

---

## Monitoring

- **Mac:** Dashboard shows local stats, can switch to Pi via device selector
- **Pi:** Dashboard shows Pi stats, accessible via `http://rpi:5555` from any tailnet device
- **Alerts:** Set `NTFY_TOPIC` on both machines. Subscribe on your phone to get alerts from both
- **Uptime:** systemd auto-restarts on crash. Check with `systemctl status home-server`

---

## Security Notes

- **Tailscale only:** Both instances should only be accessible via Tailscale, not exposed to the public internet
- **CSRF:** `svelte.config.js` has `trustedOrigins` — add the Pi's Tailscale IP
- **No auth:** Currently no user authentication. Tailscale ACLs are the access control layer
- **Terminal access:** The web terminal gives full shell access to whoever can reach the dashboard. Tailscale restricts this to your devices only
