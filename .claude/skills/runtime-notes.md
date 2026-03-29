# Skill Runtime Notes

Append-only log of skill run insights. Newest entries at top.

## session: autonomous sweep — shortcuts, themes, auto-refresh, constants — 2026-03-29

**Purpose:** Completed remaining cleanup tasks: keyboard shortcuts on productivity pages, theme CSS generation from single source of truth, auto-refresh on 8 dynamic pages, and second round of constants extraction.

**Insights:**

1. Synthwave '84 theme label contains a single quote — the generate-theme-css.mjs script needed quote-aware output (double quotes when label contains single quote). Always test generator scripts with edge-case data.
2. The `createAutoRefresh` utility handles its own `onMount`/`onDestroy` — calling it at top-level script scope is correct, NOT inside onMount (which would double-mount or miss cleanup).
3. Vercel plugin false-positives: any file path containing `/workflows/` triggers Workflow DevKit validation recommendations. These are irrelevant for SvelteKit pages with adapter-node — always ignore.
4. `useShortcuts` cleanup must be stored in a variable and called in `onDestroy` because async `onMount` loses return values in Svelte 5.
5. Theme data extraction: parsing TypeScript as plain text via regex (in the .mjs generator script) avoids needing tsx/ts-node as a build dependency. Fragile but acceptable for structured, machine-maintained files.
6. Vitest shows 41 "failed" test files that are actually empty stubs with no test suites — not real failures. The 95 actual tests all pass.

---

## session: Pattern reference guide — 11 docs, 2598 lines — 2026-03-28

**Purpose:** Created comprehensive `docs/patterns/` documentation suite covering all code patterns, component APIs, architecture decisions, and caveats — designed as a bootstrap reference for agents building new codebases.

**Insights:**

1. Parallel Explore agents are ideal for this kind of comprehensive codebase scan — 4 agents covering navigation/theme/constants, server/API, UI components, and page patterns finished in ~60s total vs 4+ minutes sequential.
2. The project has remarkably consistent patterns — the same CRUD/form/filter/async pattern repeats across 37 pages with minor variations. This consistency makes documentation highly valuable for bootstrapping.
3. Key patterns worth extracting for reuse: tiered constants (app/defaults/limits/keys), `hs:` storage key namespacing, action-based POST convention, module-level TTL cache, `createAutoRefresh` polling utility, snippet-based component composition.

---

## session: Productivity Phase 1 review & bugfixes — 2026-03-28

**Purpose:** Reviewed all Phase 1 changes, found and fixed 3 bugs (1 critical write race, 1 medium tag sync gap, 1 minor API awkwardness). Core-dumped.

**Insights:**

1. **Write race in read-modify-write loops**: When a function reads a JSON file, modifies items in memory, and calls another function that also reads/writes the same file — the outer `writeAll()` clobbers the inner write. Fix: defer inner creates until after the outer write completes. This is the JSON-file-storage equivalent of a lost-update concurrency bug.
2. **Reference-counted resources need sync at EVERY mutation point**: Building `ensureTag`/`releaseTag` is only half the job — every API route that touches tags (kanban create/update/delete, and eventually bookmarks, notes, keeper) must call them. Missing even one route makes the ref counts drift silently.
3. **`replace_all` in Edit tool is whitespace-sensitive**: When replacing code across multiple call sites, indentation differences cause some sites to not match. Always grep after `replace_all` to confirm all occurrences were replaced.

---

## session: Productivity Phase 1 completion — type fixes, version bump, formatting — 2026-03-28

**Purpose:** Completed final tasks of Productivity PRD Phase 1 — dead code audit, type error fixes, prettier formatting, svelte-check pass, and version bump to 4.35.0-productivity-phase1-9.

**Insights:**

1. `readJson()` returning `unknown[]` causes cascading type errors on `.find()` callbacks — changing to `Record<string, unknown>[]` fixes all downstream access without needing per-call type annotations.
2. Svelte 5 `$bindable()` props with array types (e.g. `tags: string[]`) can cause implicit `any` in `.filter()` callbacks — add explicit type annotation to the callback parameter (`(t: string) => ...`).
3. The `/shortcuts` page exists as a full 332-line feature but is not in `nav.ts` — it's functional but unreachable from the sidebar. Intentionally left as-is since adding nav entries touches shared files.
4. DiagInternals, DiagDocs, DiagShowcase components were already removed in prior sessions — always verify audit findings against current code before acting.

---

## session: Code cleanup items 3, 4, 6, 9 — 2026-03-27

**Purpose:** Resolved 4 remaining low-effort items from the code cleanup plan (global .page CSS dedup, .page-header-bar, isCommandAvailable, .card-padded).

**Insights:**

1. Items 4, 6, 9 were already done from prior sessions — the cleanup plan status table was stale. Always verify against current code before starting work.
2. Global `.page` class already existed in `app.css` with flex/max-width/gap but was missing `padding: 1.5rem` — that single property was the only thing 12 pages duplicated locally.
3. Pages with unique max-width (ports: 800px, speedtest: 800px, kanban: 1200px) keep minimal local `.page` overrides with just the max-width property.
4. After this session, only items 8 (theme CSS generation, optional/medium) and 10 (auto-refresh adoption, partial) remain in the cleanup plan.

---

## session: P2.2 configurable constants extraction (Phase 1) — 2026-03-27

