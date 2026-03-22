# Security Audit & Hardening Guide

Last audited: 2026-03-22 | App version: 3.8.0

This document covers the security posture of the home-server project under its intended deployment model: **running on a Tailscale VPN, accessible only from authenticated Tailscale nodes, with no public internet exposure.**

---

## Deployment Model & Threat Assessment

### Intended setup

```
Internet ──X──  (no public ports)
                          ┌──────────────────────┐
Tailscale VPN ──────────► │  Home Server (0.0.0.0:5555)  │
  (authenticated nodes)   │  behind Tailscale ACL │
                          └──────────────────────┘
```

- Server binds to `0.0.0.0:5555` (`vite.config.ts:119`)
- No reverse proxy, no TLS termination (Tailscale provides WireGuard encryption)
- Access limited to devices on the user's Tailscale tailnet
- CSRF trusted origins: `tailscale:*`, `http://100.*:*`, `http://192.168.*:*`, `http://10.*:*` (`svelte.config.js:12`)

### Who can access?

| Actor | Access? | Risk |
|-------|---------|------|
| Public internet | No (no port forwarding, Tailscale only) | None |
| Tailscale node you own | Yes | Trusted — this is you |
| Shared Tailscale node (friend/family) | Yes, if on same tailnet | Medium — full access to everything |
| Compromised Tailscale device | Yes | High — attacker has full server access |
| Local network (same WiFi) | Yes, if not firewalled | Medium — depends on network trust |
| Malicious website (CSRF) | Partially blocked | Low — SvelteKit CSRF checks origin |

### Key assumption

**Tailscale IS the auth layer.** If you trust every device on your tailnet, and your tailnet is only your devices, the current setup is reasonable for a personal tool. The risks below matter if:

1. You share your tailnet with others
2. A device on your tailnet gets compromised
3. You ever expose the server to a wider network
4. You access it from untrusted local networks

---

## What's Fine (No Action Needed)

These are secure or acceptable under the Tailscale-only model:

### Network encryption
- Tailscale uses WireGuard — all traffic is encrypted end-to-end between nodes
- No need for TLS/HTTPS on top (Tailscale handles it)
- MagicDNS provides stable hostnames

### CSRF protection
- SvelteKit's built-in CSRF checks origin headers against trusted origins
- Configured to trust only Tailscale IPs (`100.*`) and private ranges
- POST/PUT/DELETE requests from foreign origins are rejected

### File path traversal protection
- `src/lib/server/files.ts` has `safePath()` function that validates resolved paths stay within `UPLOAD_DIR`
- `src/routes/api/files/stream/[...path]/+server.ts` checks `filePath.startsWith(resolvedBase)`
- Upload directory is configurable via `UPLOAD_DIR` env var (default: `./uploads`)

### Process signal validation
- `src/lib/server/processes.ts` validates PIDs (integer, positive) and signals against a whitelist (`TERM`, `KILL`, `HUP`, etc.)

### Smart bulb communication
- Wiz protocol uses UDP on the local network only — no external API calls, no credentials

### `.env` file
- Gitignored (`.gitignore` lines 16-19) — not committed to repo
- Contains `ANTHROPIC_API_KEY` — only risk is local file access (covered by Tailscale)

---

## Vulnerabilities by Severity

### CRITICAL — Would matter if auth is ever needed

#### V1: No authentication on any endpoint

**Impact:** Every API route is accessible without credentials.
**Files:** All routes in `src/routes/api/`, WebSocket in `vite.config.ts`
**Current mitigation:** Tailscale network-level auth
**Risk under current model:** LOW — Tailscale restricts who can connect

**When this becomes a problem:**
- Sharing the tailnet with others who shouldn't have full access
- Adding the server to a subnet router that exposes it to a broader network
- Running on a local network without Tailscale

**Recommendation:** If you ever need per-user access control, add a lightweight auth layer. Options:

