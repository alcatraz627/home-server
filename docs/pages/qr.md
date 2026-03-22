# QR Code

The QR Code page generates QR codes from arbitrary text or URLs. It is useful for quickly sharing links, WiFi credentials, or other data with mobile devices.

## How to Use

- **Enter** any text or URL in the input field
- **Generate** a QR code by clicking the generate button or pressing Enter
- **Download** the generated QR code as a PNG image
- **Copy** the QR code image to your clipboard
- **Resize** the QR code using the size controls

## Data Flow

1. `src/routes/qr/+page.svelte` handles all QR generation client-side
2. No server API is needed; QR encoding happens in the browser using a JavaScript library
3. The page is fully functional offline once loaded

## Keyboard Shortcuts

- **Enter** — Generate QR code from the current input

## Tips

- WiFi QR codes use the format: `WIFI:T:WPA;S:NetworkName;P:Password;;`
- Very long text produces denser QR codes that may be harder for cameras to scan
- The generated QR code is a standard PNG that can be printed or embedded in documents
- No data is sent to the server; everything stays in the browser
