# Skill Runtime Notes

Append-only log of skill run insights. Newest entries at top.

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