| Approach | Complexity | Best for |
|----------|-----------|----------|
| Tailscale ACL tags | None (config only) | Restricting which tailnet nodes can reach the server |
| `tailscale whois` header check | Low | Identifying which Tailscale user is connecting |
| Simple shared password (cookie) | Low | Quick single-user gate |
| Tailscale Serve + Funnel auth | Medium | Exposing to internet safely |

#### V2: Terminal gives full shell access — no auth on WebSocket upgrade

**Impact:** Anyone who can reach the server gets a root-equivalent shell
**File:** `vite.config.ts:19-26` — WebSocket upgrade has zero auth checks
**File:** `src/lib/server/terminal.ts:32` — PTY inherits full `process.env`
**Current mitigation:** Tailscale network-level auth
**Risk under current model:** LOW (only you can connect) but HIGH blast radius

**Why this is the #1 risk:**
The terminal is the single most powerful feature — it's equivalent to SSH. If any other vulnerability allows reaching this endpoint, game over. Unlike other endpoints that return JSON, the terminal gives persistent interactive shell access.

**Recommendation (even for personal use):**
- Consider requiring a confirmation step (PIN, button press) before terminal sessions start
- Terminal session IDs use `Math.random()` (weak entropy) — switch to `crypto.randomUUID()` in `terminal.ts:25`
- Consider filtering env vars passed to PTY (strip `ANTHROPIC_API_KEY`, etc.)

#### V3: Task executor runs arbitrary shell commands

**Impact:** The tasks/operator system executes any shell command without restriction
**File:** `src/lib/server/operator.ts:150` — `spawn('sh', ['-c', config.command])`
**Current mitigation:** Tailscale; task configs are user-defined intentionally
**Risk under current model:** LOW — this is by design (you define your own tasks)

**Note:** This is a feature, not a bug — but be aware that the task API endpoint has no auth, so any tailnet node can create and run tasks.

---

### HIGH — Command injection vectors

These would be exploitable if an attacker can reach the API (e.g., via CSRF bypass, shared tailnet, or future network exposure).

#### V4: Network tools — user input in shell commands

Multiple `execSync` calls interpolate user input with only regex filtering:

| Endpoint | File:Line | Command | Input | Filtering |
|----------|-----------|---------|-------|-----------|
| traceroute | `api/network:301` | `` `traceroute -m 20 ${target}` `` | `body.target` | `replace(/[^a-zA-Z0-9.\-:]/g, '')` |
| whois | `api/network:333` | `` `whois ${target}` `` | `body.target` | Same regex |
| SSL cert | `api/network:408` | `` `openssl s_client -connect ${domain}:443` `` | `body.domain` | `replace(/[^a-zA-Z0-9.\-]/g, '')` |
| ping (WOL) | `src/lib/server/wol.ts:51` | `` `ping -c 1 -W 1 ${ip}` `` | function param | No validation |
| blueutil | `api/peripherals:524` | `` `blueutil ${flag} "${address}"` `` | `body.address` | No validation |

