# DNS Path Trace

Trace the full DNS resolution path from root servers through TLD and authoritative nameservers.

## Features

- **Full trace visualization** — shows every hop from root → TLD → authoritative DNS
- **Expandable detail per hop** — answer, authority, and additional sections with TTL
- **Server identification** — reverse DNS lookup for each intermediate server
- **Multiple record types** — A, AAAA, MX, CNAME, TXT, NS
- **Raw output toggle** — view the raw `dig +trace` output
- **Run history** — clearable history of past traces stored in localStorage

## How It Works

Uses `dig +trace +all` under the hood, which performs iterative resolution starting from root servers. The output is parsed to extract each delegation step, showing the complete chain of DNS referrals.

## API

| Endpoint         | Method | Description                       |
| ---------------- | ------ | --------------------------------- |
| `/api/dns/trace` | POST   | Run a DNS trace for a domain/type |

### POST Body

```json
{
  "domain": "example.com",
  "type": "A"
}
```