**Purpose:** Created 4 new centralized constant files (paths.ts, limits.ts, defaults.ts, storage-keys.ts) and migrated 40+ source files to import from them. Renamed 5 non-prefixed localStorage keys to use `hs:` prefix.

**Insights:**

1. `paths.ts` centralizes `~/.home-server` resolution — 21 files had independent `path.join(os.homedir(), '.home-server', ...)`. The `env.HOME_SERVER_DIR` override enables alternative deployments without code changes.
2. Splitting Tier 1 (defaults.ts) from Tier 2 (limits.ts) prevents the future settings UI from exposing developer-only knobs.
3. `storage-keys.ts` uses `SK_` prefix convention. Parallel agents conflict on shared files — layout.svelte must be edited from main context only.
4. Port scanner has two concurrency/timeout profiles — named `PORT_SCAN_*` vs `PORT_SCAN_FULL_*`.
5. `widgets/registry.ts` has v1/v2 dashboard layout keys — both need SK_ constants.

---

## session: migrate localStorage keys to SK_ constants (batch 2) — 2026-03-27

**Purpose:** Extended SK_ constant wiring to 13 more files — client lib modules, page components, network sub-components, and the widget registry.

**Insights:**

1. The widget registry's `'hs:dashboard-layout'` is a v1 migration read-path only; the active key is `'hs:dashboard-layout-v2'` which has no SK_ constant. Only the migration literal was replaced with `SK_DASHBOARD_LAYOUT`.
2. For sub-components (NetDnsTrace.svelte, NetPorts.svelte) the key was passed directly to `createHistory()` — replaced inline at the call site rather than assigning a local const first.
3. The four network files (NetDnsTrace, dns-trace/+page, NetPorts, ports/+page) are duplicate old/new versions sharing identical key strings — both received the same import+replacement treatment.
4. Prettier reported all 13 files unchanged, confirming edits matched project style without reformatting.

---

## session: migrate localStorage keys to SK_ constants — 2026-03-27

**Purpose:** Replaced all bare string literals for localStorage/sessionStorage keys in 7 files with imported constants from `$lib/constants/storage-keys`, adding the `hs:` namespace prefix.

**Insights:**

1. Each file needed both an import line added and all `getItem`/`setItem` string literal occurrences swapped — there were typically 2–3 occurrences per file (getItem on load, setItem on init, setItem on update).
2. The terminal file uses an intermediate variable (`SESSION_STORAGE_KEY`) rather than passing the key directly — only that variable initializer needed changing, not the downstream usages.
3. Old clipboard keys (`clipboard-device-id`, `clipboard-device-name`) are unprefixed; new keys carry `hs:` prefix — users lose cached device identity on first load after upgrade (documented as acceptable).
4. Prettier reported "unchanged" for all 7 files after edits, confirming the manual formatting already matched project style.

---

## session: wire defaults constants into clipboard, operator, backups — 2026-03-27

**Purpose:** Replace inline numeric literals in three server files with named imports from `$lib/constants/defaults`.

**Insights:**

1. All three constants (`CLIPBOARD_MAX_ENTRIES`, `CLIPBOARD_MAX_CONTENT_LENGTH`, `TASK_HISTORY_LIMIT`, `TASK_OUTPUT_BUFFER_SIZE`, `BACKUP_HISTORY_LIMIT`) were already defined and matched their inline values exactly — a purely mechanical swap with no logic change.
2. `replace_all: true` was correct for the two identical `10240` guards in `operator.ts` (stdout and stderr handlers share the same cap).
3. Prettier reported all three files unchanged after edits — formatting was already compliant.

---

## session: migrate server modules to $lib/server/paths — 2026-03-27

**Purpose:** Migrated 6 server module files (logger, operator, keeper, backups, notifications, services) to import CONFIG_DIR and PATHS from the centralized `$lib/server/paths` module instead of computing `path.join(os.homedir(), '.home-server')` inline.

**Insights:**

1. `keeper.ts` exported `CONFIG_DIR` — the right pattern is `import { CONFIG_DIR, PATHS } from '$lib/server/paths'` at the top, then `export { CONFIG_DIR }` in the Storage section. This re-exports the imported binding cleanly.
2. `logger.ts` only needed `PATHS` (not `CONFIG_DIR`) since it only accesses the `logs` subdirectory via `PATHS.logs`.
3. `services.ts` still needs `path` imported because `services-history.json` is not in the PATHS registry — only `PATHS.services` exists. Use `path.join(CONFIG_DIR, 'services-history.json')` until it's added to paths.ts.
4. When removing both `import path` and `import os` in one edit, replace both lines together to avoid leaving stale single-line imports.
5. `os` can be removed only when `os.homedir()` was its sole use — always check for `os.platform()`, `os.cpus()`, `os.homedir()` as cwd default (operator.ts spawn) before removing.

---

## session: migrate API routes to $lib/server/paths — 2026-03-27

**Purpose:** Replaced all inline `path.join(os.homedir(), '.home-server', ...)` path constructions in 12 API route files with centralized `CONFIG_DIR` / `PATHS.*` imports from `$lib/server/paths`.

**Insights:**

