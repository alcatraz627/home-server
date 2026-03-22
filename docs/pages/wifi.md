# WiFi Scanner

The WiFi Scanner page discovers and displays nearby wireless networks. It provides detailed information about each network including signal strength, channel, encryption, and BSSID.

## How to Use

- **Scan** to discover nearby WiFi networks
- **View** network details: SSID, BSSID, signal strength (dBm), channel, frequency, and encryption type
- **Sort** by signal strength, name, or channel
- **Refresh** to update the scan results
- **Filter** networks by name or other attributes

## Data Flow

1. `src/routes/wifi/+page.svelte` renders the network list and scan controls
2. Client-side fetches hit `src/routes/api/wifi/+server.ts` to trigger a scan
3. `src/lib/server/wifi.ts` runs system WiFi scanning commands (iwlist, nmcli, etc.)
4. Parsed results are returned as structured JSON

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- WiFi scanning typically requires root/sudo privileges on Linux
- Signal strength closer to 0 dBm is stronger (e.g., -30 is excellent, -80 is weak)
- Channels 1, 6, and 11 are non-overlapping on 2.4 GHz; use this to find less congested channels
- 5 GHz networks have shorter range but usually less interference
- Hidden networks appear with a blank SSID but still show BSSID and signal data
