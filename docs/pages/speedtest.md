# Speed Test

The Speed Test page measures your server's internet bandwidth by running download and upload speed tests. It provides a quick way to verify network performance.

## How to Use

- **Start** a speed test by clicking the run button
- **View** results showing download speed, upload speed, and latency (ping)
- **History** of previous test results is displayed for comparison
- **Re-run** tests at any time to check for changes

## Data Flow

1. `src/routes/speedtest/+page.svelte` renders the test UI and results
2. Client-side fetches hit `src/routes/api/speedtest/+server.ts` to initiate a test
3. The server runs a bandwidth test (using speedtest-cli or similar)
4. Results are returned with download/upload Mbps and ping in milliseconds

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Speed tests measure the server's connection, not your browser's local connection
- Results may vary depending on server load and time of day
- Run multiple tests for a more accurate average
- If testing through Tailscale, results reflect the VPN tunnel speed
- The test may take 15-30 seconds to complete depending on connection speed
