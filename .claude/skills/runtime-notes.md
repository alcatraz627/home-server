# Skill Runtime Notes

Append-only log of skill run insights. Newest entries at top.

## session: T18 homelab features — services, notifications, docker — 2026-03-22

**Purpose:** Built three new homelab pages (Service Health Dashboard, Notification Center, Docker Management) with full API + server module + UI integration.

**Insights:**

1. The Icon.svelte component uses a flat `ICON_MAP` lookup — new icons (Bell, Activity, Box from lucide-svelte) must be imported AND mapped with a lowercase key string.
2. Service health checks use `fetch` with `AbortController` for timeout support — cleaner than spawning curl processes.
3. Notifications module uses dynamic `import()` in backups.ts/operator.ts/services.ts to avoid circular dependencies and allow graceful failure if the module isn't loaded yet.
4. The scheduler was extended with service health check cron jobs — interval seconds get converted to `*/N * * * *` cron expressions (minimum 1 minute granularity).
5. Docker page uses `docker ps -a --format json` for structured output — the `--format` flag returns one JSON object per line (not a JSON array), so output is split by newlines and parsed individually.
6. All three pages follow the established pattern: `+page.server.ts` for SSR load, `+page.svelte` with `$state`/`$derived` runes, and a separate `+server.ts` API for client-side mutations.

---

## session: fetchApi adoption + icon sweep — 2026-03-22

**Purpose:** Replaced raw `fetch('/api/...')` calls with `fetchApi()` wrapper across 8 page files, and replaced Unicode arrow symbols with `<Icon>` components in the layout.

**Insights:**

1. The dashboard (`src/routes/+page.svelte`) has no `/api/` fetch calls — only `/?_data=` SvelteKit data calls, so it required no changes for the fetchApi migration.
2. `replace_all` in the Edit tool is very effective for bulk replacements when the match string is unique enough (e.g., `await fetch('/api/tasks'` maps cleanly to `await fetchApi('/api/tasks'`).
3. The `files/+page.svelte` has a `previewUrl()` helper that returns an `/api/files/...` URL — easy to miss since the fetch call doesn't contain a literal `/api/` string.
4. Unicode arrows `↓`/`↑` in the layout's network stats bar are UI icons, not data content — they deserved `<Icon>` replacement. The `⚠` in tasks/+page.svelte template command strings are data content and should be left alone.
5. The `backups/+page.svelte` has a `/api/backups/preview` endpoint that differs from the main `/api/backups` pattern — separate grep needed to catch it.

---

## session: Configurable constants + decentralization docs — 2026-03-22

**Purpose:** Wrote `docs/configurable-constants.md` (60+ hardcoded values inventoried, settings schema, extraction plan) and `docs/decentralization.md` (multi-server architecture, migration plan for `fetchApi` adoption).

**Insights:**

1. The `fetchApi()` wrapper in `src/lib/api.ts` and the entire device-context system (`targetDevice`, `remoteDevices`, `getApiBase()`, navbar selector) are **fully implemented but have zero adoption** — all 80+ fetch calls in page components use raw `fetch('/api/...')` instead.
2. The `~/.home-server` config directory path is repeated in 5+ server files (logger, operator, backups, lights config, benchmarks, screenshots). A centralized `PATHS` object in `src/lib/server/paths.ts` would DRY this up.
3. Three localStorage keys don't follow the `hs:` prefix convention: `speedtest-history`, `dns-history`, `terminal_sessions` — inconsistency that should be fixed when extracting to `storage-keys.ts`.
4. Server-side data loading (15 `+page.server.ts` files) is the biggest blocker for multi-server — these always read from the local OS/filesystem. A dual-mode pattern (server-load for local, client-fetch for remote) is needed.
5. WebSocket connections don't need CORS (browsers allow cross-origin WS), but they won't carry cookies from the target origin — auth for remote terminals needs a query-param token or first-message auth instead.

---

## session: Add structured logging to all server modules — 2026-03-22

**Purpose:** Instrumented all 11 server-side modules and 3 API routes with the `createLogger` system for structured, file-based logging.

**Insights:**

1. The logger module at `$lib/server/logger.ts` uses relative imports internally, so server modules import via `./logger` while API routes use `$lib/server/logger`.
2. In `backups.ts`, the rsync stats parsing happened after the log call — reordered to ensure log entries contain correct `filesTransferred`/`bytesTransferred` values.
3. Replaced all `console.log`/`console.error` calls in `scheduler.ts` and `terminal.ts` with structured logger calls to unify output.
4. The `notify.ts` module uses `$env/dynamic/private` (SvelteKit env), so it already has a SvelteKit-style import path — logger import follows the same `./logger` relative pattern since it's in the same directory.

---

## session: Replace all ASCII/Unicode icons with Icon component — 2026-03-22

**Purpose:** Systematically replaced every Unicode/emoji icon across the SvelteKit project with the `<Icon>` component backed by lucide-svelte.

**Insights:**

1. The `EmptyState` component needed its `icon` prop changed from a Unicode character to a lucide icon name string, and the rendering updated to use `<Icon>`. Default changed from emoji to `'info'`.
2. Sort indicator functions (`sortIcon`/`sortIndicator`) that returned arrow strings needed to be refactored to return `'asc' | 'desc' | null` so the template could conditionally render `<Icon>` components instead of concatenating strings.
3. The `FileBrowser` component's `label` prop defaulted to `'📁'` emoji -- changed default to empty string with an `<Icon name="folder-open">` fallback in the template.
4. Navigation icons in `nav.ts` are now lucide icon name strings rendered via `<Icon name={item.icon} size={16} />` in `+layout.svelte`, replacing `{item.icon}` text rendering.
5. Unicode arrows in inline data labels (e.g., `1.2MB↓`, `→` flow diagrams) were intentionally left as-is since they're data formatting, not decorative icons.
6. Light preset icons (emoji like movie clapboard, moon, book) were mapped to closest lucide equivalents: `film`, `moon`, `eye`, `power`, `monitor`, `sun`.

---

## session: Security hardening + Linux support — 2026-03-22

**Purpose:** Added security sanitization module, hardened critical API endpoints against injection/traversal, and implemented Linux fallbacks for Bluetooth, USB, system info, and app launcher.

**Insights:**

