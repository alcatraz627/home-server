# Port Scanner

The Port Scanner page scans a target host for open TCP ports. It is useful for checking which services are running on a machine or verifying firewall rules.

## How to Use

- **Enter** a target hostname or IP address
- **Specify** a port range (e.g., 1-1024, 80, or 22,80,443)
- **Start** the scan to probe each port for open/closed status
- **View** results in a table showing port number, status, and common service name
- **Stop** a running scan if needed

## Data Flow

1. `src/routes/ports/+page.svelte` renders the scan form and results table
2. Client-side fetches hit `src/routes/api/ports/+server.ts` with target and port range
3. The server attempts TCP connections to each port with a configurable timeout
4. Results are streamed or returned as a batch with open/closed status per port

## Keyboard Shortcuts

- **Enter** — Start the port scan

## Tips

- Scanning large port ranges (e.g., 1-65535) can take several minutes
- Common ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (dev servers), 5432 (PostgreSQL)
- Scanning remote hosts may be blocked by firewalls or considered intrusive
- Only scan hosts you own or have permission to scan
- The scanner identifies well-known service names for common ports
