# Linux / Raspberry Pi Support Guide

This document catalogues every platform-specific code path in the project, tracks Linux compatibility status, and serves as the reference for maintaining cross-platform support.

> **Rule:** Every new feature or API endpoint that touches system commands must work on both macOS and Linux. See the [Cross-Platform Development Patterns](#cross-platform-development-patterns) section for how.

---

## Platform Architecture Overview

The project runs on Node.js/SvelteKit. Most platform-specific code lives in **server-side API routes** that shell out to system commands. The frontend is fully platform-agnostic.

```
┌─────────────────────────────────────────────────────┐
│  Browser (Svelte)          — platform-agnostic      │
├─────────────────────────────────────────────────────┤
│  SvelteKit server routes   — platform-specific here │
│  Vite plugins (terminal)   — node-pty (cross-plat)  │
├─────────────────────────────────────────────────────┤
│  System commands           — macOS vs Linux differ   │
└─────────────────────────────────────────────────────┘
```

---

## Feature Compatibility Matrix

| Feature | macOS | Linux/Pi | Notes |
|---------|:-----:|:--------:|-------|
| **Smart bulbs (Wiz)** | ✅ | ✅ | Pure UDP, fully cross-platform |
| **Terminal** | ✅ | ✅ | `node-pty` supports Linux ARM; uses `$SHELL` |
| **WiFi scanning** | ✅ | ✅ | Has `nmcli` fallback already coded |
| **Tailscale** | ✅ | ✅ | Platform check in `src/lib/server/tailscale.ts:25-26` |
| **Network tools** (ping, DNS, traceroute) | ✅ | ✅ | `tracepath` fallback; standard tools |
| **Process list** | ✅ | ✅ | Platform-aware in `src/lib/server/processes.ts` |
| **Swap / memory stats** | ✅ | ✅ | `free -b` fallback exists |
| **Disk I/O stats** | ✅ | ✅ | `/proc/diskstats` fallback exists |
| **Network throughput** | ✅ | ⚠️ | Hardcoded `en0` — needs dynamic interface detection |
| **Bluetooth discovery** | ✅ | ✅ | `bluetoothctl devices` + `bluetoothctl info` on Linux |
| **Bluetooth control** | ✅ | ✅ | `bluetoothctl connect/disconnect` on Linux |
| **USB devices** | ✅ | ✅ | `lsusb` parsing on Linux |
| **Audio devices** | ✅ | ❌ | Uses `system_profiler` — needs `aplay -l` / `pactl` |
| **Display info** | ✅ | ❌ | Uses `system_profiler` — needs `xrandr` |
| **Battery** | ✅ | ❌ | Uses `pmset` — needs `/sys/class/power_supply/` |
| **System info** | ✅ | ✅ | `lscpu`, `free -b`, `/etc/os-release` on Linux |
| **Screenshots** | ✅ | ⚠️ | `scrot` fallback exists but `osascript` fallback fails |
| **App launcher** | ✅ | ✅ | Parses `.desktop` files from `/usr/share/applications/` on Linux |

**Legend:** ✅ Works — ⚠️ Partial (has fallback, may need testing) — ❌ Not implemented

---

## Detailed Platform-Specific Code Inventory

### System Layout Data (`src/routes/+layout.server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 9 | `sysctl vm.swapusage` | `free -b` | ✅ Fallback exists (line 16) |
| 45 | `netstat -ib \| awk '/en0/'` | `/proc/net/dev` or `ip -s link` | ❌ Hardcoded `en0` |
| 63 | `iostat -d -c 2 -w 1` | `/proc/diskstats` | ✅ Fallback exists (line 77) |

### System API (`src/routes/api/system/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 10 | `sysctl vm.swapusage` | `free -b` | ✅ Fallback exists (line 17) |
| 49 | `netstat -ib \| awk '/en0/'` | `/proc/net/dev` | ❌ Hardcoded `en0` |

### Peripherals API (`src/routes/api/peripherals/+server.ts`)

Uses `const isMac = process.platform === 'darwin'` (line 5).

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 29 | `system_profiler SPAirPortDataType -json` | `nmcli dev wifi list` | ✅ Fallback (line 92) |
| 65 | `airport -s` (hardcoded path) | `nmcli dev wifi list` | ✅ Fallback exists |
| 119 | `system_profiler SPBluetoothDataType -json` | `bluetoothctl devices` + `bluetoothctl info <MAC>` | ✅ Implemented |
| 174 | `system_profiler SPUSBDataType -json` | `lsusb` | ✅ Implemented |
| 220 | `system_profiler SPAudioDataType -json` | `aplay -l` / `pactl list sinks` | ❌ Returns `[]` |
| 280 | `pmset -g batt` | `/sys/class/power_supply/BAT*/capacity` | ❌ Returns null |
| 295 | `system_profiler SPPowerDataType` | Not applicable on Pi without UPS HAT | ❌ N/A |
| 315 | `airport -I` (hardcoded path) | `nmcli -t -f active,ssid dev wifi` | ❌ Uses macOS path |
| 343 | `system_profiler SPDisplaysDataType -json` | `xrandr` or `/sys/class/drm/` | ❌ Returns `[]` |
| 390 | `networksetup -listallhardwareports` | `ip link show` | ❌ macOS-only |
| 462 | `sysctl -n machdep.cpu.brand_string` | `lscpu \| grep 'Model name'` | ✅ Implemented |
| 471 | `sysctl -n hw.ncpu` | `nproc` | ✅ Implemented |
| 478 | `system_profiler SPHardwareDataType -json` | `cat /proc/cpuinfo`, `free -b` | ✅ Implemented |
| 487 | `sw_vers -productVersion` | `cat /etc/os-release` | ✅ Implemented |
| 509 | `blueutil --connect/--disconnect` | `bluetoothctl connect/disconnect <MAC>` | ✅ Implemented |

### WiFi API (`src/routes/api/wifi/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 94 | `system_profiler SPAirPortDataType -json` | `nmcli -t -f ... dev wifi list` | ✅ Fallback (line 187) |
| 112 | `airport -s` (hardcoded framework path) | `nmcli` | ✅ Fallback exists |
| 124 | `ifconfig en0` | `ip addr show wlan0` | ⚠️ Hardcoded interface |
| 182 | `airport -I` (hardcoded framework path) | `nmcli` | ✅ Fallback exists |

### Network API (`src/routes/api/network/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 299 | `traceroute -m 20` | `tracepath` | ✅ Already handled |
| 354 | `netstat -ib` | `/proc/net/dev` | ✅ Fallback (line 372) |

### Packets API (`src/routes/api/packets/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 26 | `ifconfig -l` | `ip link show` | ⚠️ Has fallback, needs testing |

### Screenshots API (`src/routes/api/screenshots/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 77 | `screencapture -x -t png` | `scrot` or `import` (ImageMagick) | ⚠️ Fallback exists (line 99) |
| 83 | `osascript` (AppleScript) | N/A | ❌ Will error on Linux |

### Apps API (`src/routes/api/apps/+server.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 7 | `const APPLICATIONS_DIR = '/Applications'` | `/usr/share/applications/` (`.desktop` files) | ✅ Implemented |
| 53 | `open "${appPath}"` | `xdg-open` or direct Exec command | ✅ Implemented |

### Operator / Disk Info (`src/lib/server/operator.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 217 | `df -h / /Volumes/*` | `df -h` | ⚠️ `/Volumes/` doesn't exist on Linux |
| 225 | `mount` (macOS format parsing) | `df -T` or `/etc/mtab` | ⚠️ Parse format differs |
| 264 | Filters `/System/Volumes` | N/A (safe to leave) | ✅ No-op on Linux |

### Tailscale (`src/lib/server/tailscale.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 26 | `/Applications/Tailscale.app/Contents/MacOS/Tailscale` | `tailscale` | ✅ Already handled |

### Terminal (`src/lib/server/terminal.ts`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 18 | `process.env.SHELL \|\| '/bin/bash'` | Same | ✅ Cross-platform |

### Hardcoded References in UI (`src/routes/tasks/+page.svelte`)

| Line | macOS Code | Linux Equivalent | Status |
|------|-----------|-----------------|--------|
| 168 | `/Applications/Tailscale.app/.../Tailscale status` | `tailscale status` | ⚠️ Template example only |
| 1189 | `~/Library/Caches/pip` | `~/.cache/pip` | ⚠️ Template example only |

---

## Tech Debt Backlog

Items ordered by impact — highest first.

### P0 — Blocks basic functionality on Linux

1. **Hardcoded `en0` network interface** — `+layout.server.ts:45`, `api/system:49`
   - Navbar network throughput stats show nothing on Linux
   - Fix: Create a shared `getPrimaryInterface()` helper using `os.networkInterfaces()`

2. **Peripherals page partially works on Linux** — `api/peripherals/+server.ts`
   - ~~Bluetooth: needs `bluetoothctl devices` + `bluetoothctl info <MAC>`~~ ✅ Done
   - ~~USB: needs `lsusb` parsing~~ ✅ Done
   - ~~System info: needs `lscpu`, `/etc/os-release`, `free -b`~~ ✅ Done
   - Displays: needs `xrandr` parsing
   - Audio: needs `aplay -l` or `pactl list sinks`
   - Network interfaces: needs `ip link show`

3. ~~**App launcher scans `/Applications`** — `api/apps/+server.ts:7`~~ ✅ Done
   - Parses `.desktop` files from `/usr/share/applications/` + `~/.local/share/applications/`
   - Launches via Exec command or `xdg-open`

### P1 — Degraded experience on Linux

4. **WiFi interface hardcoded** — `api/wifi:124` uses `ifconfig en0`
   - Fix: Use dynamic interface detection (same helper as P0-1)

5. **Screenshots `osascript` fallback** — `api/screenshots:83`
   - Fix: Skip AppleScript branch on Linux, rely on `scrot` only

6. **Disk mount parsing** — `src/lib/server/operator.ts:225`
   - macOS `mount` output format differs from Linux
   - Fix: Use `df -T` on Linux for filesystem type info

### P2 — Nice to have

7. ~~**Bluetooth control via `bluetoothctl`** — connect/disconnect on Linux~~ ✅ Done
8. **Battery via `/sys/class/power_supply/`** — only relevant with UPS HAT on Pi
9. **Tasks page hardcoded paths** — `~/Library/Caches/pip` in template examples

### P3 — Not applicable on headless Pi

10. **Display info** — irrelevant without a display
11. **Screenshots** — irrelevant on headless setup

---

## Cross-Platform Development Patterns

### Pattern 1: Platform-gated command execution

```typescript
import os from 'node:os';

const platform = os.platform(); // 'darwin' | 'linux' | 'win32'

if (platform === 'darwin') {
  // macOS: system_profiler, sysctl, pmset, etc.
} else {
  // Linux: /proc/*, nmcli, bluetoothctl, lscpu, etc.
}
```

### Pattern 2: Dynamic network interface detection

```typescript
function getPrimaryInterface(): string {
  if (os.platform() === 'darwin') return 'en0';
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (name !== 'lo' && addrs?.some((a) => a.family === 'IPv4' && !a.internal)) {
      return name;
    }
  }
  return 'eth0';
}
```

### Pattern 3: Graceful degradation with try/catch

```typescript
function getBluetoothDevices(): BluetoothDevice[] {
  try {
    if (isMac) {
      return parseSystemProfiler(execSync('system_profiler SPBluetoothDataType -json', opts));
    } else {
      return parseBluetoothctl(execSync('bluetoothctl devices 2>/dev/null', opts));
    }
  } catch {
    return []; // Feature unavailable — don't crash
  }
}
```

### Pattern 4: Shared helper in `src/lib/server/`

For commands used in multiple routes (e.g., network interface, swap), create a shared helper in `src/lib/server/platform.ts` rather than duplicating platform checks.

---

## Raspberry Pi Setup Notes

### Prerequisites

```bash
# Build tools for node-pty native compilation
sudo apt install build-essential python3

# WiFi scanning
sudo apt install network-manager  # provides nmcli

# Bluetooth (if needed)
sudo apt install bluez             # provides bluetoothctl

# Screenshots (if display attached)
sudo apt install scrot

# USB info
sudo apt install usbutils          # provides lsusb
```

### Known Pi Limitations

- **No battery** unless UPS HAT attached — battery endpoints return null
- **No display** in headless mode — screenshot and display endpoints return empty
- **ARM compilation** — `node-pty` and any other native modules compile on first `npm install`
- **WiFi interface** is typically `wlan0`, not `en0`
- **Ethernet interface** is typically `eth0` or `enp*`, not `en0`

---

## Adding a New System Feature — Checklist

When adding any feature that shells out to system commands:

- [ ] Check `docs/linux-support.md` for existing patterns
- [ ] Implement both macOS and Linux code paths
- [ ] Use `os.platform()` or the shared `isMac` flag for branching
- [ ] Wrap in try/catch — return empty/null on failure, never crash
- [ ] Test the Linux path (or at minimum, verify the command exists)
- [ ] Update the compatibility matrix in this file
- [ ] Update the tech debt backlog if adding a macOS-only stub