1. The `files.ts` module already had a robust `safePath()` helper with `path.resolve()` + `startsWith()` — good pattern to reuse for the centralized `sanitizePath()` in security.ts.
2. The `network/+server.ts` POST handler already had regex sanitization on targets (e.g., `body.target?.replace(/[^a-zA-Z0-9.\-:]/g, '')`), but the underlying functions (`runTraceroute`, `runWhois`, `inspectSSLCert`) did not re-sanitize — defense-in-depth via `sanitizeShellArg()` at both layers is worthwhile.
3. The `packets/+server.ts` endpoint was the most dangerous — it passed raw `body.filter` directly to tcpdump spawn args, which could inject arbitrary tcpdump flags. The `interface` field was also unsanitized.
4. For Linux Bluetooth, `bluetoothctl info <MAC>` provides connected status, icon type, and battery percentage — a single call per device gives rich data comparable to macOS `system_profiler`.
5. Linux `.desktop` file parsing needs to handle `NoDisplay=true`, `Hidden=true`, and `Type!=Application` filters to avoid cluttering the app list with helper entries. The `%f/%u/%F/%U` placeholders in Exec fields must be stripped before launching.
6. MAC address validation regex (`/^[\dA-Fa-f]{2}([:-][\dA-Fa-f]{2}){5}$/`) is the critical security gate for the Bluetooth connect/disconnect endpoint — prevents shell injection via crafted "addresses".

---

## session: Auth implementation doc — 2026-03-22

**Purpose:** Wrote comprehensive `docs/auth-implementation.md` specifying device-level authentication (WebAuthn biometric + PIN fallback) for another agent to implement.

**Insights:**

1. WebAuthn requires a domain for `rpId` — won't work when accessing via raw IP (e.g., `100.64.x.x`). The login page must detect IP access and hide the biometric option, falling back to PIN only.
2. The Vite WebSocket handler in `vite.config.ts` bypasses SvelteKit's hooks entirely — auth must be manually checked by parsing cookies from `request.headers.cookie` before calling `wss.handleUpgrade()`.
3. In production builds (`adapter-node`), the Vite plugin doesn't run at all — the terminal WebSocket handler needs a separate production entry point. This is a pre-existing gap, not introduced by auth.
4. `crypto.scrypt` (Node built-in) is sufficient for PIN hashing on a single-user server and avoids adding native module dependencies (`argon2`/`bcrypt`) that complicate ARM/Pi deployment.
5. SvelteKit's `event.cookies` API handles HttpOnly/SameSite automatically, but `secure` must be `false` since Tailscale uses HTTP (WireGuard encrypts at tunnel level, not TLS).

---

## session: Security audit + docs/security.md — 2026-03-22

**Purpose:** Full security audit of the codebase — auth, command injection, data exposure, file access — written into `docs/security.md` with Tailscale deployment context.

**Insights:**

1. The app has zero authentication — Tailscale is the sole auth layer. This is acceptable for personal-only tailnets but becomes a problem immediately if the tailnet is shared or the server is exposed.
2. Terminal WebSocket (`vite.config.ts:19`) has no auth on upgrade — it's the highest-risk endpoint because it gives persistent interactive shell, unlike API endpoints that return one-off JSON.
3. Network tools use `execSync` with regex-filtered string interpolation (denylist approach) — safer than no filtering, but `spawn` with array args would eliminate the entire class of injection risk.
4. The `/api/browse` endpoint is completely unrestricted — can browse any directory on the filesystem. Path traversal protection exists only on the file upload/download routes, not on browse.
5. `svelte.config.js` CSRF config trusts `tailscale:*` and all private IP ranges — this is correct for the deployment model but means local network attackers can CSRF if the server is reachable without Tailscale.

---

## session: Lights config sync + apps running detection — 2026-03-22

**Purpose:** Moved lights config (bulb names, rooms, presets) from localStorage to server-synced JSON file, and added running app detection to the apps page.

**Insights:**

1. The project uses `~/.home-server/` for all persistent data files (kanban.json, bookmarks.json, etc.) — the lights config follows the same pattern at `lights-config.json`.
2. For lights config, keeping localStorage as a synchronous cache while the server is source of truth gives instant render on page load with eventual consistency from `fetchConfig()`.
3. The `cachedConfig` variable must be initialized before `$state` declarations that reference it, since `loadCachedConfig()` is a synchronous call that works during module init.
4. On macOS, `ps -eo comm` lists running process command paths; matching against `/Applications/*.app` reliably detects running GUI apps.
5. The apps API GET response changed from `AppInfo[]` to `{ apps: AppInfo[], running: string[] }` — the page server load still returns `{ apps }` for SSR, and client-side `fetchRunning()` gets the full shape.

---

## session: Rebuild dashboard as 2D CSS Grid with size-aware sections — 2026-03-22

**Purpose:** Replaced the vertical dashboard layout with a responsive 2D CSS Grid system, adding per-section size controls (S/M/L) and a settings modal.

**Insights:**

1. The `grid-column: span N` approach works well with `auto-fill` columns, but needs `!important` override at the mobile breakpoint to force `span 1` regardless of configured size.
2. Modal component uses `$bindable(open)` pattern -- bind directly with `bind:open` and use `{#snippet footer()}` for action buttons.
3. Separating modal drag state (`modalDraggedId`) from live grid drag state (`draggedId`) is essential to avoid cross-contamination when both drag contexts exist.
4. Pending layout pattern (clone on open, apply on confirm) prevents partial edits from leaking into the live dashboard.
5. Backfilling `size` for old localStorage layouts (missing the new field) is important for backward compatibility with existing users.

---

## session: Build comprehensive backend test suite — 2026-03-22

**Purpose:** Created 22 test files covering all API endpoints, integration scenarios, and platform-specific behavior using node:test with no external dependencies.

**Insights:**

1. The project already had `tests/helpers/api.ts`, `tests/helpers/cleanup.ts`, `tests/run.sh`, and `tests/README.md` scaffolded but no actual test files. The cleanup helpers had incorrect API method signatures (used DELETE where the API uses POST with `_action`).
2. Bookmarks, kanban, clipboard, and WoL use POST with `_action` field for delete/update/move instead of standard HTTP DELETE/PUT verbs. Tests must match this pattern.
3. Clipboard is in-memory only (no persistence file), so tests that clear it affect the running server's state. Other stores (bookmarks, kanban, wol) persist to `~/.home-server/*.json`.
4. The speedtest GET endpoint requires an `action` query param (`ping` or `download`) -- calling without it returns 400. Tests need to cover this edge case.
5. Benchmarks POST uses `_action: 'run'` with a `benchmark` field (`cpu`, `memory`, `disk`, `all`). The `all` variant returns 201 (saves to history) while individual ones return 200.
6. File streaming supports HTTP Range with proper 206/416 status codes. Path traversal is blocked by checking resolved path starts with upload dir.

