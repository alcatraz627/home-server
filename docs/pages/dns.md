# DNS Lookup

The DNS Lookup page resolves domain names to IP addresses and displays DNS record details. It is a browser-based alternative to `dig` or `nslookup`.

## How to Use

- **Enter** a domain name in the input field
- **Select** the record type to query (A, AAAA, MX, CNAME, TXT, NS, SOA, etc.)
- **Run** the lookup to see resolved records with TTL and value
- **View** multiple record types for the same domain
- **Copy** results to clipboard for sharing

## Data Flow

1. `src/routes/dns/+page.svelte` renders the lookup form and results
2. Client-side fetches hit `src/routes/api/dns/+server.ts` with the domain and record type
3. The server performs the DNS query using Node.js `dns` module or system resolver
4. Results are returned as structured JSON with record type, value, and TTL

## Keyboard Shortcuts

- **Enter** — Run the DNS lookup

## Tips

- MX records show mail server priorities; lower numbers have higher priority
- TXT records often contain SPF, DKIM, and domain verification entries
- SOA records show the authoritative nameserver and zone serial number
- Results reflect the server's DNS resolver; they may differ from your local machine
