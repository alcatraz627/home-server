# Wake-on-LAN

The Wake-on-LAN page lets you remotely power on devices on your local network by sending magic packets to their MAC addresses.

## How to Use

- **Add** a device by entering its MAC address and a friendly name
- **Send** a wake packet by clicking the wake button next to any saved device
- **Remove** devices you no longer need from the list
- **View** status indicators showing whether the device responded after waking

## Data Flow

1. `src/routes/wol/+page.svelte` renders the device list and wake controls
2. `src/routes/wol/+page.server.ts` loads saved device configurations
3. `src/routes/api/wol/+server.ts` constructs and sends the magic packet
4. The magic packet is broadcast on the local network (UDP port 9)

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- The target device must have Wake-on-LAN enabled in its BIOS/UEFI settings
- The device must be connected via Ethernet (WiFi WoL support is rare)
- MAC addresses are in the format `AA:BB:CC:DD:EE:FF`
- WoL only works on the same broadcast domain (local network or VLAN)
- Some devices take 10-30 seconds to boot after receiving the magic packet