---

## session: Linux support doc + CLAUDE.md cross-platform rule — 2026-03-22

**Purpose:** Created `docs/linux-support.md` with full platform-specific code inventory, compatibility matrix, tech debt backlog, and development patterns. Added cross-platform requirement to CLAUDE.md agent instructions.

**Insights:**

1. The peripherals API (`api/peripherals/+server.ts`) is the single largest platform-debt file — 12+ `system_profiler` calls with no Linux fallbacks, all returning `[]` gracefully.
2. The hardcoded `en0` network interface in `+layout.server.ts` and `api/system` is the highest-impact P0 issue — it silently breaks navbar network stats on Linux.
3. WiFi, network tools, swap, disk I/O, and tailscale already have working Linux fallbacks — ~70% of features work on Linux out of the box.
4. Smart bulbs (Wiz protocol) are fully cross-platform since they use `dgram` UDP, not system commands.

---

## session: arch-qa — manage devices navbar — 2026-03-22

**Purpose:** Traced the "Manage Devices" feature from navbar UI through device-context store to API layer.

**Insights:**

1. The device system is purely client-side — `localStorage` stores both the selected target (`hs:device-context`) and the device list (`hs:remote-devices`). No server-side persistence.
2. `fetchApi` wrapper in `src/lib/api.ts` exists but is not yet consumed by any page — pages still use raw `fetch()`. The device-targeting plumbing is in place but adoption is incomplete.
3. The modal, device selector dropdown, and all device state management live entirely in `+layout.svelte` and `device-context.ts` — only two files to understand the whole feature.
4. `removeDevice` has a safety check: if the removed device was the active target, it resets to `'local'`.

---

## session: Documentation refinement pass — 2026-03-22

**Purpose:** Comprehensive audit and update of all documentation files to match the current v3.6 codebase state.

**Insights:**

1. The README had stale counts everywhere: "31 API endpoints" (actual: 35 route files), "11 components" (actual: 17), "10 themes" in the App Infrastructure table (actual: 20), "25 pages" (actual: 26 with /apps).
2. Architecture.md module boundaries table only listed 7 domains but the codebase has 14+ including keeper, wol, bookmarks, kanban, network tools, peripherals, and apps.
3. The extending.md still referenced `+layout.svelte` for nav registration, but nav was moved to `src/lib/constants/nav.ts` — stale after the navbar overhaul.
4. The roadmap.md "Architecture Notes" section listed "10 themes" which was outdated since the v3.5 theme expansion to 20.
5. No docs/pages/ file exists for `/apps` (the app launcher page) — this is a gap that could be addressed in a future session.

---

## session: Media player enhancements + dashboard drag-and-drop layout — 2026-03-22

**Purpose:** Added playback speed dropdown, PiP, download button to MediaPlayer; replaced checkbox-based dashboard section visibility with full drag-and-drop reordering system.

**Insights:**

1. The Svelte autoformatter/autofixer modifies files between edits — `new Set<string>(...)` generic syntax inside `<script>` blocks can be stripped or rewritten by the linter chain. Using `as any` casts or explicit type annotations (`const x: Set<string> = ...`) is more robust in Svelte script blocks.
2. Dashboard drag-and-drop required splitting previously grouped sections (Tasks/Backups/Keeper were in one `status-grid`, Activity/Processes in one `detail-row`) into individually-draggable wrappers — each section gets its own `.dashboard-section` div with independent grid layout inside.
3. The `DASHBOARD_SECTIONS` const tuple needed a `quick-actions` entry added since it was previously just inline HTML outside any section system.
4. PiP API check via `document.pictureInPictureEnabled` must be done in an `$effect` (client-side only), not at module top level.
5. Speed dropdown uses a `.speed-overlay` fixed backdrop pattern (same as the gear config dropdown) to handle click-away dismissal without complex event delegation.

---

## session: Inline terminal + wildcard search on files page — 2026-03-22

**Purpose:** Added collapsible inline xterm.js terminal and wildcard file search to the files page.

**Insights:**

1. The files page is very large (~2200 lines) — reading it requires multiple offset/limit passes; plan for at least 5 reads to cover script + template + styles.
2. The terminal page (`/terminal`) uses dynamic imports for `@xterm/xterm` and `@xterm/addon-fit` — same pattern works for embedding terminals elsewhere; no SSR issues since guarded by `browser` check.
3. The WebSocket endpoint `/ws/terminal` accepts `cwd` as a query param — useful for setting the initial working directory of embedded terminals.
4. The existing search API at `/api/files/search/+server.ts` does recursive Node.js `readdir` — wildcard mode adds a parallel `find` code path with `execSync`, sanitizing the pattern to prevent injection.
5. Collapsible component uses `$bindable(open)` and `{@render children()}` snippets — for this use case a manual panel was simpler than wrapping Collapsible since the terminal needs precise height control and resize handles.

---

## session: Network toolkit, peripherals, AI chat improvements (D6/D7/D10) — 2026-03-22

**Purpose:** Added suggestion chips, collapsible docs, and guided UI to Network Toolkit; cross-tab search and extended device info to Peripherals; page context awareness to AI Chat.

**Insights:**

1. The peripherals API uses `system_profiler -json` which returns varied keys per macOS version -- fields like `device_batteryLevel`, `device_batteryLevelMain`, `spairport_network_noise`, `spairport_network_phymode` may or may not be present, so null-safety is essential.
2. USB `location_id` from system_profiler provides bus/port info; the controller `_name` gives the bus name. Both passed through `walkUSB` recursive function.
3. The `Collapsible` component uses `$bindable(open)` with default false, so no explicit `open={false}` needed when embedding doc sections.
4. The peripherals search works by filtering all data arrays and returning unified `SearchResult` objects. When search is active, the entire tab panel is replaced with cross-tab results.
5. AiChat `currentPage` prop flows layout -> component -> API -> system prompt, allowing Claude to give context-aware answers about whichever page the user is viewing.

---

## session: App launcher page + files page improvements — 2026-03-22

