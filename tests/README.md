# Home Server Test Suite

Backend API and integration tests using real system calls -- no mocks.

## Prerequisites

- Server running at `localhost:5555` (or set `TEST_URL`)
- `npx tsx` available (TypeScript execution via the project's dev dependencies)
- Node.js 20+ (for built-in `node:test` runner and global `fetch`)

## Quick Start

```bash
# Start the server first
npm run dev &

# Run basic smoke tests (fast, non-destructive)
./tests/run.sh

# Run ALL tests (smoke + CRUD + integration + platform)
./tests/run-all.sh
# or equivalently:
./tests/run.sh full
```

## Test Tiers

| Tier | Command | What it tests | Duration |
|------|---------|--------------|----------|
| **Basic** | `./tests/run.sh` | Read-only endpoints (system, processes, browse, tailscale, wifi, peripherals, apps, speedtest) | ~10s |
| **Full** | `./tests/run.sh full` | Everything: CRUD operations, benchmarks, DNS lookups, file upload/delete, streaming | ~60s |
| **API only** | `./tests/run.sh api` | All API endpoint tests | ~45s |
| **Integration** | `./tests/run.sh integration` | Terminal sessions, file streaming with Range headers, smart bulbs | ~30s |
| **Platform** | `./tests/run.sh platform` | OS-specific commands (macOS or Linux) | ~15s |

## Running Specific Tests

```bash
# Run a single test file directly
npx tsx tests/api/system.test.ts

# Run tests matching a module name
./tests/run.sh files        # File management tests
./tests/run.sh terminal     # Terminal session tests
./tests/run.sh dns          # DNS lookup tests
./tests/run.sh bookmarks    # Bookmark CRUD tests

# Test against a remote server (e.g., Raspberry Pi)
TEST_URL=http://rpi:5555 ./tests/run.sh

# Verbose output (shows cleanup actions)
TEST_VERBOSE=1 ./tests/run.sh full
```

## Test Coverage

### API Tests (`tests/api/`)

| File | Endpoint(s) | Tier | What it covers |
|------|-------------|------|----------------|
| `system.test.ts` | `GET /api/system` | Basic | CPU cores, memory, swap, uptime, network, process count |
| `processes.test.ts` | `GET /api/processes` | Basic | Process listing, sorting, field validation |
| `browse.test.ts` | `GET /api/browse` | Basic | Directory listing, home default, ~ expansion, dotfile hiding |
| `tailscale.test.ts` | `GET /api/tailscale` | Basic | Device listing, graceful handling when not installed |
| `wifi.test.ts` | `GET /api/wifi` | Basic | WiFi scan results, current connection |
| `peripherals.test.ts` | `GET /api/peripherals` | Basic | Peripheral discovery, repeated call stability |
| `apps.test.ts` | `GET /api/apps` | Basic | Application listing, alphabetical sort |
| `speedtest.test.ts` | `GET/POST /api/speedtest` | Basic | Ping, download blob, upload measurement, size cap |
| `files.test.ts` | `GET/POST/PATCH/DELETE /api/files` | CRUD | Upload, download, preview, rename, delete, directory creation |
| `tasks.test.ts` | `GET/POST/PUT/DELETE /api/tasks` | CRUD | Task creation, execution, output verification, scheduling |
| `backups.test.ts` | `GET/POST/PATCH/DELETE /api/backups` | CRUD | Config CRUD, rsync availability flag |
| `keeper.test.ts` | `GET/POST/PUT/DELETE /api/keeper` | CRUD | Feature request CRUD, Claude availability check |
| `bookmarks.test.ts` | `GET/POST /api/bookmarks` | CRUD | Create, update, delete, tag parsing, ordering |
| `kanban.test.ts` | `GET/POST /api/kanban` | CRUD | Card CRUD, column moves, due dates |
| `wol.test.ts` | `GET/POST /api/wol` | CRUD | Device CRUD, localhost ping, validation |
| `dns.test.ts` | `POST /api/dns` | CRUD | Multi-provider A/MX/NS/TXT/AAAA lookups, error handling |
| `clipboard.test.ts` | `GET/POST /api/clipboard` | CRUD | Entry CRUD, FIFO ordering, truncation, clear |
| `benchmarks.test.ts` | `GET/POST/DELETE /api/benchmarks` | CRUD | CPU/memory/disk benchmarks, history |
| `screenshots.test.ts` | `GET/POST /api/screenshots` | CRUD | Listing, image validation, delete handling |

### Integration Tests (`tests/integration/`)

| File | What it covers |
|------|----------------|
| `terminal.test.ts` | Terminal session listing via REST API |
| `file-stream.test.ts` | HTTP Range requests (206), partial content, path traversal blocking |
| `lights.test.ts` | Wiz bulb discovery (skips gracefully if no bulbs) |

### Platform Tests (`tests/platform/`)

| File | What it covers |
|------|----------------|
| `macos.test.ts` | macOS-specific: swap via sysctl, apps in /Applications, system_profiler |
| `linux.test.ts` | Linux-specific: swap via free, /proc browsing, nmcli WiFi |

## Architecture

- **No mocks** -- all tests hit a real running server
- **`node:test`** built-in test runner -- zero external test dependencies
- **`node:assert/strict`** for assertions
- **Cleanup after** -- CRUD tests create test data and clean up in `after()` hooks
- **Graceful skipping** -- hardware-dependent tests (bulbs, bluetooth) skip with a message
- **Platform-aware** -- platform tests auto-detect OS and skip irrelevant tests

## CI Integration

The test runner exits with code 0 on success, non-zero on failure count:

```bash
./tests/run.sh basic || exit 1
```
