# Services — Health Monitoring

## Overview

Monitor the health of HTTP endpoints on your network — internal services, databases, APIs, or any URL. Get real-time status with uptime history and response time tracking.

## How to Use

- **Add a service:** Click "Add Service", enter name + URL + check interval + timeout
- **Status indicators:** Green = UP, Red = DOWN, Gray = Unknown/Unchecked
- **Response time:** Shown per service with color coding (fast/slow)
- **Uptime bar:** Last 24h uptime as a visual percentage bar
- **Auto-refresh:** Status refreshes every 30 seconds

## Data Flow

```
Page → GET /api/services → services.ts → HTTP check → services.json
     → POST /api/services → add/remove/check → services-history.json
```

## Configuration

Services are stored in `~/.home-server/services.json`. Check history in `~/.home-server/services-history.json` (last 100 checks per service, auto-pruned).

## Tips

- Use Tailscale IPs for internal services (e.g., `http://100.x.y.z:8080/health`)
- Set longer timeouts for slow services (30s for databases)
- The service checker runs via node-cron — services are monitored even when the page isn't open