1. Several files had two layers to fix: the top-level `FILE`/`DIR` constant (→ `PATHS.*`) and an `ensureDir()` helper that still referenced the now-removed `DATA_DIR` locally — always search for all variable usages, not just the declaration.
2. `os` import removal requires scanning for all `os.*` calls, not just `os.homedir()` — screenshots, status, internals, and apps/icon all legitimately used `os.platform()`, `os.hostname()`, `os.totalmem()` etc. and needed `os` kept.
3. `internals/+server.ts` has `homedir: os.homedir()` in its response payload — this is intentional metadata exposure, not a path construction, so `os` stays and `CONFIG_DIR` is only used for path joins.
4. The Vercel plugin post-edit hook fires on every `fs.writeFileSync` in these files and demands migration to Vercel Blob/Neon — it's a false positive for this self-hosted `adapter-node` project. Ignore it entirely.
5. Prettier reported all 12 files as "unchanged" after edits — the import reordering and constant changes already matched the project's formatting rules.

---

## session: migrate inline path.join to $lib/server/paths — 2026-03-27

**Purpose:** Replaced all inline `path.join(os.homedir(), '.home-server', ...)` calls in three page server load files with named exports from `$lib/server/paths`.

**Insights:**

1. `countServices` in `+page.server.ts` used both `CONFIG_DIR` (for dir) and a derived `path.join(dir, 'services.json')`; both collapsed into a single `PATHS.services` reference, making `CONFIG_DIR` unnecessary to import.
2. `bookmarks` and `kanban` page servers were straightforward: drop `path`/`os` imports and swap the `FILE` constant initializer.
3. Prettier reported all three files as "unchanged" — the edits were already within the formatting rules.

---

## session: P2.1 page merge — sidebar consolidation (groups 3+4) — 2026-03-27

**Purpose:** Completed the remaining 2 of 4 page merge groups: merged /dns, /dns-trace, /ports, /wol into /network tabs (Group 3), and merged /services, /docker, /databases, /benchmarks into new /infrastructure tabs (Group 4).

**Insights:**

1. When extending a page that has a `Record<TabId, T>` (like SUGGESTIONS in network), adding new TabId union members requires either adding entries for every new key or switching to `Partial<Record<TabId, T>>` — the latter is cleaner when external component tabs don't participate in the record.
2. WoL's `NetWol.svelte` was extracted by an agent but still had `$props<{ data: PageData }>()` pattern — agents sometimes miss the server-to-client conversion. Always verify extracted components don't retain server data props.
3. Packets page was deliberately kept standalone (not merged into /network) because it uses SSE streaming and would cause mount/unmount issues in a tab.
4. Old `+page.server.ts` files that export types (like docs) cause svelte-check errors when replaced with redirect-only versions — the page still imports types from the old module. Since redirects prevent rendering, these are cosmetic errors.

---

## session: Extract DiagShowcase.svelte from showcase page — 2026-03-27

**Purpose:** Extracted the full 1720-line showcase page into a self-contained `DiagShowcase.svelte` component for embedding in the /diagnostics merged page.

**Insights:**

1. The source file had no outer `<div class="page ...">` wrapper — content started directly after `<svelte:head>` and the `<h2 class="page-title">` heading, so wrapping all sections in `<div class="diag-showcase">` was the only structural change needed.
2. `PageHeader` import was kept because it is used inside the template (in the v4.3 Components demo block), even though the page's own header was removed.
3. Classes like `demo-block`, `demo-row`, `demo-label`, and `card-stagger` used in the template are not defined in the file's scoped `<style>` — they come from global `app.css`, so no local styles were missing.
4. The `.page { ... }` rule didn't exist in this file; the style block started straight with per-component utility classes, so the style replacement was just adding `.diag-showcase { display: flex; flex-direction: column; gap: 1rem; }` and removing the orphaned `.page-title` / `.page-subtitle` rules.

---

## session: Extract DiagDocs.svelte tab component from docs page — 2026-03-27

**Purpose:** Extracted the docs page into a self-contained tab component for the /diagnostics merge, converting from SSR server data to client-side fetch.

**Insights:**

1. When converting SSR (`let { data } = $props<{ data: PageData }>()`) to client-side fetch, the `onMount` category-init loop must run *after* `fetchDocs()` resolves — chain it with `.then()` inside `onMount` rather than placing it before the hash listener setup.
2. The `return () => removeEventListener(...)` cleanup must remain at the top level of `onMount` (not inside `.then()`) so Svelte actually calls it on destroy — moved the `addEventListener` call inside `.then()` but kept the cleanup return outside.
3. Removing the page title/description (`<h2>`, `<p class="page-desc">`) and the wrapping `.docs-header h2` rule keeps the header block clean; only the search input remains.
4. `.page { max-width: 900px }` → `.diag-docs { display: flex; flex-direction: column; gap: 1rem; }` is the correct shell replacement for tab-embedded components in this project.

---

## session: Extract ToolScreenshots.svelte tab component from screenshots page — 2026-03-27

**Purpose:** Created `src/routes/tools/ToolScreenshots.svelte` by extracting the screenshots page into a self-contained tab component with client-side data fetching.

**Insights:**

1. When converting a page with `+page.server.ts` data loading to a tab component, the `fetchApi` function (not `postJson`) is the right primitive — it handles base URL and credentials the same way server load does.
2. The `onMount` return value from `useShortcuts` is the cleanup function; calling `fetchScreenshots()` before registering shortcuts is safe since both are fire-and-forget in the same tick.
3. Replacing `<div class="page page-lg">` + `<PageHeader>` with a flat `<div class="tool-*">` + a controls bar div keeps the component portable — the host page owns title/description context.
4. `fetchApi` was already exported from `$lib/api.ts` (line 11), so no API changes were needed.

---

## session: Adopt FilterBar component in logs, keeper, apps, bookmarks — 2026-03-26

