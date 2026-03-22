# Lights

The Lights page controls smart home lighting connected to the server. It provides toggle switches, brightness sliders, and color controls for discovered smart bulbs and light groups.

## How to Use

- **Toggle** individual lights on/off with the switch next to each light name
- **Adjust brightness** using the slider control for each light
- **Change color** where supported by clicking the color swatch
- **Group controls** let you toggle entire rooms or zones at once
- **Refresh** the device list to discover newly added bulbs

## Data Flow

1. `src/routes/lights/+page.svelte` renders the control UI
2. `src/routes/lights/+page.server.ts` fetches current light states on load
3. `src/routes/api/lights/+server.ts` proxies commands to the smart home backend
4. `src/lib/server/lights.ts` communicates with the lighting bridge/API

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- If a light shows as unreachable, check that the device is powered and on the same network
- Group controls affect all lights in the group simultaneously
- Color temperature and RGB modes depend on the bulb's capabilities
- Changes are applied immediately; there is no save/apply step
