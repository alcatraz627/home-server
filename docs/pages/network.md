# Network Tools

The Network Tools page is a comprehensive toolkit for network diagnostics. It combines ping, traceroute, whois, and other network utilities into a single interface.

## How to Use

- **Ping** a host to check connectivity and measure round-trip latency
- **Traceroute** to visualize the network path to a destination
- **Whois** lookup for domain registration and ownership details
- **HTTP check** to test if a URL is reachable and view response headers
- **Enter** a hostname or IP in the target field and select the desired tool

## Data Flow

1. `src/routes/network/+page.svelte` renders the multi-tool interface
2. Client-side fetches hit `src/routes/api/network/+server.ts` with the selected tool and target
3. `src/lib/server/network.ts` runs the corresponding system command (ping, traceroute, whois)
4. Output is streamed or returned as structured results

## Keyboard Shortcuts

- **Enter** — Run the selected network tool

## Tips

- Ping count is limited to avoid long-running requests; results show average latency
- Traceroute may take 10-30 seconds depending on hop count and timeouts
- Whois results vary by registrar; some fields may be redacted for privacy
- All tools run from the server's perspective, not your browser's local network
- Useful for diagnosing connectivity issues between the server and external services
