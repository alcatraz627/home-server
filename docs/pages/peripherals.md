# Peripherals

The Peripherals page scans and displays WiFi and Bluetooth devices connected to or visible from the server. It provides network interface information and device discovery.

## How to Use

- **View** detected WiFi networks with signal strength, channel, and encryption info
- **View** discovered Bluetooth devices with name, MAC address, and type
- **Refresh** scans to update the device lists
- **Check** network interface status and IP assignments

## Data Flow

1. `src/routes/peripherals/+page.svelte` renders the device lists
2. Client-side fetches hit `src/routes/api/peripherals/+server.ts`
3. `src/lib/server/peripherals.ts` runs system commands (iwlist, bluetoothctl, etc.)
4. Results are parsed and returned as structured JSON

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- WiFi scanning may require root/sudo privileges depending on the OS
- Bluetooth discovery requires a Bluetooth adapter on the server
- Signal strength is shown in dBm; closer to 0 means stronger signal
- Scan results are point-in-time snapshots; refresh for updated data