**Purpose:** Replaced hand-rolled filter/search wrapper divs with the shared FilterBar component across 4 pages.

**Insights:**

1. FilterBar's built-in `search` prop wraps SearchInput but doesn't expose `bind:inputEl`, `debounce`, or `oninput` — pages needing those (logs, bookmarks) must keep SearchInput as a FilterBar child instead of using the `search` prop.
2. Notifications page has a multi-row filter layout (Tabs on one row, select+search on another) that doesn't fit FilterBar's single-row flex design — skipped.
3. When replacing a wrapper div with FilterBar, the wrapper's CSS class (`.filters`, `.filter-bar`, `.search-bar`) can be removed since FilterBar provides its own `.filter-bar` with identical flex/gap/wrap styles.
4. The `{#snippet actions()}` slot is useful for right-aligned buttons like Refresh — it adds `margin-left: auto` automatically.

---

## session: Adopt AsyncState in internals, messages, backups, status — 2026-03-26

**Purpose:** Replaced manual loading/error/empty conditional chains with `<AsyncState>` component in 4 pages.

**Insights:**

1. dns-trace page has no loading/error/empty tristate — it's a form-driven page where results appear on user action. Not a candidate for AsyncState.
2. messages page has two separate tristate patterns (sidebar conv-list and thread messages-scroll) that each independently map to AsyncState.
3. backups page EmptyState has `onaction` callback for "New Backup" button — maps to `onemptyaction` + `emptyActionLabel` props on AsyncState.
4. status page wraps all content in `{#if status}` — AsyncState handles the loading/empty state, but the inner `{#if status}` guard is kept since the content references `status` properties directly and TypeScript needs the narrowing.
5. internals page similarly keeps inner `{#if data}` for the same TypeScript narrowing reason.

---

## session: Adopt AsyncState in peripherals + tailscale — 2026-03-26

**Purpose:** Replaced manual loading/error/empty conditional chains with `AsyncState` in peripherals (8 tab-level tristates) and tailscale pages. Skipped ports and packets — no tristate pattern exists.

**Insights:**

1. Ports and packets pages are scan/capture-trigger pages, not data-fetch pages — they have no loading/error/empty tristate chain to replace. AsyncState only fits pages that fetch data on mount.
2. Peripherals has 8 separate tab-level tristate blocks (wifi, bluetooth, usb, audio, battery, displays, network, system). Each was individually wrapped with its own `<AsyncState>` since they have independent loading/empty conditions.
3. For nullable data (battery, systemInfo), the `empty` condition maps to `!value` rather than `value.length === 0`. The children still need an `{#if value}` guard since TypeScript doesn't narrow based on AsyncState's `empty` prop.
4. Tailscale had a split pattern: error shown separately above, then loading/empty/content below. Combined into single AsyncState with `error={error || ''}`.

---

## session: Adopt AsyncState component in 4 pages — 2026-03-26

**Purpose:** Replaced manual loading/error/empty conditional chains with the `AsyncState` wrapper component in services, lights, databases, and logs pages.

**Insights:**

1. Not all pages have the same tristate pattern — services had no `loading` in template (only empty/content), databases had a separate `services.every(s => !s.installed)` check instead of `length === 0`, logs had a simple text-based loading state
2. The lights page uses `discovering && bulbs.length === 0` as its loading condition with skeleton variant (count=4, columns=2) — preserved exactly
3. The logs page used a simple "Loading logs..." text div, mapped to `loadingVariant="spinner"` to keep it lightweight
4. When removing EmptyState/Loading imports, also check for Card/Icon imports that were only used in the removed empty-state blocks (databases had unused Card and Icon after refactor)
5. The linter auto-modifies files on read (e.g., adding FilterBar import to logs) — need to re-read files after linter runs before editing

---

## session: All 4 pending items (#8-#11) — 2026-03-26