**Purpose:** Created the /apps page for launching macOS applications and improved the /files page with toolbar restructuring, view toggle, and path validation.

**Insights:**

1. Unicode escapes like `\u{1F4C1}` work in JS strings but NOT in Svelte template text — Svelte/prettier treats them as template literals and fails parsing. Use a helper function to return emoji from JS instead.
2. The global checkbox CSS in `app.css` already handles styling (appearance: none, custom checkmark). The scoped `.row-checkbox` was overriding width/height and setting `accent-color` which is irrelevant when appearance is none — removing it lets the global style work correctly.
3. `navigateTo` was setting `currentPath` before validating the path existed, which could leave the UI in an inconsistent state. Now it fetches first, then sets state only on success.
4. The `browser` guard from `$app/environment` is needed when reading `localStorage` in Svelte 5 state initializers to avoid SSR errors.

---

## session: Lights, navbar, and dashboard fixes (D1/D3/D4) — 2026-03-22

**Purpose:** Fixed drag-slider conflict on lights page, upgraded brightness control, added collapsible scenes, enhanced navbar system monitor stats, and added dashboard quick actions.

**Insights:**

1. The bulb card had `draggable="true"` on the entire card div, which hijacked all drag events from sliders/inputs inside. Moving `draggable` to only the drag handle and `.bulb-top` header area fixes the conflict cleanly.
2. The Collapsible component requires `open` as a prop (it's not optional despite having a default) — other files in the codebase (network page) also have this issue as pre-existing errors.
3. The layout server only exposed 1-minute load average; `os.loadavg()` returns [1m, 5m, 15m] so all three can be forwarded for the uptime tooltip.
4. `iostat` on macOS requires a 2-sample run (`-c 2 -w 1`) to get meaningful throughput data — the first sample is cumulative since boot, the second is the actual per-second rate.
5. The `netSpeedColor` function returned green for 0 bytes/sec — needed a special case for `=== 0` to show `var(--text-faint)` instead.
6. The dashboard config dropdown already had `right: 0` but was missing `left: auto` which can cause position issues in some layout contexts.

---

## session: Terminal page overhaul — 2026-03-22

**Purpose:** Overhauled the terminal page with 7 feature changes: no auto-start, exit detection, close-kills-session, header padding fix, paste error fix, session summary bar, and bottom status bar.

**Insights:**

1. The terminal WS handler lives in `vite.config.ts` as a Vite plugin (not in hooks.server.ts), so any PTY exit/session message changes must go there.
2. `node-pty`'s `term.onExit` provides `{ exitCode, signal }` — exposed it through `TerminalSession.onExit` callback for the WS layer to send `{ type: 'exit', code }` messages.
3. The terminal page uses `margin: -24px` to go full-bleed, so the page header needs its own explicit padding (24px desktop, 12px mobile) rather than relying on layout padding.
4. The `[Session restored]` paste detection issue was caused by writing to the terminal on `ws.onopen` even for brand-new sessions — fixed by only writing when `sessionParam` was actually set (restoring).
5. Badge component uses `children` snippet (Svelte 5 pattern) so content is passed as slot children, not a prop.

---

## session: Migrate remaining 9 pages to shared component library — 2026-03-22

**Purpose:** Replaced inline buttons, badges, tabs, search inputs, and loading skeletons with shared Button/Badge/Tabs/SearchInput/Loading components across all remaining pages.

**Insights:**

1. The `Button` component's `confirm` prop eliminates per-page confirm/delete state management (confirmDeleteId, deleteConfirm sets, confirmTimer). Removed ~50 lines of confirm-toggle boilerplate across files, backups, bookmarks, and processes pages.
2. The `Tabs` component expects a `tabs` array prop with `{id, label, count?}` shape. For peripherals, needed a `$derived` array since counts depend on reactive state. For network, the existing `tabs` const already matched the shape.
3. `Badge` with `dot` and `pulse` props works well as an online/offline indicator (tailscale), replacing inline `.dot` CSS with semantic markup.
4. The `SearchInput` component uses `oninput` callback (not bind:value for debouncing), but `bind:value` still works for immediate binding. Files page global search needed `oninput={() => handleSearchInput()}` wrapper.
5. When removing inline `.btn` CSS, must also remove `.btn:hover`, `.btn:disabled`, `.btn-sm`, `.btn.active` and variant classes — easy to miss the hover/disabled/active selectors scattered through the style block.
6. Prettier only reformatted 1 of 9 files, confirming the edits maintained proper formatting. All 9 pages pass svelte-check with 0 errors.

---

## session: Migrate 3 high-traffic pages to shared component library — 2026-03-22

**Purpose:** Replaced inline button/badge/search/collapsible patterns in tasks, keeper, and layout pages with shared Button, Badge, SearchInput, and Collapsible components.

**Insights:**

1. The tasks page template section used a CSS max-height transition wrapper for expand/collapse -- replaced with the Collapsible component which uses if-blocks and animation instead. Watch for visual regression if users expected the smooth height animation.
2. Keeper page had a custom confirm-delete pattern (confirmingDelete state + 3s timeout) that was replaced by Button's built-in `confirm` prop -- allowed removing ~15 lines of dead state/function code.
3. Badge component maps: running=warning (pulse), success=success, failed/timeout=danger, scheduled=accent, idle=default. Keeper status mapping: draft=default, ready=accent, running=success (with dot+pulse), halted=danger, done=success.
4. The `class` prop on Button allows passing through custom CSS classes (used for terminal-close styling), which is important when shared components need page-specific overrides.
5. SearchInput has a bindable `value` prop -- no need for separate oninput handlers, just `bind:value` works directly with existing reactive state.

---

## session: Component library audit + standardization — 2026-03-22

**Purpose:** Audited 18 UI patterns across 37 Svelte files, wrote 7 component specs, built 7 shared components, and started migrating 12 pages.

**Insights:**

1. 88 distinct button class variants was the biggest fragmentation source — a 5-variant Button component covers all cases
2. Badge/status patterns (50+ instances) all reduce to a 7-variant Badge with optional dot+pulse
3. `hs-` CSS prefix on component classes prevents conflicts during incremental migration
4. Patterns that DON'T need components: cards (CSS class sufficient), checkboxes, forms, toasts, clipboard copy
5. Showcase page as a live component demo is essential for verifying visual consistency

---

## session: Dashboard config, stats dropdown, page-desc, title audit — 2026-03-22

**Purpose:** Added customizable dashboard sections, expanded stats gear dropdown, and added page descriptions and consistent titles across all pages.

**Insights:**

1. Dashboard sections can be toggled via `hs:dashboard-config` localStorage key. The disk cards are nested inside the stats-row div, so a separate `disk` toggle controls just the disk cards within the stats grid.
2. The layout's `ALL_STATS` array drives both the header stat display and the dropdown toggles. Adding new stat keys (`netSpeed`, `diskIO`) requires updating the `StatKey` union type and the display template.
3. Net speed tracking requires a delta calculation between consecutive reads of cumulative `networkBytes` data. The `prevNetBytes` state tracks the previous snapshot with timestamp for rate calculation.
4. Disk I/O data is not available from the server API (`/api/system`), so the stat shows "n/a" when enabled. A future API endpoint would need to read `/proc/diskstats` or similar.
5. Several pages used `<h1>` instead of `<h2>` for their page title (bookmarks, kanban, wol, dns, ports, speedtest, screenshots, benchmarks, qr). The terminal and clipboard pages had no page-level heading at all.
6. The `page-desc` and `page-title` CSS classes are already defined in `app.css` -- no need to add component-scoped styles for these.

---

## session: Terminal scrollback, BT connect, peripherals expansion, per-core CPU — 2026-03-22

**Purpose:** Added terminal scrollback buffer, Bluetooth connect/disconnect, new peripheral tabs (displays, network, system info), and per-core CPU monitor with swap color fix.

**Insights:**

1. The `TerminalSession` interface uses a plain object literal, so `scrollback` needs getter/setter to access a mutable closure variable — the interface field alone won't capture PTY output that accumulates outside the object.
2. The vite.config.ts WebSocket handler already had session resume logic (`getSession`), making scrollback delivery straightforward — just send after the session ID message.
3. `system_profiler SPDisplaysDataType -json` nests displays under GPU entries (`spdisplays_ndrvs`), not at the top level — must iterate GPUs first.
4. `networksetup -listallhardwareports` gives port/device/MAC but no IP or status — need to cross-reference with `ifconfig` output parsed by device name.
5. The peripherals page `activeTab` type needed to be widened from a union of 5 literals to 8 — used a `TabKey` type alias to keep it clean.

---

## session: Six feature enhancements across files, lights, peripherals, QR, speedtest, benchmarks — 2026-03-22

**Purpose:** Implemented global file search, bulb drag-and-drop reordering, peripherals caching with skeleton loading, QR WiFi auto-fill + share, speedtest visual improvements, and benchmark history clearing.

**Insights:**

1. The WiFi API at `/api/wifi` returns `{ networks, current, error }` — `current.ssid` is the field for the connected network SSID, not `currentConnection`.
2. The peripherals page had no caching; using `sessionStorage` with a cache key gives instant render on return visits while `onMount` refreshes in background — the `loading` state only shows skeletons when cached data is absent.
3. The `skeleton-card` class is already defined globally in `app.css` with a shimmer animation — no need to define custom skeleton styles.
4. For HTML5 drag-and-drop on Svelte 5, regular `ondragstart`/`ondragover`/`ondrop` event handlers work directly since Svelte 5 treats them as native DOM events.
5. The benchmarks API stores history in `~/.home-server/benchmarks.json` via `writeResults()` — clearing history just calls `writeResults([])`.
6. `navigator.share` file sharing availability must be checked via `navigator.canShare({ files: [...] })` — not all browsers that support `navigator.share` support file sharing.

---

## session: Central icon system creation — 2026-03-22

**Purpose:** Created a centralized SVG icon registry and Icon component, then replaced Unicode/HTML entity icons in layout, AiChat, and MediaPlayer.

**Insights:**

1. The project uses Svelte 5 runes syntax ($props, $derived, $state) -- component props use `$props<{...}>()` pattern.
2. Prettier with prettier-plugin-svelte reformats Svelte templates aggressively (wrapping element content onto new lines with `>content</tag` patterns), so edits must match the post-formatted state.
3. The icon registry needed volume-off/low/high icons beyond the original spec -- the media player had 3-level volume states that don't map to any of the originally requested icons.
4. Layout file has a Tooltip wrapper component that was not in the original read -- files can change between reads due to external edits or linter runs.
5. When replacing inline text/entities with Icon components inside ternary expressions, Svelte requires `{#if}...{:else}...{/if}` blocks rather than ternary `{condition ? a : b}` when using components.

---

## session: Create shared Tooltip and Modal components — 2026-03-22

**Purpose:** Added reusable Tooltip and Modal Svelte 5 components and integrated Tooltip into the navbar header.

**Insights:**

1. In Svelte 5, `<svelte:window>` cannot be placed inside `{#if}` blocks — must be at the top level with a conditional guard inside the handler function.
2. The layout file (`+layout.svelte`) is large (~1200 lines with styles). Navbar buttons (Help, Settings, Theme indicator) are around lines 364-395.
3. The project already has inline modal markup in the layout for "Manage Devices" — the new Modal component could replace it in a future refactor.
4. Tooltip `position="bottom"` is appropriate for header buttons since they're at the top of the viewport.

---

## session: Three feature additions (path bar, peripherals tabs, cron lifecycle) -- 2026-03-22

**Purpose:** Added editable path bar to file browser, USB/Audio/Battery tabs to peripherals, and cron-aware delete flow to tasks page.

**Insights:**

1. Svelte 5 does not support `onmousedown|preventDefault` modifier syntax -- must use inline `(e) => { e.preventDefault(); ... }` instead.
2. The peripherals page used a flat if/else chain for wifi vs bluetooth tabs. Adding more tabs required restructuring to `{:else if activeTab === 'x'}` blocks for each tab.
3. The scheduler module uses `scheduledJobs` Map with keys like `task:{id}` and `backup:{id}`, making it easy to add targeted unschedule without clearing all jobs.
4. `system_profiler SPUSBDataType -json` returns nested `_items` arrays (controllers containing devices), requiring recursive traversal to collect all USB devices.
5. The tasks page data flow goes through `+page.server.ts` load -> `+page.svelte` props AND client-side refresh via `/api/tasks` GET -- both paths need to return `scheduledCount`.

---

## session: Lights/Clipboard/Keeper UI improvements — 2026-03-22

**Purpose:** Improved visual hierarchy for smart lights bulb cards, redesigned clipboard UX with grouped entries, and added Claude CLI status info to Keeper page.

**Insights:**

1. The lights page `cacheBulbs()` was already correctly wired through `mergeBulbs()` -- no fix needed, just confirmed it works on both `rediscover()` and `refreshStates()` code paths.
2. Room assignment in lights is stored independently in localStorage under `hs:bulb-rooms` -- separate from `hs:bulb-names`. The `saveRoom()` function handles persistence without needing any bulb state save.
3. The keeper `+page.server.ts` load function doesn't include `claudeAvailable` -- the client fetches it via the API route on mount. This avoids adding `child_process` imports to the SSR page load.
4. Clipboard entries are grouped by deviceId using `$derived.by()` with the current device sorted first. The `navigator.clipboard.writeText` fallback uses a temporary textarea + `execCommand('copy')`.
5. Brightness arc was enlarged from 48px to 72px and centered in its own section with `card-divider` elements between card sections for visual hierarchy.

---

## session: Process sort, disk extended info, dashboard enrichment — 2026-03-22

**Purpose:** Added sortable process table with CPU/MEM toggle, populated disk fstype/device fields, and enriched dashboard with starred files + disk sparklines.

**Insights:**

1. `getSystemDiskUsage()` already parsed `df -h` but left `fstype` empty -- the `mount` command on macOS provides filesystem types in the parenthesized section (e.g., `(apfs, sealed, ...)`), while Linux needs `df -T`.
2. SvelteKit layout data (system.memTotal, system.cpuCount) is accessible in child pages via `data` props without explicit passing -- useful for absolute CPU/MEM display.
3. The `stars` store uses Svelte 4 `writable` store (not runes) -- when consuming in Svelte 5 components, use `onMount` + `subscribe` for reactivity rather than `$derived`.
4. `card-stagger` animation is globally defined in `app.css` -- just add the class and `animation-delay` style to any element.
5. Process table sort: using `$derived.by()` with a spread+sort pattern keeps the original array immutable while the sorted view updates reactively.

---

## session: Navbar fixes and audit gap fills — 2026-03-22

**Purpose:** Replaced theme dropdown with compact indicator, added system stats (swap/procs/net), help button, manage devices modal, wired shared stars store, added skeleton loading, and applied card-stagger animations across pages.

**Insights:**

1. The project has 20 themes (not 10) -- the theme.ts file grew since the original CLAUDE.md spec was written. Always re-read target files before editing.
2. `stars.ts` provides `sortStarred()` helper that replaces manual starred-first sorting -- used it in processes page to simplify the derived.
3. The files page used `starredFiles.has(...)` in both the sort comparator and the template -- needed `replace_all` to swap all occurrences consistently.
4. Layout server can shell out with `execSync` for platform-specific stats (swap via `sysctl vm.swapusage` on macOS, `free -b` on Linux) but needs timeout guards and try/catch.
5. Svelte component `class:selected={...}` and `class="card-stagger"` can coexist on the same element -- no conflict with dynamic class directives and static class attributes.
6. For SSR-loaded pages (dashboard, tailscale), skeleton loading only helps when the data arrays are empty -- otherwise data arrives with the HTML.

---

## session: Sidebar nav groups + per-page docs — 2026-03-22

**Purpose:** Restructured sidebar navigation into collapsible groups with pinning, and created 24 per-page documentation files with categorized docs page.

**Insights:**

1. Svelte 5 does not support `onclick|stopPropagation` modifier syntax; use `onclick={(e) => { e.stopPropagation(); ... }}` instead
2. HTML entities inside Svelte `{}` expressions render as literal text; use Unicode escapes (`'\u2605'`) for dynamic content, but HTML entities (`&#9733;`) work fine in static HTML positions
3. The layout.svelte has an external linter/formatter that may add imports (e.g., `THEME_SWATCHES`, `goto`) -- these should not be reverted
4. `docs/pages/` directory already existed but was empty; the `+page.server.ts` previously only scanned `docs/` (not subdirs), so it needed updating to collect from `docs/pages/`
5. The `DocFile` interface needed a `category` field added to support grouped rendering in the docs page

---

## session: Audit and fix fetch() error handling across all page files — 2026-03-22

**Purpose:** Added try/catch with toast.error() notifications to every unguarded fetch() call across 7 page files.

**Insights:**

1. backups page already had good error handling on CRUD operations (create, update, delete with try/catch + toast) but was missing it on `refresh()` and `triggerBackup()` initial fetch.
2. keeper page had solid error handling on agent actions (start/stop/resume/sendMessage) but was missing it on CRUD operations (createRequest, updateStatus, deleteReq, saveEdit, saveResult) and utility fetches (refresh, fetchAgentStatus, fetchLog).
3. tasks page `runTask` and `runTemplate` had polling intervals inside them -- wrapping the initial fetch in try/catch while keeping the poll setup inside the try block keeps the polling from starting if the initial trigger fails.
4. For polling functions like `fetchSystemStats` (processes) and `fetchLog` (keeper), using toast key dedup (`{ key: 'system-stats' }`, `{ key: 'keeper-log' }`) prevents toast spam from repeated polling failures.
5. files page had no error handling at all on any fetch call -- seven functions needed wrapping.
6. lights page `setBulb` is called from debounced handlers and group actions -- adding error handling there covers all downstream callers (toggleBulb, debouncedSet, groupAction, setTemp, setScene).

---

## session: Terminal fixes — session persistence, cwd, mobile UX — 2026-03-22

**Purpose:** Fixed four terminal issues: session persistence across navigation, PTY cwd, mobile overflow, and mobile extra keys bar.

**Insights:**

1. The server already had `getSession()` and session-param support in the WebSocket handler (vite.config.ts), so session persistence only needed client-side `sessionStorage` to store/restore session IDs.
2. PTY spawn used `os.homedir()` — changed to `process.cwd()` which resolves to the project root when the dev server is running.
3. For mobile terminal sizing, calculating cols from container width (`Math.floor(width / 9)`) before xterm opens prevents horizontal overflow better than CSS alone.
4. Mobile extra keys use `@media (pointer: coarse)` to target touch devices; CTRL key uses a toggle flag that converts the next character key press to a control sequence (`charCode - 96`).
5. User explicitly instructed not to modify app.ts or +layout.svelte, overriding the normal version-bump workflow from CLAUDE.md.

---

## session: core-dump with full doc update — 2026-03-22

**Purpose:** Wrote checkpoint and updated all project documentation (PROJECT.md, README.md, api-reference.md, roadmap.md) to reflect v3.0.0 state.

**Insights:**

1. `sed -i '' 's/^- \[ \]/- [x]/g'` is the fastest way to bulk-check todos in markdown — much faster than individual Edit calls
2. The API reference doc grew from 362 lines to 570+ lines with 20 new endpoint sections — keeping endpoint docs concise (method + path + one-liner + body/response) scales better than detailed examples for every endpoint
3. README feature tables organized by category (Core, Tools, Security, Infrastructure) are more scannable than a flat list when you have 25+ pages

---

## session: Massive feature sprint T8-T26 + uncategorized — 2026-03-22

**Purpose:** Implemented all remaining roadmap items (T8-T26) plus uncategorized features in one sprint, bringing the project from v2.5.1 to v3.0.0.

**Insights:**

1. Parallel agents via worktrees are effective for independent page creation — 5 agents built 15+ pages simultaneously without file conflicts (the only shared file is the nav array in +layout.svelte, handled manually at the end)
2. `$derived.by()` returns the VALUE directly, not a function — don't call it with `()` at the callsite. Common mistake when converting from `$derived(() => ...)` closures.
3. The OUI lookup maps in network tools are prone to duplicate key errors — always check for uniqueness when generating large object literals
4. `sessionStorage` is better than `localStorage` for cache data (like lights state) — clears on tab close, avoids stale data across sessions
5. PWA `beforeinstallprompt` needs to be captured early (in layout onMount) and the event preserved for later triggering — the event is only fired once per page load

---

## session: tasks page custom template delete + cron output hint — 2026-03-22

**Purpose:** Added delete button for custom templates in template grid and a "📋 Last output" toggle button in the task card last-run row, plus a pending-output hint for cron tasks with no run history.

**Insights:**

1. Custom template cards need `position: relative` on the card and `position: absolute` on the delete button — the template body is a `<button>` taking full width so the overlay delete btn must sit above it via `z-index: 1`.
2. `{@const}` blocks inside `{#each}` are the cleanest way to derive per-iteration values (like `isCustom`, `customIdx`) without polluting the script with helper functions.
3. For the delete button, `e.stopPropagation()` alone is not enough when the delete button is a sibling (not child) of the clickable body — but since it's a separate element outside the body button, propagation to the card div is irrelevant; the key is just not being inside `.template-body`.
4. The `{:else if status.config.schedule}` branch on the `{#if status.lastRun}` block is an elegant way to show cron-specific pending state without adding extra conditional wrapper divs.
5. `customTemplates.findIndex((c) => c.name === t.name && c.command === t.command)` is needed because `pagedTemplates` derives from `allTemplates` (merged array), so template array indices don't map 1:1 to `customTemplates` indices.

---

## session: improve Toast.svelte UI — 2026-03-22

**Purpose:** Upgraded Toast component with larger sizing, better icons, slide-in-from-right animation, a per-toast CSS progress bar, larger close button touch target, and 4px left border accent.

**Insights:**

1. Svelte custom transitions are plain functions returning `{ duration, easing, css }` — no library needed; `cubicOut` from `svelte/easing` gives a natural feel for slide-in.
2. The progress bar relies on `animation-duration` set inline from `t.duration` (ms) — this requires `overflow: hidden` on the parent `.toast` to clip the bar at the edges.
3. `@react-icons/all-files` is React-only; the Svelte equivalent to watch for is `lucide-svelte` — added a TODO comment in Toast.svelte as a breadcrumb.
4. `border-left: 4px` on the type-specific class naturally overrides the `border: 1px` shorthand on `.toast` for just the left side — no need for `border-left-width` override separately.
5. Close button touch target sized to `min-width/min-height: 28px` with flexbox centering avoids padding hacks that would misalign the × character visually.

---

## session: add 10 developer theme CSS variables — 2026-03-22

**Purpose:** Added 8 new `[data-theme='...']` blocks to app.css (monokai, dracula, solarized-dark, solarized-light, nord, github-dark, catppuccin, tokyo-night) and verified theme.ts already had all 10 themes in its union type and THEMES array.

**Insights:**

1. Files were being edited concurrently by another agent — every edit attempt required a re-read first; always treat concurrent multi-agent sessions as "file may have changed since last read".
2. The other agent had already fully updated `theme.ts` by the time this session read it (Theme union, THEMES array, VALID_THEMES Set, setTheme) — no redundant work needed, just the CSS variables block.
3. For dark themes, `--bg-inset` should be noticeably darker than `--bg-primary` to distinguish embedded/nested regions; for light themes it can be slightly warmer/off-white.
4. Tokyo Night's `--bg-inset` being `#0f3460` (deep blue) gives a high-contrast inset look matching the theme's neon-on-navy aesthetic — don't normalize it to match other dark themes.

---

## session: layout overhaul — sidebar descriptions, theme selector, stats dropdown, Space Grotesk — 2026-03-22

**Purpose:** Overhauled the SvelteKit layout with a richer sidebar (icons + descriptions), multi-theme dropdown, stats gear dropdown with CPU mode and refresh interval config, and Space Grotesk heading font.

**Insights:**

1. `app.css` already had 10 themes defined (Monokai, Dracula, Nord, Catppuccin, etc.) — the `Theme` type and `THEMES` array in `theme.ts` need to enumerate all of them, not just `dark` / `light`. Use `VALID_THEMES = new Set(...)` for safe localStorage parsing.
2. The existing `border-image` trick on `.active` nav items conflicts with `border-left` — removing it and using a plain `border-left: 3px solid var(--accent)` is cleaner and animates correctly.
3. Stats preferences stored under `hs:stats-config` as JSON; parse with try/catch since localStorage can throw in some contexts.
4. For a click-away dropdown without JS event listeners, a full-screen `position: fixed; inset: 0` overlay div with `z-index` just below the dropdown works cleanly in Svelte without side effects.
5. The theme `<select>` needs `appearance: none` plus an SVG chevron via `background-image` to look consistent across browsers; the standard select arrow is unstyled and mismatched.
6. `setTheme` was extracted from `toggleTheme` so both the dropdown and any programmatic call share the same localStorage + `data-theme` side-effect path.

---

## session: lights page — scene color dots, color preset row, state verification — 2026-03-22

**Purpose:** Enhanced the smart lights page with scene color indicator dots, a quick-color preset row replacing the bare color input, and verified initial bulb state loading from the server.

**Insights:**

1. `discoverBulbs()` in `wiz.ts` uses the `registration` method — WizBulbs respond with a pilot payload containing `state`, `dimming`, `r/g/b`, `temp`, `sceneId`, so initial state load is already correct without extra requests.
2. Scene dot colors are rendered using a CSS custom property (`--scene-color`) on a `<span>`, avoiding inline style duplication per-button.
3. The active color dot highlight uses both `border-color` and `box-shadow` together — just border alone gets lost against similar hues.
4. Color preset buttons use `applyColorPreset()` which mirrors `handleColor()` but skips the Event parameter, keeping them DRY.
5. Old `input[type='color']` block-level CSS was removed after moving to `.color-custom` class to avoid specificity conflicts with the circular shape.

---

## session: visual design polish — 2026-03-22

**Purpose:** Applied global UI polish: custom CSS-only checkboxes, muted navbar stats, prominent version tag, header backdrop-filter, `.card` utility class, and active nav gradient border.

**Insights:**

1. `border-image` and `border-left` conflict — when using `border-image` on an element that also has `border-left`, the image overrides all border colors. Used `border-image-slice: 0 0 1 0` to apply the gradient only to the bottom border edge while the left border uses the standard `border-left-color` from the shorthand above it (border-image overrides only what it covers).
2. `backdrop-filter: blur()` on a fully opaque background has no visible effect — it only shows through semi-transparent or transparent backgrounds. The header here uses `var(--bg-secondary)` which is fully opaque, so the effect is cosmetic for future semi-transparent variants.
3. Pure CSS checkmarks use a rotated rectangle with `border: 2px solid white; border-top: none; border-left: none` — this is the most reliable cross-browser technique without SVG or font icons.
4. `opacity` on `.stat` reduces perceived brightness without touching color tokens, useful for muting color-coded dynamic values without removing their semantic color.

---

## session: create UI Showcase page — 2026-03-22

**Purpose:** Built a static `/showcase` route demonstrating the full design system: color swatches, typography, buttons, cards, DataTable, toast triggers, and a terminal mock.

**Insights:**

1. The layout nav array in `+layout.svelte` had already been extended beyond the version read at session start (a `/docs` entry was added by a prior change) — always re-read layout before editing nav to avoid conflicts.
2. Regex `#[0-9a-fA-F]{3,6}` produces false positives on Svelte `{#each}` block syntax; visually confirm matches before reporting hex color violations.
3. `DataTable.svelte` accepts `headers: string[]` and `rows: string[][]` — all cells must be strings, not numbers; pass numeric data as string literals.
4. The `toast` store exposes `.success()`, `.warning()`, `.error()`, `.info()` directly on the store object (not a sub-namespace); import `{ toast }` from `$lib/toast` and call methods directly.
5. Version was already at `1.12.0` from a prior uncommitted session change; bumping minor again from `1.11.x` would have been wrong — always re-read `app.ts` before writing the new version.

---

## session: Add Documentation page — 2026-03-22

**Purpose:** Created a `/docs` route that reads all `.md` files from the project root and `docs/` directory and renders them as collapsible, searchable sections.

**Insights:**

1. The `renderMarkdown` function lives in `$lib/markdown` (not `$lib/renderers/markdown.ts` — that file re-exports it wrapped in a `DocumentRenderer`); import directly from `$lib/markdown` for plain string → HTML use.
2. The markdown CSS lives only in `src/routes/files/+page.svelte` as scoped styles with `:global()` — it must be duplicated (or extracted to `app.css`) for any new page that renders `.md-content`; duplication was the expedient choice here.
3. `fs.readFileSync` in a SvelteKit page server load works fine at dev time when the CWD is the project root; `path.resolve('.')` returns the project root reliably in that context.
4. The `docs/` directory has 6 files (api-reference, architecture, claude-keeper, extending, setup-guide, widgets); root has 4 (CLAUDE.md, PROJECT.md, README.md, _checkpoint.claude.md). Sorting is purely alphabetical within each group.
5. Svelte 5 runes: `$state<Record<string, boolean>>({})` for per-file expanded state works cleanly; mutating `expanded[key]` directly triggers reactivity without needing `$state` on the object values.

---

## session: Complete P1-P10 + Prettier + New Todo Formulation — 2026-03-22

**Purpose:** Execute all 41 original pending todos across 10 priority tiers, set up Prettier, formulate 20+ new user requests into 16 structured task groups.

**Insights:**

1. Running background agents for parallel CSS cleanup (strip fallbacks) works well but version bumps collide — always re-read `app.ts` before editing the version after agents finish.
2. Prettier with `prettier-plugin-svelte` requires `--force` install on Node 23 due to engine restrictions in `@sveltejs/vite-plugin-svelte`. Works fine despite the warning.
3. The `getSystemDiskUsage()` function returns duplicate "/" entries on macOS (APFS `/System/Volumes/Data` reports same mount) — logged as T7 fix.
4. Template "Run" button pattern (create + immediately execute) requires the create API to return the new task ID in the response body — verify this works with the actual backend.
5. Svelte 5's `$derived.by()` is the idiomatic way to compute filtered/sorted lists — avoid `$:` reactive statements.
6. Pre-commit hook for Prettier auto-formatting staged files works but adds a second `git add` pass — acceptable tradeoff for consistent formatting.

---

## project-index: First full scan of home-server — 2026-03-21

**Purpose:** Generate comprehensive project index for the home-server SvelteKit dashboard project.

**Insights:**

1. Project is a SvelteKit 2.x app with Svelte 5 Runes — not React/Next.js. The SKILL.md template examples are React-centric and should be adapted for Svelte projects.
2. No state management library — Svelte 5 Runes ($state, $derived, $effect) and Svelte stores (writable) handle all reactivity. No need to search for Jotai/Zustand/Redux.
3. Server modules follow a strict one-file-per-domain pattern in src/lib/server/ with no cross-imports. This makes indexing very predictable.
4. All persistence is JSON files in ~/.home-server/ — no database ORM to scan for schemas.
5. The document renderer registry in src/lib/renderers/ is a clean plugin pattern worth highlighting as an architectural exemplar.
6. @types/node-cron and @types/ws are listed under dependencies rather than devDependencies — potential cleanup item.

---