**Current mitigation:** The regex filtering blocks most shell metacharacters (`;`, `|`, `` ` ``, `$`, etc.), but the approach is a denylist (fragile) rather than an allowlist.

**Recommendation:** Switch to `spawn()` with array args instead of `execSync` with string interpolation:
```typescript
// BAD:  execSync(`traceroute -m 20 ${target}`)
// GOOD: spawnSync('traceroute', ['-m', '20', target])
```

#### V5: Unrestricted directory browsing

**File:** `src/routes/api/browse/+server.ts:14-54`
**Impact:** Can browse ANY directory on the filesystem — `/etc`, `/root`, `~/.ssh`, etc.
**Input:** `?path=/etc` query parameter, defaults to `os.homedir()`
**No path restriction** — only `path.resolve()` is applied

**Current mitigation:** Tailscale (only you can access)
**Risk under current model:** LOW — you're browsing your own machine
**Recommendation:** If sharing tailnet, restrict to a configurable allowlist of browsable roots.

#### V6: Packet capture — tcpdump filter injection

**File:** `src/routes/api/packets/+server.ts:137`
**Input:** `body.filter` split on whitespace and passed to `spawn('tcpdump', args)`
**Input:** `body.interface` — no validation at all (line 128)

Using `spawn` with arrays is safer than `execSync`, but the unvalidated `interface` name is concerning. Validate against `os.networkInterfaces()`.

#### V7: File search — find command injection

**File:** `src/routes/api/files/search/+server.ts:69`
**Input:** `?q=` query param passed to `find` via `execSync` after partial sanitization
**Issue:** Sanitization strips `; | \` ` etc. but allows `"` which could break the quoting

**Recommendation:** Use Node.js `fs.readdir` recursive search instead of shelling out to `find`.

---

### MEDIUM — Information disclosure

#### V8: Process environment variable exposure

**File:** `src/lib/server/processes.ts:93` — reads `/proc/{pid}/environ` on Linux
**Impact:** Can read env vars of any process (may contain secrets)
**Recommendation:** Strip or mask sensitive env var values (keys containing `KEY`, `SECRET`, `TOKEN`, `PASSWORD`)

#### V9: AI chat sends codebase context to Anthropic API

**File:** `src/routes/api/ai/chat/+server.ts`
**What's sent:** Project files (CLAUDE.md, package.json, route list) as system prompt context
**Risk:** Codebase structure and internal architecture shared with external API
**Mitigation:** Anthropic's API data retention policy; HTTPS encryption in transit
**Recommendation:** Acceptable for personal use. If concerned, limit the context sent.

#### V10: Anthropic API key accessible via unauthenticated endpoint

**File:** `src/routes/api/ai/chat/+server.ts:89`
**Risk:** Anyone on the tailnet can call `/api/ai/chat` and consume your API credits
**Recommendation:** Under Tailscale-only, this is fine (it's your devices). If sharing tailnet, rate-limit or gate this endpoint.

#### V11: Error messages leak filesystem paths

**File:** `src/routes/api/browse/+server.ts:52` — returns `e.message` which includes full paths
**Impact:** Helps enumerate filesystem structure (e.g., "EACCES: permission denied, open '/root/.ssh/config'" confirms the file exists)
**Recommendation:** Return generic error messages; log details server-side only.

---

### LOW — Acceptable risks for personal use

| # | Issue | File | Notes |
|---|-------|------|-------|
| V12 | Clipboard stored in-memory unencrypted | `api/clipboard/+server.ts` | Volatile — lost on restart |
| V13 | Screenshots stored on disk unencrypted | `api/screenshots/+server.ts` | In `~/.home-server/screenshots/` |
| V14 | Task output history may contain secrets | `src/lib/server/operator.ts` | In `~/.home-server/task-history.json` |
| V15 | Agent/keeper logs unencrypted | `src/lib/server/agent-runner.ts` | In `~/.home-server/keeper-logs/` |
| V16 | Backup configs reveal directory structure | `src/lib/server/backups.ts` | In `~/.home-server/backups.json` |
| V17 | Weak terminal session IDs | `src/lib/server/terminal.ts:25` | `Math.random()` — 8 chars base-36 |
| V18 | No rate limiting on any endpoint | All API routes | DoS possible from tailnet |
| V19 | No security headers (CSP, HSTS, X-Frame-Options) | `hooks.server.ts` | SvelteKit defaults only |

---

## Do You Need Authentication?

### For personal-only Tailscale use: **No, but with caveats**

Tailscale effectively acts as your auth layer:
- Only your authenticated devices can reach the server
- WireGuard encryption protects traffic
- Tailscale identity is verified via OAuth (Google, Microsoft, etc.)

**This is equivalent to SSH key auth** — if you trust your Tailscale identity provider and your devices, you're fine.

### When you DO need auth:

| Scenario | Need auth? | Recommended approach |
|----------|-----------|---------------------|
| Only your devices on Tailscale | No | Current setup is fine |
| Shared tailnet (family/roommates) | Yes, for terminal/tasks/files | Tailscale ACL tags + `whois` header |
| Exposed via Tailscale Funnel | Yes, full auth | OAuth or Tailscale built-in auth |
| Running on open local network | Yes, full auth | Session-based auth with login page |
| Public internet (never recommended) | Yes, everything | Full auth + rate limiting + WAF |

### Should specific modules require auth?

Even under Tailscale-only, these modules have outsized blast radius:

| Module | Risk level | Recommendation |
|--------|-----------|----------------|
| **Terminal** | Highest — full shell | Consider a PIN/confirmation gate |
| **Tasks** | High — arbitrary commands | Fine for personal use |
| **Files** | High — filesystem read/write | Fine within UPLOAD_DIR |
| **Browse** | High — any directory readable | Consider restricting to home dir |
| **Processes** | Medium — can kill processes | Fine for personal use |
| **Network tools** | Medium — recon capabilities | Fine for personal use |
| **Lights/WiFi/Peripherals** | Low — local devices | Fine |
| **AI Chat** | Low — uses API credits | Fine for personal use |

---

## Hardening Checklist

### Immediate (do now, even for personal use)

- [ ] **Tailscale ACLs:** Restrict which tailnet nodes can reach the server's port
  ```json
  // In Tailscale admin console → Access Controls
  { "action": "accept", "src": ["tag:home-admin"], "dst": ["tag:home-server:5555"] }
  ```
- [ ] **Rotate API key:** If the `.env` file was ever committed to git, rotate `ANTHROPIC_API_KEY`
- [ ] **Verify `.env` not in git history:** `git log --all --full-history -- .env` — if it was ever committed, the key is compromised even if now gitignored

### If sharing tailnet

- [ ] Add Tailscale `whois` header check in `hooks.server.ts` to identify users
- [ ] Gate terminal, tasks, and file browse behind user identity check
- [ ] Restrict directory browsing to `UPLOAD_DIR` and `os.homedir()`

### If ever exposing to wider network

- [ ] Add full session-based authentication (login page + cookies)
- [ ] Add rate limiting (especially on terminal, network tools, AI chat)
- [ ] Switch all `execSync` string interpolation to `spawn` with array args
- [ ] Add security headers in `hooks.server.ts`:
  ```typescript
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  ```
- [ ] Sanitize error messages (don't leak file paths)
- [ ] Use `crypto.randomUUID()` for terminal session IDs
- [ ] Filter environment variables passed to terminal PTY
- [ ] Validate `interface` parameter in packets API against `os.networkInterfaces()`

---

## Tech Debt: Security Items

| ID | Item | Priority | Effort |
|----|------|----------|--------|
| S1 | Replace `execSync` string interpolation with `spawn` array args in network tools | P1 | Medium |
| S2 | Validate/allowlist `interface` param in packets API | P1 | Low |
| S3 | Use `crypto.randomUUID()` for terminal session IDs | P2 | Low |
| S4 | Filter env vars passed to terminal PTY and agent runner | P2 | Low |
| S5 | Restrict `/api/browse` to configurable allowlist of directories | P2 | Low |
| S6 | Mask sensitive env vars in process detail endpoint | P2 | Low |
| S7 | Replace `find` shell-out in file search with Node.js `fs.readdir` | P2 | Medium |
| S8 | Add security response headers in `hooks.server.ts` | P3 | Low |
| S9 | Sanitize error messages to not leak file paths | P3 | Low |
| S10 | Add optional PIN gate for terminal WebSocket | P3 | Medium |
| S11 | Rate limiting on expensive endpoints | P3 | Medium |

---

## Summary

**Under your current Tailscale-only deployment, the app is reasonably secure.** Tailscale provides network-level authentication and WireGuard encryption, which covers the biggest gap (no app-level auth). The main risks are:

1. **Terminal is the crown jewel** — if anything bypasses Tailscale, the attacker gets a full shell. Consider a lightweight gate.
2. **Command injection patterns exist** but are only exploitable by someone already on your tailnet (who could just use the terminal anyway).
3. **Information disclosure** (env vars, directory browsing) is a non-issue when you're the only user.

The app is built as a **personal power tool**, not a multi-tenant service. That's fine — just be aware of the boundary, and don't cross it without adding auth first.
