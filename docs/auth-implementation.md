# Authentication Implementation Guide

This document specifies how to add device-level authentication (biometric + PIN fallback) to the home-server project. Written as a complete implementation reference for an agent or developer.

---

## Table of Contents

1. [Design Goals](#design-goals)
2. [Architecture Overview](#architecture-overview)
3. [Dependencies](#dependencies)
4. [File Plan](#file-plan)
5. [Storage Layer](#storage-layer)
6. [Auth Middleware](#auth-middleware)
7. [PIN/Password Auth](#pinpassword-auth)
8. [WebAuthn Biometric Auth](#webauthn-biometric-auth)
9. [Login Page UI](#login-page-ui)
10. [WebSocket Auth](#websocket-auth)
11. [Session Management](#session-management)
12. [First-Time Setup Flow](#first-time-setup-flow)
13. [API Endpoint Specifications](#api-endpoint-specifications)
14. [Caveats & Edge Cases](#caveats--edge-cases)
15. [Testing Checklist](#testing-checklist)
16. [Options & Alternatives](#options--alternatives)

---

## Design Goals

- **Single-user system** — no user accounts, no roles. One person owns the server.
- **Device-level credentials** — fingerprint/Face ID via WebAuthn on capable devices, PIN/password on everything else.
- **Long sessions** — 30-day session cookies. Re-authenticate when expired.
- **No external dependencies** — no database, no OAuth provider, no internet required for auth.
- **Protect everything** — all routes behind auth except the login page and static assets.
- **WebSocket coverage** — terminal WebSocket upgrades must check auth too.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                              │
│  /login (unprotected)                                        │
│    ├── WebAuthn path: navigator.credentials.get()            │
│    │     → fingerprint / Face ID / Windows Hello             │
│    └── PIN path: form submission                             │
│                                                              │
│  On success → Set-Cookie: hs_session=<token>                 │
│  Redirect → / (or original destination)                      │
└──────────────────────┬───────────────────────────────────────┘
                       │  Cookie: hs_session=<token>
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Server                                                      │
│                                                              │
│  hooks.server.ts (runs on every request)                     │
│    ├── /login, /api/auth/*, static → pass through            │
│    ├── Valid session cookie → set event.locals.authed = true  │
│    └── Invalid/missing → redirect /login (pages) or 401 (API)│
│                                                              │
│  vite.config.ts (WebSocket upgrade)                          │
│    ├── Parse hs_session from request.headers.cookie          │
│    └── Invalid → socket.destroy()                            │
│                                                              │
│  ~/.home-server/auth.json (flat file storage)                │
│    ├── pinHash (argon2)                                      │
│    ├── webauthnCredentials[]                                 │
│    └── sessions[]                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Required

```bash
npm install @simplewebauthn/server @simplewebauthn/browser
```

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@simplewebauthn/server` | ^13.x | Server-side WebAuthn registration/verification | Pure JS, no native modules |
| `@simplewebauthn/browser` | ^13.x | Client-side WebAuthn API wrapper | Used in login page |

### PIN Hashing — Choose One

**Option A: Node.js built-in `crypto.scrypt` (recommended)**
- No extra dependency
- `crypto.scrypt(pin, salt, 64)` produces a 64-byte derived key
- Store as `salt:hash` in hex
- Sufficient for a single-user PIN

**Option B: `argon2` package**
- `npm install argon2` — native C module, needs compilation on ARM/Pi
- Stronger algorithm, but adds a native dependency
- May complicate Raspberry Pi deployment (`node-pty` is already one native dep)

**Option C: `bcrypt` package**
- `npm install bcrypt` — also native
- Well-known but older; argon2 is preferred for new projects

**Recommendation:** Use `crypto.scrypt` (Option A) to avoid adding native dependencies. For a single-user home server PIN, it's more than sufficient.

### Types

```bash
npm install -D @simplewebauthn/types
```

---

## File Plan

### New files to create

```
src/lib/server/auth.ts                              — Storage layer, session validation, PIN hashing
src/routes/login/+page.svelte                       — Login page UI
src/routes/login/+page.server.ts                    — Login page server load (check if setup needed)
src/routes/api/auth/status/+server.ts               — GET: auth state (setup complete? session valid?)
src/routes/api/auth/setup/+server.ts                — POST: initial PIN setup
src/routes/api/auth/pin/verify/+server.ts           — POST: login with PIN
src/routes/api/auth/logout/+server.ts               — POST: clear session
src/routes/api/auth/webauthn/register/+server.ts    — POST: registration options + verification
src/routes/api/auth/webauthn/login/+server.ts       — POST: login options + verification
src/routes/api/auth/webauthn/credentials/+server.ts — GET: list credentials, DELETE: remove one
```

### Files to modify

```
src/hooks.server.ts          — Add auth check middleware
vite.config.ts               — Add cookie auth check before WebSocket upgrade
src/routes/+layout.svelte    — Add logout button, credential management link
```

### No changes needed

All existing API routes (`src/routes/api/*`) are automatically protected by the hooks middleware — no per-route changes required.

---

## Storage Layer

### File: `src/lib/server/auth.ts`

Storage location: `~/.home-server/auth.json`

This follows the same pattern as other server modules (`backups.ts`, `operator.ts`) that store config in `~/.home-server/`.

### Data structure

```typescript
interface AuthStore {
  // PIN/password
  pin: {
    hash: string;      // crypto.scrypt output as hex
    salt: string;      // random 16-byte salt as hex
  } | null;

  // WebAuthn credentials (one per device)
  webauthn: {
    credentials: WebAuthnCredential[];
  };

  // Active sessions
  sessions: Session[];
}

interface WebAuthnCredential {
  id: string;               // base64url credential ID
  publicKey: string;        // base64url public key
  counter: number;          // signature counter (replay protection)
  deviceName: string;       // user-provided or auto-detected name
  transports?: string[];    // e.g., ['internal', 'hybrid']
  createdAt: string;        // ISO date
}

interface Session {
  token: string;            // crypto.randomUUID()
  deviceName: string;       // User-Agent derived
  createdAt: string;        // ISO date
  expiresAt: string;        // ISO date (createdAt + 30 days)
  lastUsedAt: string;       // ISO date, updated on each request
}
```

### Initial state (before setup)

```json
{
  "pin": null,
  "webauthn": { "credentials": [] },
  "sessions": []
}
```

### Functions to implement

```typescript
// File I/O
function loadAuth(): AuthStore
function saveAuth(store: AuthStore): void

// PIN
function hashPin(pin: string): { hash: string; salt: string }
function verifyPin(pin: string, stored: { hash: string; salt: string }): boolean
function isSetupComplete(): boolean  // returns true if pin.hash exists

// Sessions
function createSession(deviceName: string): Session  // generates token, sets 30-day expiry
function validateSession(token: string): Session | null  // checks expiry, returns session or null
function deleteSession(token: string): void
function cleanExpiredSessions(): void  // remove sessions past expiresAt

// WebAuthn
function addCredential(cred: WebAuthnCredential): void
function getCredentials(): WebAuthnCredential[]
function removeCredential(id: string): void
function updateCredentialCounter(id: string, newCounter: number): void
```

### Implementation notes

- Use `crypto.scrypt` for PIN hashing:
  ```typescript
  import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
  import { promisify } from 'node:util';
  const scryptAsync = promisify(scrypt);

  async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
    const salt = randomBytes(16).toString('hex');
    const buf = await scryptAsync(pin, salt, 64) as Buffer;
    return { hash: buf.toString('hex'), salt };
  }

  async function verifyPin(pin: string, stored: { hash: string; salt: string }): Promise<boolean> {
    const buf = await scryptAsync(pin, stored.salt, 64) as Buffer;
    return timingSafeEqual(buf, Buffer.from(stored.hash, 'hex'));
  }
  ```
- Use `crypto.randomUUID()` for session tokens (not `Math.random()`)
- Use `timingSafeEqual` for PIN comparison (prevents timing attacks)
- Read/write `auth.json` with `fs.readFileSync`/`fs.writeFileSync` — same pattern as `backups.ts`
- Call `cleanExpiredSessions()` on every `loadAuth()` to auto-prune

---

## Auth Middleware

### File: `src/hooks.server.ts`

The handle function must check auth on every request. Insert the auth check **before** the existing logging/scheduler code.

### Logic

```
1. Extract pathname from event.url
2. Skip auth for allowed paths:
   - /login (and /login/*)
   - /api/auth/* (all auth endpoints)
   - Static assets: paths starting with /_app/, /favicon, *.css, *.js, *.ico, *.png, *.svg, *.woff2
   - /xterm.css (terminal stylesheet)
   - /manifest.json, /sw.js (PWA files)
3. Read session token from cookie: event.cookies.get('hs_session')
4. Validate session via auth.validateSession(token)
5. If valid:
   - Set event.locals.authed = true
   - Update session.lastUsedAt
   - Continue to resolve(event)
6. If invalid or missing:
   - For page requests (Accept: text/html): redirect(307, '/login?redirect=' + encodeURIComponent(pathname))
   - For API requests: return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
   - For non-GET requests to pages: return 401 (not redirect)
```

### App.Locals type

Update `src/app.d.ts`:

```typescript
declare global {
  namespace App {
    interface Locals {
      authed: boolean;
    }
  }
}
```

### Cookie settings

When setting the session cookie (in auth endpoints, not in hooks):

```typescript
cookies.set('hs_session', session.token, {
  path: '/',
  httpOnly: true,
  sameSite: 'strict',
  secure: false,       // Tailscale uses HTTP, not HTTPS
  maxAge: 60 * 60 * 24 * 30,  // 30 days
});
```

**Caveat:** `secure: false` is required because Tailscale accesses the server over HTTP (WireGuard encrypts at the tunnel level, not TLS). If you ever add a reverse proxy with TLS, change this to `true`.

**Caveat:** `sameSite: 'strict'` means the cookie won't be sent on cross-origin requests, which is correct since the CSRF trusted origins are already configured. However, if you navigate to the server from an external link (e.g., a bookmark manager), the first load won't include the cookie and will redirect to login. `sameSite: 'lax'` avoids this for GET requests while still protecting POST/PUT/DELETE.

**Recommendation:** Use `sameSite: 'lax'` for better UX.

---

## PIN/Password Auth

### Setup endpoint: `POST /api/auth/setup`

**Request:** `{ pin: string }`
**Validation:**
- PIN must be 4-128 characters (allow numeric PINs, passphrases, passwords)
- Must NOT already be set up (one-time operation; changing PIN is a separate endpoint)
**Response:** `{ ok: true }` + Set-Cookie (auto-login after setup)

### Verify endpoint: `POST /api/auth/pin/verify`

**Request:** `{ pin: string }`
**Validation:**
- Setup must be complete (pin hash exists)
- Rate limiting: after 5 failed attempts, add a 30-second delay before accepting more attempts (store `failedAttempts` and `lockoutUntil` in auth.json)
**Response success:** `{ ok: true }` + Set-Cookie
**Response failure:** `{ ok: false, error: 'Invalid PIN', remaining?: number }`

### Changing PIN (optional, can defer)

`POST /api/auth/pin/change` — requires valid session + current PIN:
**Request:** `{ currentPin: string, newPin: string }`

---

## WebAuthn Biometric Auth

### Relying Party configuration

```typescript
const rpName = 'Home Server';
const rpID = getRpId(request);  // Derive from request Host header
const origin = getOrigin(request);  // e.g., 'http://machine.tailnet:5555'
```

**CRITICAL CAVEAT — rpId and origin:**

WebAuthn binds credentials to a specific domain (rpId). This creates complications:

| Access method | rpId | Works? |
|---------------|------|--------|
| `http://machine.tail1234.ts.net:5555` | `machine.tail1234.ts.net` | Yes |
| `http://100.64.1.23:5555` | `100.64.1.23` | **No** — WebAuthn requires a domain, not an IP |
| `http://localhost:5173` | `localhost` | Yes (dev only) |
| `http://192.168.1.50:5555` | `192.168.1.50` | **No** — same IP restriction |

**This means:** WebAuthn only works when accessing via a hostname (Tailscale MagicDNS or local DNS). When accessing via raw IP, only PIN auth is available. The login page must detect this and hide the WebAuthn option.

**How to handle rpId:**
- **Option A (simple):** Hardcode rpId from an env var: `WEBAUTHN_RP_ID=machine.tail1234.ts.net`
- **Option B (flexible):** Derive from request Host header, but then credentials are hostname-specific — a credential registered on `machine.tail1234.ts.net` won't work on `home.local`
- **Option C (multi-rpId):** Store rpId per credential, attempt verification against the credential's rpId. @simplewebauthn supports this.

**Recommendation:** Option A for simplicity. Add `WEBAUTHN_RP_ID` to `.env.example`. When not set, disable WebAuthn and only offer PIN.

### Registration flow

**Step 1: Generate options**

`POST /api/auth/webauthn/register`

Request: `{ step: 'options', deviceName?: string }`

```typescript
import { generateRegistrationOptions } from '@simplewebauthn/server';

const options = await generateRegistrationOptions({
  rpName,
  rpID,
  userID: new TextEncoder().encode('home-server-owner'),  // fixed, single user
  userName: 'owner',
  userDisplayName: 'Home Server Owner',
  attestationType: 'none',  // don't need attestation for personal use
  excludeCredentials: existingCredentials.map(c => ({
    id: c.id,
    transports: c.transports,
  })),
  authenticatorSelection: {
    residentKey: 'preferred',        // allow passkeys
    userVerification: 'required',    // require biometric, not just presence
    authenticatorAttachment: 'platform',  // prefer built-in (fingerprint), not USB keys
  },
});
```

Store `options.challenge` temporarily (in memory or auth.json under a `pendingChallenge` field) for verification in step 2. Challenge must expire after 5 minutes.

Response: `{ options }` (the full options object, passed to `navigator.credentials.create()`)

**Step 2: Verify registration**

`POST /api/auth/webauthn/register`

Request: `{ step: 'verify', response: <attestation response from browser>, deviceName: string }`

```typescript
import { verifyRegistrationResponse } from '@simplewebauthn/server';

const verification = await verifyRegistrationResponse({
  response: body.response,
  expectedChallenge: storedChallenge,
  expectedOrigin: origin,
  expectedRPID: rpID,
});

if (verification.verified && verification.registrationInfo) {
  addCredential({
    id: verification.registrationInfo.credential.id,
    publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64url'),
    counter: verification.registrationInfo.credential.counter,
    transports: body.response.response.transports,
    deviceName: body.deviceName || 'Unknown device',
    createdAt: new Date().toISOString(),
  });
}
```

Response: `{ ok: true, credentialId: string }`

**Caveat:** Registration should require an active session (user must already be logged in via PIN). Don't allow unauthenticated credential registration.

### Login flow

**Step 1: Generate options**

`POST /api/auth/webauthn/login`

Request: `{ step: 'options' }`

```typescript
import { generateAuthenticationOptions } from '@simplewebauthn/server';

const options = await generateAuthenticationOptions({
  rpID,
  allowCredentials: getCredentials().map(c => ({
    id: c.id,
    transports: c.transports,
  })),
  userVerification: 'required',
});
```

Store challenge temporarily (same as registration).

Response: `{ options }`

**Step 2: Verify login**

`POST /api/auth/webauthn/login`

Request: `{ step: 'verify', response: <assertion response from browser> }`

```typescript
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

const credential = getCredentials().find(c => c.id === body.response.id);

const verification = await verifyAuthenticationResponse({
  response: body.response,
  expectedChallenge: storedChallenge,
  expectedOrigin: origin,
  expectedRPID: rpID,
  credential: {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey, 'base64url'),
    counter: credential.counter,
    transports: credential.transports,
  },
});

if (verification.verified) {
  updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
  const session = createSession(deriveDeviceName(request));
  // Set cookie
}
```

Response: `{ ok: true }` + Set-Cookie

### Credential management

`GET /api/auth/webauthn/credentials` — list all registered credentials (requires session)
Response: `{ credentials: [{ id, deviceName, createdAt }] }`

`DELETE /api/auth/webauthn/credentials` — remove a credential (requires session)
Request: `{ id: string }`

**Caveat:** Don't allow removing the last credential if PIN is not set. At least one auth method must always exist.

---

## Login Page UI

### File: `src/routes/login/+page.svelte`

### Layout

- Full-screen centered card, no sidebar/navbar (don't use `+layout.svelte` — use a separate layout group or check auth state in layout to hide chrome)
- App title + version at top
- Minimal, clean design matching existing theme system

### States

```
1. LOADING     — checking auth status on mount
2. SETUP       — first time: show "Set a PIN" form
3. LOGIN       — show biometric button (if available) + PIN form
4. ENROLLING   — after PIN login, offer "Add Fingerprint" (optional)
```

### Server load function

`src/routes/login/+page.server.ts`:

```typescript
export const load: PageServerLoad = async ({ cookies }) => {
  const isSetup = isSetupComplete();
  const token = cookies.get('hs_session');
  const hasSession = token ? !!validateSession(token) : false;

  // Already authenticated — redirect to home
  if (hasSession) {
    redirect(307, '/');
  }

  return {
    isSetup,
    hasWebAuthn: getCredentials().length > 0,
  };
};
```

### Client-side logic

```
onMount:
  if (data.isSetup && data.hasWebAuthn && isWebAuthnAvailable):
    Auto-trigger WebAuthn login (show fingerprint prompt immediately)
  else:
    Show PIN form

isWebAuthnAvailable:
  Check: window.PublicKeyCredential !== undefined
  Check: NOT accessing via raw IP (WebAuthn won't work)
  Check: data.hasWebAuthn (credentials registered for this rpId)
```

### PIN form

```svelte
<form on:submit={handlePinLogin}>
  <input type="password" inputmode="numeric" pattern="[0-9]*"
         placeholder="Enter PIN" bind:value={pin}
         autocomplete="current-password" />
  <button type="submit">Unlock</button>
</form>
```

**Caveat:** Use `inputmode="numeric"` for mobile number pad, but `type="password"` to hide input. Don't use `type="number"` — it adds spinner buttons and strips leading zeros.

**Caveat:** If the user chose a text passphrase instead of numeric PIN, `inputmode="numeric"` is wrong. Consider auto-detecting: if the first setup PIN was numeric, use numeric mode; otherwise use default. Or just always use default keyboard and let the user type.

### WebAuthn button

```svelte
{#if canUseWebAuthn}
  <button on:click={handleBiometricLogin}>
    🔒 Unlock with Fingerprint
  </button>
{/if}
```

Client-side WebAuthn call:
```typescript
import { startAuthentication } from '@simplewebauthn/browser';

async function handleBiometricLogin() {
  const optionsRes = await fetch('/api/auth/webauthn/login', {
    method: 'POST',
    body: JSON.stringify({ step: 'options' }),
  });
  const { options } = await optionsRes.json();

  const assertion = await startAuthentication({ optionsJSON: options });

  const verifyRes = await fetch('/api/auth/webauthn/login', {
    method: 'POST',
    body: JSON.stringify({ step: 'verify', response: assertion }),
  });

  if (verifyRes.ok) {
    window.location.href = redirectUrl || '/';
  }
}
```

### Post-login enrollment prompt

After a successful PIN login, if WebAuthn is available but no credential exists for this device:

```
"Add fingerprint unlock for faster access next time?"
[Set up] [Skip]
```

This calls the registration flow. It's optional — the user can always use PIN.

### Layout isolation

The login page should NOT render inside the main `+layout.svelte` (which has sidebar, navbar, etc.). Options:

**Option A: Layout group (recommended)**
```
src/routes/(app)/+layout.svelte      — move existing layout here
src/routes/(app)/+layout.server.ts   — move existing layout server here
src/routes/(app)/+page.svelte        — move dashboard here
src/routes/(auth)/login/+page.svelte — login page, minimal layout
src/routes/(auth)/+layout.svelte     — bare layout (just <slot/>)
```

**Option B: Conditional rendering in existing layout**
```svelte
{#if $page.url.pathname === '/login'}
  {@render children()}
{:else}
  <!-- full sidebar/navbar layout -->
{/if}
```

**Recommendation:** Option B is simpler and avoids restructuring the route tree. The login page is the only unprotected page, so a simple conditional is fine.

---

## WebSocket Auth

### File: `vite.config.ts`

The WebSocket upgrade handler must validate the session cookie before allowing the connection. WebSocket upgrade requests include cookies from the browser.

### Implementation

In the `server.httpServer.on('upgrade', ...)` handler, before `wss.handleUpgrade()`:

```typescript
server.httpServer!.on('upgrade', (request: any, socket: any, head: any) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname !== '/ws/terminal') return;

  // --- AUTH CHECK START ---
  const cookieHeader = request.headers.cookie || '';
  const sessionToken = cookieHeader
    .split('; ')
    .find((c: string) => c.startsWith('hs_session='))
    ?.split('=')[1];

  if (!sessionToken) {
    console.log('[terminal] WebSocket upgrade rejected: no session cookie');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Import validateSession from auth module
  const { validateSession } = await import('./src/lib/server/auth.ts');
  if (!validateSession(sessionToken)) {
    console.log('[terminal] WebSocket upgrade rejected: invalid session');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  // --- AUTH CHECK END ---

  wss.handleUpgrade(request, socket, head, (wsConn: any) => {
    // ... existing session creation code ...
  });
});
```

**Caveat:** The `vite.config.ts` runs in the Vite process, not the SvelteKit process. Dynamic imports of SvelteKit modules may not work directly. Options:

1. **Shared validation function:** Put the token validation logic (read auth.json, check session) in a standalone file that doesn't import SvelteKit modules. Import it from both `hooks.server.ts` and `vite.config.ts`.

2. **Token-only check in vite.config.ts:** Read `auth.json` directly with `fs.readFileSync` and check if the token exists in the sessions array. Simpler, no module sharing needed.

**Recommendation:** Option 2 — keep vite.config.ts self-contained. Duplicate the minimal validation logic (read JSON, find session, check expiry) rather than introducing shared module complexity.

**Caveat:** In production builds (adapter-node), the Vite plugin doesn't run. The WebSocket handler needs to be moved to a custom server entry point. See the [Production WebSocket](#production-websocket-caveat) section in Caveats.

---

## Session Management

### Token generation

```typescript
import { randomUUID } from 'node:crypto';

function createSession(deviceName: string): Session {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + 30);

  return {
    token: randomUUID(),
    deviceName,
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    lastUsedAt: now.toISOString(),
  };
}
```

### Device name detection

Derive from User-Agent header:

```typescript
function deriveDeviceName(request: Request): string {
  const ua = request.headers.get('user-agent') || 'Unknown';
  // Simple parsing — e.g., "Chrome Android", "Safari macOS", "Firefox Linux"
  if (ua.includes('Android')) return 'Chrome Android';
  if (ua.includes('iPhone')) return 'Safari iPhone';
  if (ua.includes('Mac')) return ua.includes('Chrome') ? 'Chrome macOS' : 'Safari macOS';
  if (ua.includes('Linux')) return 'Chrome Linux';
  if (ua.includes('Windows')) return 'Chrome Windows';
  return 'Unknown';
}
```

### Session cleanup

- On every `loadAuth()` call, filter out sessions where `expiresAt < now`
- Cap at a maximum of 20 active sessions (remove oldest by `lastUsedAt`)
- Update `lastUsedAt` on every successful validation (write-through to auth.json)

**Caveat:** Writing to auth.json on every request (to update `lastUsedAt`) is I/O heavy. Options:
1. Only update `lastUsedAt` if it's more than 1 hour stale
2. Keep sessions in memory and flush periodically
3. Accept the I/O — it's a personal server with low request volume

**Recommendation:** Option 1 — update `lastUsedAt` only if the stored value is >1 hour old.

### Logout

`POST /api/auth/logout`:
1. Read `hs_session` cookie
2. Call `deleteSession(token)`
3. Clear cookie: `cookies.delete('hs_session', { path: '/' })`
4. Return `{ ok: true }`

---

## First-Time Setup Flow

### Detection

`GET /api/auth/status` returns:

```json
{
  "isSetup": false,
  "hasSession": false,
  "hasWebAuthn": false,
  "webauthnAvailable": true
}
```

When `isSetup` is false, the login page shows the setup form instead of the login form.

### Setup steps

1. User navigates to any page → redirected to `/login`
2. Login page detects `isSetup: false` → shows "Set a PIN to secure your server"
3. User enters PIN (and confirms it) → `POST /api/auth/setup`
4. Server hashes PIN, creates session, sets cookie
5. User is redirected to home page
6. (Optional) Toast/banner: "Add fingerprint unlock?" → triggers WebAuthn registration

### Guard against re-setup

The setup endpoint must reject if a PIN already exists. To change the PIN, use a separate endpoint that requires the current PIN.

### No-auth initial state

Before setup is complete, the server must allow access to:
- `/login` page
- `POST /api/auth/setup`
- `GET /api/auth/status`
- Static assets

All other routes should redirect to `/login` with a message like "Set up your server first."

---

## API Endpoint Specifications

### `GET /api/auth/status`

**Auth required:** No
**Response:**
```json
{
  "isSetup": true,
  "hasSession": true,
  "hasWebAuthn": true,
  "credentialCount": 2
}
```

### `POST /api/auth/setup`

**Auth required:** No (but fails if already set up)
**Request:** `{ pin: string }`
**Validation:** PIN is 4-128 chars, setup not already complete
**Response:** `{ ok: true }` + Set-Cookie
**Error:** `{ ok: false, error: "Already set up" }` (409)

### `POST /api/auth/pin/verify`

**Auth required:** No
**Request:** `{ pin: string }`
**Validation:** Setup must be complete, rate limit check
**Response success:** `{ ok: true }` + Set-Cookie
**Response failure:** `{ ok: false, error: "Invalid PIN" }` (401)
**Rate limited:** `{ ok: false, error: "Too many attempts. Try again in 30s." }` (429)

### `POST /api/auth/logout`

**Auth required:** Yes (via cookie)
**Response:** `{ ok: true }` + clear cookie

### `POST /api/auth/webauthn/register`

**Auth required:** Yes (must be logged in to register a credential)
**Request (step 1):** `{ step: "options", deviceName: "My Phone" }`
**Response (step 1):** `{ options: <PublicKeyCredentialCreationOptions> }`

**Request (step 2):** `{ step: "verify", response: <RegistrationResponseJSON>, deviceName: "My Phone" }`
**Response (step 2):** `{ ok: true, credentialId: "base64url..." }`

### `POST /api/auth/webauthn/login`

**Auth required:** No
**Request (step 1):** `{ step: "options" }`
**Response (step 1):** `{ options: <PublicKeyCredentialRequestOptions> }`
**Response (step 1, no credentials):** `{ ok: false, error: "No credentials registered" }`

**Request (step 2):** `{ step: "verify", response: <AuthenticationResponseJSON> }`
**Response (step 2):** `{ ok: true }` + Set-Cookie

### `GET /api/auth/webauthn/credentials`

**Auth required:** Yes
**Response:** `{ credentials: [{ id, deviceName, createdAt }] }`

### `DELETE /api/auth/webauthn/credentials`

**Auth required:** Yes
**Request:** `{ id: "base64url..." }`
**Validation:** Can't remove last credential if PIN is also not set
**Response:** `{ ok: true }`

---

## Caveats & Edge Cases

### WebAuthn on raw IPs

WebAuthn requires a domain for `rpId`. If the user accesses the server via `http://100.64.1.23:5555`, the browser will refuse to use WebAuthn. The login page must detect this:

```typescript
const isIpAccess = /^\d+\.\d+\.\d+\.\d+/.test(window.location.hostname);
// If isIpAccess, hide WebAuthn button, show only PIN
```

### Multiple hostnames, multiple rpIds

If the user accesses via both `machine.tailnet.ts.net` and `home.local`, credentials registered on one won't work on the other. Options:
1. Pick one canonical hostname and always redirect to it
2. Store rpId per credential and try matching credentials for the current rpId
3. Only support one hostname (document this)

**Recommendation:** Option 3 for simplicity. Document that WebAuthn works on one hostname only.

### Production WebSocket caveat

In production (`adapter-node`), the Vite plugin that handles WebSocket upgrades doesn't run. The project likely has a custom server entry or relies on the Vite dev server. Audit how the terminal WebSocket works in production:

- If using `node build/index.js` directly, the WebSocket handler in `vite.config.ts` is dev-only
- Need a production equivalent — either a custom `server.js` entry or a SvelteKit hook-based approach
- The auth check must work in both environments

**Action:** Check if there's a production server entry point. If not, the terminal only works in dev mode and this is a separate issue.

### Cookie on first WebSocket connection

When the login page sets a cookie and then the terminal page opens a WebSocket, the cookie is automatically included by the browser. No extra client-side work needed. However:

- If the session expires mid-terminal-session, the terminal stays connected (WebSocket is already open)
- New WebSocket connections (new tabs, reconnects) will fail
- The terminal page should handle 401 on WebSocket upgrade gracefully (show "Session expired, please log in")

### Rate limiting without persistence

Failed PIN attempts and lockout state are stored in `auth.json`. If the server restarts, the lockout resets. This is acceptable for a personal server — an attacker would need tailnet access AND to brute-force the PIN, AND the server staying up continuously.

### Session cookie survives browser restart

`maxAge: 30 days` means the cookie persists across browser restarts. This is intentional — you don't want to re-authenticate every time you open Chrome. If the user wants to revoke access from a device, they use the logout endpoint or remove the session from auth.json.

### Service worker and offline

The existing PWA service worker (`sw.js`) may cache responses including redirects to `/login`. Ensure the service worker doesn't cache auth redirects:
- Auth API responses should include `Cache-Control: no-store`
- The service worker should not cache `/login` or `/api/auth/*`

### Race condition on auth.json writes

Multiple concurrent requests could read/write auth.json simultaneously (e.g., two requests updating `lastUsedAt`). For a single-user server this is extremely unlikely to cause problems, but to be safe:
- Keep an in-memory cache of auth state
- Write to disk asynchronously / debounced
- Or accept the tiny race window (worst case: a `lastUsedAt` update is lost)

---

## Testing Checklist

### Setup flow
- [ ] First visit redirects to /login with setup form
- [ ] Can set a numeric PIN (4 digits)
- [ ] Can set a text passphrase
- [ ] Setup auto-logs-in (sets cookie)
- [ ] Second setup attempt fails with 409
- [ ] After setup, all pages are accessible

### PIN login
- [ ] Correct PIN → sets cookie, redirects to /
- [ ] Wrong PIN → shows error, no cookie
- [ ] 5 wrong PINs → lockout message, 30s delay
- [ ] After lockout expires → can try again
- [ ] Empty PIN → validation error

### WebAuthn registration
- [ ] Only available when logged in (has session)
- [ ] Shows fingerprint/Face ID prompt
- [ ] After registration, credential appears in list
- [ ] Can register multiple devices
- [ ] Registration with same device updates (doesn't duplicate)

### WebAuthn login
- [ ] Auto-triggers on login page if credentials exist
- [ ] Fingerprint success → sets cookie, redirects
- [ ] User cancels prompt → falls back to PIN form
- [ ] Hidden when accessing via raw IP

### Session management
- [ ] Cookie persists across browser restart
- [ ] Expired session redirects to login
- [ ] Logout clears cookie and session
- [ ] Multiple devices can have concurrent sessions

### WebSocket auth
- [ ] Terminal works after login
- [ ] Terminal WebSocket rejected without cookie
- [ ] Terminal WebSocket rejected with expired cookie
- [ ] Terminal page shows meaningful error on auth failure

### Edge cases
- [ ] Direct API call without cookie → 401 JSON (not redirect)
- [ ] /login while already logged in → redirects to /
- [ ] Browser back button from login after auth → goes to page, not login
- [ ] PWA / service worker doesn't cache login redirects

---

## Options & Alternatives

### Alternative: Tailscale-native auth (no custom auth)

Instead of building auth, use Tailscale's identity headers:

```typescript
// In hooks.server.ts
const tailscaleUser = event.request.headers.get('Tailscale-User-Login');
const tailscaleNode = event.request.headers.get('Tailscale-User-Name');
```

This works when using `tailscale serve` (a reverse proxy built into Tailscale). It adds identity headers automatically.

**Pros:** Zero code, leverages existing Tailscale auth
**Cons:** Requires `tailscale serve` setup, doesn't work for direct access, no biometrics

### Alternative: Simple password only (no WebAuthn)

Skip WebAuthn entirely. Just a password/PIN field. Dramatically simpler:
- No `@simplewebauthn` dependencies
- No rpId complexity
- No credential management UI
- Works on every device and access method

**Recommended if:** You just want a gate and don't care about biometric convenience.

### Alternative: Time-based auto-lock

Instead of persistent sessions, auto-lock after N minutes of inactivity:

```typescript
// In hooks.server.ts
const session = validateSession(token);
if (session && minutesSince(session.lastUsedAt) > 30) {
  deleteSession(token);
  // Redirect to login
}
```

**Pros:** More secure for shared devices
**Cons:** Annoying on personal devices

### Alternative: Per-module auth levels

Different features require different auth:

```typescript
const PUBLIC_ROUTES = ['/api/lights', '/api/system']; // safe, no auth
const PIN_ROUTES = ['/api/files', '/api/backups'];     // need PIN
const BIOMETRIC_ROUTES = ['/ws/terminal', '/api/tasks']; // need biometric or PIN
```

**Pros:** Granular, allows shared tailnet with limited access
**Cons:** Complex, requires UI for access denied states, harder to maintain

### Option: Emergency bypass

A physical file-based bypass for when you forget your PIN:

```
# Create this file on the server filesystem to bypass auth:
touch ~/.home-server/.auth-bypass

# Server checks for this file and skips auth if present
# Remove after resetting PIN
```

**Recommendation:** Include this as a documented recovery mechanism. Check for the file in hooks.server.ts before the auth check.

---

## Implementation Order

Suggested build order for an implementing agent:

1. `src/lib/server/auth.ts` — storage layer, PIN hashing, session CRUD
2. `POST /api/auth/setup` + `POST /api/auth/pin/verify` — basic PIN auth
3. `src/hooks.server.ts` — middleware (with PIN auth working, everything is gated)
4. `src/routes/login/+page.svelte` — login UI (PIN only first)
5. Test: full PIN flow works end-to-end
6. `vite.config.ts` — WebSocket auth check
7. WebAuthn registration + login endpoints
8. Login page WebAuthn UI
9. Credential management endpoint + UI
10. Emergency bypass file check