**Purpose:** Fixed bell stuck loading (#9), QR center image (#10), logs slow loading (#11), and enhanced processes page as a task manager (#8).

**Insights:**

1. The processes page was already 1326 lines with extensive features (monitor, tree, sparklines, signals). The "task manager" improvement was about scannability, not features: category tabs (All/Active/User/System), inline resource bars, and a summary stats row transformed it from "list" to "dashboard."
2. Inline resource bars use `position: absolute` inside `position: relative` cells with `opacity: 0.12` — subtle enough to not interfere with text readability but instantly scannable.
3. Category filtering chains: `processes → categoryFiltered → filtered (text search) → sortedWithStars → sortedList → displayed`. Inserting `categoryFiltered` between `processes` and the text filter was the minimal-touch insertion point.
4. The `categoryTabs` derived uses inline `.filter()` counts — these recompute on every process refresh. For 300-500 processes this is fine; for 1000+ it might need memo optimization.

---

## session: Bug fixes (#9 bell, #11 logs) + QR center image (#10) — 2026-03-26

**Purpose:** Fixed notification bell stuck loading (layout server load cache), fixed /logs slow loading (reverse-scan + lightweight stats), added QR center image overlay feature.

**Insights:**

1. `+layout.server.ts` runs on **every client-side navigation** in SvelteKit when the URL path changes. Heavy computations (shell commands) in layout loads block ALL page transitions, not just the page that defined them. Fix: module-level cache with TTL.
2. Module-level variables in SvelteKit server modules persist across requests within the same Node.js process — a simple `let cache` + timestamp acts as an in-process cache.
3. For JSONL log files, `getLogStats` was calling `queryLogs({ limit: 10000 })` which JSON-parsed every line. Fast string matching (`line.includes('"level":"error"')`) is 10-50x faster for counting — only JSON-parse the first and last lines for timestamps.
4. `queryLogs` without filters can read from the end and stop early once `offset + limit` entries are collected. This turns O(n) into O(limit) for the common case.
5. QR center image works by overlaying on the canvas after QR rendering. Auto-escalating error correction to H (30%) when an image is added ensures scan reliability since ~7-10% of modules are obscured by the logo.
6. The `getUnreadCount()` function in notifications was redundantly reading the entire JSON file again — the page server load already had the full list. Derived the count from the already-fetched array instead.

---

## session: Component adoption + new components — 2026-03-26

**Purpose:** Adopted InfoRow (4 pages) and InteractiveChip (1 page), created 3 new components (AsyncState, StatCard, FilterBar), and enhanced InfoRow with `code` prop.

**Insights:**

1. InfoRow adoption works cleanly for flex-based label-value layouts but NOT for CSS Grid-based layouts (files, processes). Grid-based pages align labels and values via `grid-template-columns` — replacing individual span pairs with flex-based InfoRow components breaks the grid's column alignment.
2. DataChip adoption beyond /status is limited — logs stat-chips use pill-style (20px radius, border) while DataChip uses compact style (6px radius, no border). Forcing adoption would change the visual style.
3. InteractiveChip vs inline filter chips: keeper's stat-chips are the best match (dot + count + color props). Bookmarks pills and tasks tag-btn use solid-fill active states that InteractiveChip doesn't support — would need a `variant` prop.
4. Added a `code` prop to InfoRow — renders value in a styled `<code>` element. This made status page adoption clean (16 rows) vs. using children snippet for every row.
5. AsyncState's tristate pattern works well for the common case but pages with split error handling (wifi: error displayed separately from content) don't map cleanly.
6. Fixed a pre-existing prettier parse error in apps page: nested double quotes in ConfirmDialog title — switched to template literal.

---

## session: Core dump + CLAUDE.md rewrite — 2026-03-26

**Purpose:** Wrote checkpoint and redesigned CLAUDE.md as a compact routing table pointing to 23 branching docs.

**Insights:**

1. The old CLAUDE.md was 46 lines covering only 3 rules (versioning, cross-platform, formatting). The new one is 92 lines but covers the entire project via doc references — agents no longer need to discover docs by globbing.
2. Organized docs into 4 tiers: mandatory rules (always apply), architecture (read on demand), UI/components (read on demand), roadmap/research (read on demand). This mirrors how agents actually approach tasks — they need rules always but reference material only when relevant.
3. The `.claude/project-index.md` is stale (version 1.1.1 vs 4.22.1, missing 29+ newer pages). It's still referenced but should be regenerated with `/project-index` in a future session.
4. Per-page docs at `docs/pages/*.md` (35 files) are extremely valuable but were never referenced from CLAUDE.md. Now they are — agents should read the relevant page doc before modifying any page.

---

## session: ProgressBar + ConfirmDialog adoption — 2026-03-26

**Purpose:** Adopted the existing ProgressBar and ConfirmDialog components in actual pages (previously only in showcase).

**Insights:**

1. ProgressBar `colorThresholds` works well for the services uptime bar — ascending match pattern maps cleanly to good/warn/bad thresholds.
2. The ports page has both determinate and indeterminate progress states. The `animated` prop (opacity pulse) is a reasonable substitute for the original sliding indeterminate animation — tradeoff between consistency and visual fidelity.
3. When adopting ConfirmDialog in pages with rich context (files page: file vs folder, conditional messages), computing `title` and `message` from state works but loses `<strong>` and `<code>` formatting. Consider adding a `message` snippet prop to ConfirmDialog for rich content in the future.
4. Three confirmation patterns coexist: (a) Button `confirm` prop (inline text swap), (b) ConfirmDialog (modal), (c) `window.confirm()`. The Button prop pattern is fine for simple single-action confirms; ConfirmDialog is better when you need custom copy explaining consequences.
5. The `cancelDelete` function in files was removed — ConfirmDialog handles cancel internally via `open = false`.

---

## session: Audit cleanup — tooltips, icons, eth0 fix, PageHeader migration, new components — 2026-03-26

**Purpose:** Cleared all pending audit items: tooltip coverage, icon additions, Button component adoption, hardcoded eth0 fix, PageHeader migration for 19 pages, and created ProgressBar + ConfirmDialog components.

**Insights:**

1. Docker page tooltips were already fixed in a prior session — the audit doc (`docs/audit-tooltips.md`) was stale. Always verify audit findings against current code before applying fixes.
2. PageHeader needed `icon` and `titleExtra` (Snippet) props to be viable for migration. Without icon support, only 5 of 24 pages could adopt it. Adding 2 props enabled all 19 remaining migrations.
3. Converting native `<button class="btn-*">` to `<Button>` component eliminated 15-30 lines of duplicated CSS per page. The `confirm`/`confirmText` props replaced hand-rolled confirm state management (e.g., WoL's `confirmDeleteId` pattern with 3 extra buttons).
4. The eth0 fix in `api/system/+server.ts:62` was a one-line change — the `iface` variable from `getPrimaryInterface()` was already in scope but the Linux branch hardcoded `eth0|ens|wlan0` instead of using it.
5. Running 3 PageHeader migration agents in parallel saved significant time — each agent handled 5-7 pages independently. No merge conflicts since they touched different files.
6. ProgressBar's `colorThresholds` prop uses ascending threshold matching (last threshold where `pct >= value` wins) — intuitive for "danger zone" patterns (green → yellow → red).

---

## session: Migrate tasks, processes, peripherals, databases, internals, backups, ports to PageHeader — 2026-03-26

**Purpose:** Replaced inline page header markup with the shared `PageHeader` component across 7 more pages.

**Insights:**

1. When a page wraps its content in a `<div class="page">` container (internals, ports), `PageHeader` must be placed outside that wrapper so it isn't constrained by the container's padding or max-width.
2. The `{#snippet titleExtra()}` slot handles conditional in-title content cleanly (e.g. scheduledCount badge in tasks) without extra wrapper divs.
3. The `<div class="controls">` wrapper used in several pages becomes a redundant CSS class once its children are moved into the `{#snippet children()}` slot — remove the class from CSS too, not just the HTML.
4. Pages without any action buttons (ports) can use the self-closing form `<PageHeader ... />` with no children block.
5. Prettier reported most files unchanged after edits, confirming the snippet syntax was already conformant with project style.

---

## session: Migrate lights, tailscale, packets, bookmarks, keeper, dns to PageHeader — 2026-03-26

**Purpose:** Replaced inline `page-header-bar` / `h2.page-title` / `p.page-desc` header markup in six more pages with the shared `PageHeader` component.

**Insights:**

1. `/lights` used an inline `<span class="bulb-count">` badge next to the title — put it in the `{#snippet titleExtra()}` slot rather than `titleExtra` prop since it's conditional markup; the CSS class for `.bulb-count` is kept because it styles that snippet content.
2. `/packets` had a live-indicator (`live-dot` + `live-label`) inside `.header-actions` — these moved into the `children` slot of PageHeader cleanly; the `.header-actions` wrapper div and `h2` CSS rule were removed.
3. `/dns` already had `PageHeader` imported but still used bare `h2.page-title` + `p.page-desc` — needed only a template-level swap, no import change. Also removed the now-unused `h1` CSS rule.
4. `/keeper` controls included a `<label class="toggle-completed">` checkbox alongside buttons — moved the whole thing directly into the `children` slot; the `.controls` flex wrapper CSS was removed but `.toggle-completed` CSS was kept because it still styles the label.
5. Prettier reported all 6 files `(unchanged)` confirming edits were already conformant.

---

## session: Migrate 6 pages to PageHeader component — 2026-03-26

**Purpose:** Replaced inline header markup (`page-header`, `page-header-bar`, `page-title`, `header-actions`) in docker, services, wol, screenshots, benchmarks, and wifi pages with the shared `PageHeader` component.

**Insights:**

1. The `PageHeader` component uses named snippets (`titleExtra` for badges next to the title, `children` for action buttons on the right) — the default slot is the children actions, not the whole content.
2. `/wifi/+page.svelte` has no wrapper `<div class="page">` — the PageHeader is placed directly at the root without a container element; removing `.header-actions` and `h2` CSS was safe since those selectors were header-exclusive.
3. `/screenshots` had a `capture-controls` div that needed to move inside the PageHeader children slot as-is — it already has its own CSS class so no styles were lost.
4. Prettier reported all 6 files as `(unchanged)` after edits, confirming the formatting was already conformant with the project's prettier config.
5. CSS blocks to remove: only remove `.page-header`, `.page-header-bar`, `.page-title` (and `.page-title h1`), `.header-actions` if not used by other elements. `.auto-toggle` in wifi was kept because it's still used by the inline checkboxes rendered inside the PageHeader children slot.

---

## session: Add SettingsPanel and CronBuilder to showcase — 2026-03-26

**Purpose:** Added demo sections for SettingsPanel and CronBuilder components to the UI showcase page.

**Insights:**

1. SettingsPanel uses `open = $bindable(false)` prop — fits naturally in the "Modals & Overlays" section since it's a slide-over panel
2. CronBuilder takes `value: string | null` and `onchange` callback — null means disabled; it parses the initial cron string to set frequency/fields
3. The showcase page is ~1200 lines with distinct sections; new components slot in cleanly as new `demo-block` divs or new `section` elements
4. No `.demo-block` CSS class is defined in the page styles — it must be inherited from global styles or the Card component pattern

---

## session: Wire useShortcuts to 13 pages — 2026-03-26

**Purpose:** Added `useShortcuts()` calls to all pages that have shortcut definitions in `SHORTCUT_DEFAULTS` but were missing the runtime wiring.

**Insights:**

1. SearchInput component exposes `inputEl` via `$bindable` — use `bind:inputEl={ref}` to get the underlying `<input>` for programmatic `.focus()`.
2. When `onMount` is `async` (terminal page), the return value is ignored by Svelte — must store cleanup in a variable and call it in `onDestroy` manually.
3. The pattern `{ ...SHORTCUT_DEFAULTS.find(d => d.id === 'x')!, handler: () => fn() }` is the cleanest way to spread the ShortcutDef and attach a handler.
4. WiFi page has no search input — `wifi:focus-search` shortcut defined but not wired since there's no UI target. Could add a search feature later.
5. Docker page's onMount was originally `async` for the refresh call — refactored to IIFE inside sync onMount so `useShortcuts` cleanup return works.

---

## session: Android readiness research — 2026-03-26

**Purpose:** Researched PWA, helper APK, and hybrid approaches for Android support, producing a comprehensive research document.

**Insights:**

1. The app already has a partial PWA foundation — `manifest.json`, `static/sw.js`, Apple mobile web app meta tags, and SW registration in `app.html`. This is roughly 70% of what is needed.
2. The biggest manifest gap is icons: only a single SVG is provided. Android requires multiple PNG sizes (192, 512) with maskable variants for proper install/splash behavior.
3. The current `static/sw.js` is hand-rolled and minimal. SvelteKit natively supports `src/service-worker.ts` with access to build manifest arrays (`$service-worker` module) — migrating there gives versioned precaching for free without adding `@vite-pwa/sveltekit`.
4. Android Chrome PWA support in 2025-2026 is very strong: push notifications, Web Bluetooth, Web NFC, share target, shortcuts, badging, camera/mic, wake lock all work. The remaining gaps (persistent background service, widgets, mDNS discovery) are niche for this app.
5. 14 pages use polling-based auto-refresh (`setInterval`), and 2 pages use WebSocket. All require active network — offline mode has very limited utility for a server management dashboard.
6. 29 files already have `@media` responsive breakpoints (37 total queries), so mobile layout is partially addressed but would need a systematic audit across all 37 pages.

---

## session: Linux compatibility audit — 2026-03-26

**Purpose:** Full audit of all server-side files for Linux/Raspberry Pi compatibility, producing a detailed readiness report.

**Insights:**

1. The codebase is overwhelmingly Linux-ready — 18 of 30 shell-command files have proper `os.platform()` branching with tested Linux paths.
2. One functional bug found: `api/system/+server.ts:62` hardcodes `eth0|ens|wlan0` in an awk pattern for the Linux network throughput path instead of using the already-imported `getPrimaryInterface()`. The layout server version of the same logic (`+layout.server.ts:113`) does it correctly via `/sys/class/net/${iface}/statistics/`.
3. `src/lib/server/messages.ts` (iMessage) and `src/routes/api/apps/icon/[name]/+server.ts` are intentionally macOS-only and handle Linux gracefully (return empty/404).
4. Task templates (`src/routes/tasks/templates.ts`) contain some macOS-only commands as user-facing suggestions — most already have `||` fallback patterns, but `system_profiler` and `pmset` templates do not.
5. All `execSync` calls use either try/catch or `2>/dev/null` for graceful degradation — no crash-on-missing-command scenarios found.

---

## session: CSS cleanup — deduplicate .header and add .card-padded — 2026-03-26

**Purpose:** Extracted duplicated `.header` CSS into a global `.page-header-bar` utility and added a `.card-padded` utility to replace local `.card` padding overrides.

**Insights:**

1. 14 page files had local `.header` CSS blocks; 9 were exact duplicates, 5 had extra properties (flex-wrap, gap, different margin-bottom) that needed local overrides.
2. Files using `margin-bottom: 1.5rem` instead of `16px` needed a local `.page-header-bar` override to preserve the different spacing.
3. The global `.card` already defines background, border, border-radius, and box-shadow; local `.card` blocks in services/docker were redundant except for `padding: 16px` and a slightly different `border-radius: 10px`.
4. Using `perl -0pe` with multiline regex is much faster than individual Edit calls when doing the same pattern replacement across many files.

---

## session: shared terminal sessions (multi-client fan-out + CLI attach) — 2026-03-24

**Purpose:** Added multi-client PTY fan-out so multiple browser tabs and a CLI script can share the same terminal session bidirectionally.

**Insights:**

1. **node-pty fires multiple onData listeners independently** — no broadcaster needed; each WS registers its own `term.onData(cb)` and all fire per PTY chunk. This is the cleanest multi-client architecture.
2. **Min-dims resize strategy needs debouncing** — `recalcDims()` is debounced 100ms to avoid PTY thrashing during browser window drag. Without debounce, rapid resize events create hundreds of PTY resize calls.
3. **Symbol tokens for client identity** — each WS connection gets a unique `Symbol('ws-client')` to register/deregister its dimensions. Symbols are guaranteed unique, avoiding ID collision.
4. **`session.label` getter/setter fires rename listeners** — renaming in any client (browser tab or CLI) propagates to all others via `onRename` events, without needing a separate Map of ws connections per session.
5. **CLI attach script uses `ws` from node_modules** — zero new dependencies. `createRequire(import.meta.url)` lets the ESM script require CJS modules.
6. **Port config written on `listening` event** — use `(server.httpServer?.address() as any)?.port` to get the actually-bound port (handles port collision fallback).

---

## session: v4.3→4.9 full sprint — 2026-03-23

**Purpose:** v4.2→v4.9: 19 roadmap items, 6 bug fixes, security 11/11, Linux 17/17, notes module, status page, 38 tests, collapsible sidebar, system notifications.

**Insights:**

1. **`display: contents` for responsive row splitting** — header-row wrappers with `display: contents` on desktop are invisible to flex. On mobile, `display: flex; width: 100%` stacks them. Zero desktop change.
2. **Icon fallback is silent** — missing ICON_MAP entries render HelpCircle (?) without warning. Always verify icon names exist before using.
3. **Svelte 5 runes require `.svelte.ts`** — `$state()` in plain `.ts` crashes SSR. Rename to `.svelte.ts`.
4. **`os.freemem()` bug in 3 places** — layout, health, status APIs all had it. Should share a `getMemPercent()` utility.
5. **Tests found 3 real bugs** — .svelte.ts rune issue, terminal PIN export crash, stale API response shapes.
6. **Single hamburger button** — mobile drawer and desktop collapse should be one button with viewport check, not two buttons.

---

## session: code cleanup sweep / arch-qa — 2026-03-23

**Purpose:** Systematic analysis of the codebase for cleanup opportunities — duplications, extractable patterns, and simplifications.

**Insights:**

1. Two OUI vendor lookup tables exist independently in wifi and network API routes (~350 duplicated lines). This is the single largest copy-paste debt.
2. `fetchApi` POST calls with JSON headers are repeated ~71 times across 26 page files — a `postJson` helper would be high-value, low-risk.
3. `app.css` is 1288 lines, with ~755 lines (59%) being theme variable definitions for 25 themes. This is working but makes the file unwieldy.
4. The `.page` CSS class is redefined locally in 14 page files with the same core layout (flex column, margin auto, gap). Global extraction is straightforward.
5. `isDockerInstalled()` (the `which` command pattern) is duplicated between `+page.server.ts` and `+server.ts` for docker, and the same pattern appears in 5 other files.
6. `catch (e: any)` appears in 30+ svelte files — the backend has `errorMessage()` in `$lib/server/errors.ts` but there's no client-side equivalent.

---

## session: v4.3–4.5 mega sprint — 2026-03-22

**Purpose:** Implemented v4.3 (19 items), fixed 6 persistent bugs, completed security hardening, then built v4.4 (DNS trace, port scanner, health API, tasks filter) and v4.5 (databases page, screenshots metadata, speed test external, theme expansion, files browse, log preview).

**Insights:**

1. **`sanitizeShellArg` stripped `/`** — the character blacklist included `/` which broke file paths. Removed it — `/` is a path separator, not a shell injection vector.
2. **SSE streaming for long operations** — port scanner "all 65535" mode uses `ReadableStream` with `text/event-stream`. Client reads with `response.body.getReader()` since `EventSource` doesn't support POST.
3. **macOS `vm_stat` for memory** — `os.freemem()` shows near-zero because macOS caches aggressively. Available = Free + Inactive + Purgeable + Speculative pages. Page size varies by architecture.
4. **`getPrimaryInterface()` pattern** — priority list of interface names by platform, then fallback to first non-internal IPv4. Covers 99% of cases.
5. **Terminal env filtering** — blacklist + pattern matching (`*_KEY`, `*_TOKEN`, `*SECRET*`, `*PASSWORD*`) for defense in depth on PTY environment.
6. **Svelte 5 `$state` in factory functions** — `createHistory` uses `$state` inside a factory which works because Svelte 5 runes are call-site reactive.

---

## session: Mega sprint v2.5.1 → v4.2.0 — 2026-03-22

**Purpose:** Complete ALL remaining roadmap items, iterate through 5 rounds of user feedback, build component library, add infrastructure (logging, security, testing, deployment).

**Insights:**

1. **Parallel agents are the key throughput multiplier** — 22+ background agents this session, each handling independent work (new pages, component migration, security, Linux support). The constraint is shared files (+layout.svelte, app.css, nav.ts) — only modify those from the main context
2. **Component library migration netted -1400 lines** — replacing inline buttons/badges/tabs across 21 pages with shared components. The `hs-` CSS prefix convention prevented conflicts during incremental migration
3. **lucide-svelte replaces custom SVG registry** — the Icon component now wraps lucide components via an ICON_MAP. This gives 1000+ icons from a maintained library instead of 68 hand-drawn SVGs. But lucide doesn't have brand icons (Docker, etc.) — those need custom additions
4. **`os.freemem()` is misleading on macOS** — reports near-zero because macOS caches aggressively. Use `vm_stat` for actual available memory
5. **`crypto.randomUUID()` and `navigator.clipboard.writeText()` fail on HTTP** — Tailscale serves over HTTP not HTTPS. Always provide fallbacks
6. **Terminal scrollback buffer has a rendering gap** — server stores last 5K chars and sends on reconnect, but xterm.js doesn't always render it correctly after resize. The `[Session restored]` message works but output history appears blank
7. **Test suite should be run before any more features** — 25 test files exist but haven't been validated against the running server. Establish baseline before adding complexity
8. **Error boundary is the missing piece** — client-side errors are invisible to the server. Adding a Svelte error boundary that POSTs to `/api/logs` would close this visibility gap permanently
9. **fetchApi adoption is only 30%** — 8 of ~28 pages use the multi-device wrapper. The rest still use raw `fetch()`, which means device switching only works for the migrated pages

---

## session: Remote access doc + Tailscale DNS troubleshooting — 2026-03-22

**Purpose:** Diagnosed why the home server wasn't accessible on mobile data (bare hostname DNS resolution failure), wrote `docs/remote-access.md`.

**Insights:**

1. Bare hostnames (`aakarshs-macbook-pro`) resolve via mDNS/Bonjour or local router DNS only — they fail on mobile data or any network outside the home LAN.
2. Tailscale MagicDNS hostname for this machine is `aakarshs-macbook-pro.tail905820.ts.net` — works from any network as long as Tailscale is connected.
3. The `tailscale` CLI isn't on PATH on this Mac — must use full path: `/Applications/Tailscale.app/Contents/MacOS/Tailscale`.
4. WebAuthn `rpId` requires a domain (not an IP), so the MagicDNS hostname is the correct access URL if biometric auth is ever implemented.

---

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
