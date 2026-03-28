# Code Cleanup Plan

Comprehensive code cleanup sweep identifying duplications, extraction opportunities, and simplifications.
Each item is scoped to be a modest change with clear benefit. Ordered by impact.

---

## 1. Extract Shared OUI Vendor Lookup Table

**Problem:** Two separate OUI (MAC vendor) lookup tables exist — one in `src/routes/api/wifi/+server.ts` (lines 51-150, ~100 entries as `OUI_TABLE`) and another in `src/routes/api/network/+server.ts` (lines 10-252, ~240 entries as `OUI_MAP`). They overlap but each has unique entries. Each file also has its own `lookupVendor()` function.

**Change:** Create `src/lib/server/oui.ts` that:

- Merges both tables into a single `OUI_MAP: Record<string, string>`
- Exports a single `lookupVendor(mac: string): string` function (normalize to lowercase, take first 8 chars)
- Both API files import from the shared module

**Files to modify:**

- Create: `src/lib/server/oui.ts`
- Edit: `src/routes/api/wifi/+server.ts` — remove `OUI_TABLE` and `lookupVendor`, import from `$lib/server/oui`
- Edit: `src/routes/api/network/+server.ts` — remove `OUI_MAP` and `lookupVendor`, import from `$lib/server/oui`

**Benefit:** Eliminates ~350 lines of duplication. Single source of truth for vendor data. Easy to extend later.

---

## 2. Add `postJson` Helper to `fetchApi`

**Problem:** Across 26+ Svelte page files, the same boilerplate appears ~71 times:

```ts
await fetchApi('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});
```

The `headers: { 'Content-Type': 'application/json' }` is repeated verbatim in every single POST call.

**Change:** Add a `postJson` helper to `src/lib/api.ts`:

```ts
export async function postJson(path: string, data: unknown, init?: RequestInit): Promise<Response> {
  return fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...init,
  });
}
```

Then replace all occurrences in `.svelte` files. E.g.:

```ts
// Before
await fetchApi('/api/docker', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, id }),
});

// After
await postJson('/api/docker', { action, id });
```

**Files to modify:**

- Edit: `src/lib/api.ts` — add `postJson` export
- Edit: All 26 Svelte files that use `fetchApi` with POST + JSON (see list below)

**Affected page files:** clipboard, services, notifications, lights, docker, packets, apps, ports, kanban, bookmarks, backups, tasks, notes, keeper, databases, benchmarks, network, dns, dns-trace, peripherals, wol, screenshots, wifi, terminal, speedtest, processes

**Benefit:** Eliminates ~200 lines of boilerplate. Every POST call becomes a one-liner. Consistent content-type handling.

---

## 3. Deduplicate `.page` CSS Class Across Pages

**Problem:** 14 page files define a `.page { ... }` CSS class in their `<style>` blocks. They all share the same core structure:

```css
.page {
  padding: 1.5rem; /* varies: some omit */
  max-width: 900px; /* varies: 700-1100px */
  margin: 0 auto;
  display: flex; /* some include */
  flex-direction: column; /* some include */
  gap: 16px; /* some include */
}
```

**Change:** Add a global `.page` utility class to `src/app.css`:

```css
.page {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-sm {
  max-width: 700px;
}
.page-lg {
  max-width: 1100px;
}
```

Then remove the local `.page` styles from each page file and use the global class with modifiers:

- `class="page"` for standard (900px)
- `class="page page-sm"` for narrow pages (clipboard: 700px)
- `class="page page-lg"` for wide pages (docker, services: 1100px)

**Files to modify:**

- Edit: `src/app.css` — add `.page`, `.page-sm`, `.page-lg`
- Edit 14 page files to remove local `.page` style blocks:
  clipboard, services, notifications, docker, bookmarks, benchmarks, qr, dns, ports, kanban, wol, screenshots, dns-trace, speedtest

**Benefit:** Removes ~60 lines of duplicated CSS. Consistent page layout. Easy to adjust globally.

---

## 4. Deduplicate `.header` CSS Class Across Pages

**Problem:** At least 8 page files define an identical `.header` CSS class:

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
```

Note: a `PageHeader` component already exists at `src/lib/components/PageHeader.svelte` and some pages use it. But many pages still use a custom `.header` div.

**Change:** Add a global `.page-header-bar` utility class to `src/app.css`:

```css
.page-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
```

Then replace local `.header` styles with the global class. Pages that need truly custom headers can still override.

**Files to modify:**

- Edit: `src/app.css` — add `.page-header-bar`
- Edit 8 page files: lights, backups, tailscale, peripherals, keeper, benchmarks, network, screenshots

**Benefit:** Removes ~40 lines of duplicated CSS. Consistent header layout.

---

## 5. Extract Shared TypeScript Interfaces to `$lib/types.ts`

**Problem:** Several interfaces are defined in both the API route (`+server.ts`) and the consuming page (`+page.svelte`), duplicated and potentially drifting:

- `WifiNetwork` — defined in `api/wifi/+server.ts` AND `wifi/+page.svelte` AND `peripherals/+page.svelte`
- `DockerContainer` — defined in `api/docker/+server.ts` AND `docker/+page.svelte`
- `TracerouteHop`, `ArpEntry`, `SSLCertInfo`, `InterfaceStats` — defined in `api/network/+server.ts` AND `network/+page.svelte`

**Change:** Move shared data interfaces to `src/lib/types/` files organized by domain:

- Create `src/lib/types/wifi.ts` — export `WifiNetwork`, `CurrentConnection`
- Create `src/lib/types/docker.ts` — export `DockerContainer`
- Create `src/lib/types/network.ts` — export `TracerouteHop`, `ArpEntry`, `SSLCertInfo`, `InterfaceStats`, `HttpInspection`, `PingResult`, `BandwidthSample`

Then import from the shared location in both the API route and the page component.

**Files to modify:**

- Create: `src/lib/types/wifi.ts`, `src/lib/types/docker.ts`, `src/lib/types/network.ts`
- Edit existing `src/lib/types.ts` — add re-exports or keep as-is
- Edit: `src/routes/api/wifi/+server.ts`, `src/routes/wifi/+page.svelte`, `src/routes/peripherals/+page.svelte`
- Edit: `src/routes/api/docker/+server.ts`, `src/routes/docker/+page.svelte`
- Edit: `src/routes/api/network/+server.ts`, `src/routes/network/+page.svelte`

**Benefit:** Single source of truth for data shapes. Type changes propagate automatically. Prevents drift between API and UI.

---

## 6. Extract `isCommandAvailable()` Utility

**Problem:** The pattern `execSync('which <cmd>')` wrapped in try/catch is used in multiple server files:

- `docker/+page.server.ts` — `isDockerInstalled()`
- `api/docker/+server.ts` — `isDockerInstalled()` (duplicated!)
- `api/keeper/+server.ts` — checks for `which claude`
- `api/peripherals/+server.ts` — checks for `which blueutil`, `which bluetoothctl`
- `lib/server/backups.ts` — checks for `which rsync`

**Change:** Add to `src/lib/server/security.ts` (or a new `src/lib/server/system.ts`):

```ts
export function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', timeout: 3000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

Then replace all `isDockerInstalled()` and inline `which` checks.

**Files to modify:**

- Edit: `src/lib/server/security.ts` (or create `src/lib/server/system.ts`)
- Edit: `src/routes/docker/+page.server.ts` — use `isCommandAvailable('docker')`
- Edit: `src/routes/api/docker/+server.ts` — remove local `isDockerInstalled`, import shared
- Edit: `src/routes/api/keeper/+server.ts` — use `isCommandAvailable('claude')`
- Edit: `src/routes/api/peripherals/+server.ts` — use `isCommandAvailable('blueutil')` etc.
- Edit: `src/lib/server/backups.ts` — use `isCommandAvailable('rsync')`

**Benefit:** Eliminates 5 duplicated implementations. Consistent timeout and error handling.

---

## 7. Replace `catch (e: any)` With Typed Error Handling

**Problem:** 30+ files use `catch (e: any)` followed by `e.message`. This is an unsafe `any` type that bypasses TypeScript's type checking. The project already has `errorMessage()` in `src/lib/server/errors.ts` for the backend, but the frontend pages don't use it.

**Change:** Create a client-side error utility in `src/lib/errors.ts`:

```ts
/** Extract error message from unknown caught value */
export function getErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
```

Then replace all `catch (e: any) { toast.error(e.message) }` with `catch (e: unknown) { toast.error(getErrorMessage(e)) }`.

**Files to modify:**

- Create: `src/lib/errors.ts` (client-side variant)
- Edit: All 30 affected `.svelte` files (see the list from the analysis — lights, backups, tailscale, logs, apps, qr, ports, packets, peripherals, speedtest, processes, wifi, etc.)

**Benefit:** Type-safe error handling. No more `any` types. Consistent fallback messages. Crashes from non-Error throws (e.g., string throws) are prevented.

---

## 8. Simplify Theme CSS With CSS Custom Property Generation

**Problem:** `src/app.css` is 1288 lines, and ~755 lines (lines 1-755) are nothing but theme variable definitions. There are 25 themes, each defining the same 25 CSS custom properties. This is 625 individual property declarations that are highly repetitive.

**Change:** Extract theme definitions to a JSON/JS data file and generate the CSS at build time:

- Create `src/themes.ts` — export an array of `{ id, vars: { bg-primary, bg-secondary, ... } }` objects
- Create a build script `scripts/generate-themes.ts` that reads the data and writes `src/theme-vars.css`
- Import `src/theme-vars.css` in `src/app.css` (replacing the inline theme blocks)
- Alternatively, generate the CSS inline via a Vite plugin at build time

**Simpler alternative:** If build-time generation feels heavy, at minimum convert to a single SCSS/PostCSS mixin that each theme calls with its values. But given this is a Vite + SvelteKit project without a preprocessor, the JS generation approach is cleaner.

**Simplest alternative (lowest effort):** Leave the CSS as-is but add a code comment header and a note in CLAUDE.md: "theme vars are generated, do not edit manually." Then maintain a `src/lib/theme-data.ts` that is the source of truth, and the CSS is regenerated from it. This at least centralizes the data even if the CSS is committed.

**Files to modify:**

- Create: `src/lib/theme-data.ts` or `scripts/generate-theme-css.ts`
- Edit: `src/app.css` — replace 755 lines of theme vars with an `@import` or generated block
- Edit: `package.json` — add a `generate:themes` script

**Benefit:** Reduces `app.css` by ~750 lines. Adding a new theme becomes adding one JS object instead of 25 CSS lines. Prevents typos and inconsistencies in theme definitions. The `THEME_SWATCHES` in `theme.ts` can also be auto-derived.

**Risk note:** This is the largest-scope item. If it feels like over-engineering, skip it and live with the verbose CSS. The themes work correctly as-is.

---

## 9. Add Global `.card-inline` Style for Inline Cards

**Problem:** Two page files (services, docker) define the same local `.card` class:

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}
```

This conflicts with and duplicates the global `.card` class in `app.css` (which only sets background, border, border-radius, box-shadow but not padding).

**Change:** The global `.card` in `app.css` already provides background + border + border-radius + shadow. Add a `.card-padded` utility:

```css
.card-padded {
  padding: 16px;
}
```

Then in services and docker pages, replace `class="card"` with `class="card card-padded"` and remove the local `.card` style.

Alternatively, these pages could use the `<Card>` component which already handles padding via the `padding` prop.

**Files to modify:**

- Edit: `src/app.css` — add `.card-padded`
- Edit: `src/routes/services/+page.svelte` — remove local `.card` style, add global class
- Edit: `src/routes/docker/+page.svelte` — remove local `.card` style, add global class

**Benefit:** Small but prevents style drift. Encourages using the existing Card component.

---

## 10. Consolidate Auto-Refresh Pattern

**Problem:** Four pages implement auto-refresh with nearly identical boilerplate:

- `clipboard/+page.svelte` — `autoRefresh` state, setInterval, clearInterval, cleanup
- `wifi/+page.svelte` — same pattern
- `processes/+page.svelte` — same pattern
- `services/+page.svelte` — similar timer pattern

Each does: toggle boolean, start/stop interval, cleanup on destroy.

**Change:** Create a reusable auto-refresh utility in `src/lib/auto-refresh.svelte.ts`:

```ts
export function createAutoRefresh(callback: () => Promise<void>, intervalMs = 10000) {
  let active = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    stop();
    timer = setInterval(callback, intervalMs);
    active = true;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    active = false;
  }

  function toggle() {
    if (active) stop();
    else start();
  }

  // Cleanup when owning component is destroyed
  $effect(() => () => stop());

  return {
    get active() {
      return active;
    },
    start,
    stop,
    toggle,
  };
}
```

Then each page replaces its manual interval management with:

```ts
const autoRefresh = createAutoRefresh(fetchData, 10000);
```

**Files to modify:**

- Create: `src/lib/auto-refresh.svelte.ts`
- Edit: `src/routes/clipboard/+page.svelte` — use `createAutoRefresh`
- Edit: `src/routes/wifi/+page.svelte` — use `createAutoRefresh`
- Edit: `src/routes/processes/+page.svelte` — use `createAutoRefresh`
- Edit: `src/routes/services/+page.svelte` — use `createAutoRefresh`

**Benefit:** Removes ~60 lines of duplicated interval management. Guarantees cleanup. Consistent auto-refresh UX.

---

## 11. Consolidate Sort Logic Across Table Pages

**Problem:** Four pages implement table sorting with nearly identical boilerplate:

- `wifi/+page.svelte` — `sortKey`, `sortDir`, `toggleSort()`, `sortIndicator()`, sorted `$derived`
- `ports/+page.svelte` — same pattern
- `processes/+page.svelte` — same pattern
- `files/+page.svelte` — same pattern

Each page has ~20-25 lines of the same sorting logic.

**Change:** Create `src/lib/sort.svelte.ts`:

```ts
export function createTableSort<T>(defaultKey: keyof T, defaultDir: 'asc' | 'desc' = 'asc') {
  let key = $state(defaultKey);
  let dir = $state(defaultDir);

  function toggle(newKey: keyof T) {
    if (key === newKey) {
      dir = dir === 'asc' ? 'desc' : 'asc';
    } else {
      key = newKey;
      dir = 'asc';
    }
  }

  function indicator(k: keyof T): string {
    if (key !== k) return '';
    return dir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function sorted(items: T[]): T[] {
    return [...items].sort((a, b) => {
      let av: any = a[key],
        bv: any = b[key];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return {
    get key() {
      return key;
    },
    get dir() {
      return dir;
    },
    toggle,
    indicator,
    sorted,
  };
}
```

**Files to modify:**

- Create: `src/lib/sort.svelte.ts`
- Edit: `src/routes/wifi/+page.svelte` — use `createTableSort`
- Edit: `src/routes/ports/+page.svelte` — use `createTableSort`
- Edit: `src/routes/processes/+page.svelte` — use `createTableSort`
- Edit: `src/routes/files/+page.svelte` — use `createTableSort`

**Benefit:** Removes ~80 lines of duplicated sorting logic. Consistent sort behavior and indicators.

---

## Summary Table

| #   | Change                                      | Lines Saved     | Files Touched | Risk   | Status                                                                                                                                             |
| --- | ------------------------------------------- | --------------- | ------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | OUI vendor table extraction                 | ~350            | 3             | Low    | **Done** (v4.23) — `src/lib/server/oui.ts` created                                                                                                 |
| 2   | `postJson` helper                           | ~200            | 27            | Low    | **Done** (v4.23) — added to `src/lib/api.ts`. Extended (v4.38) with `putJson`, `patchJson`, `deleteJson` — all HTTP mutation helpers now unified.    |
| 3   | Global `.page` CSS class                    | ~60             | 15            | Low    | **Done** (v4.32) — added `padding: 1.5rem` to global `.page` in `app.css`, removed local overrides from 12 pages                                   |
| 4   | Global `.page-header-bar` CSS               | ~40             | 9             | Low    | **Done** (v4.32) — `.page-header-bar` already existed in `app.css`; no pages had local duplicates remaining                                        |
| 5   | Shared TypeScript interfaces                | ~120            | 10            | Low    | **Done** (v4.24) — `src/lib/types/wifi.ts`, `docker.ts`, `network.ts`                                                                              |
| 6   | `isCommandAvailable()` utility              | ~30             | 6             | Low    | **Done** (pre-v4.31) — `isCommandAvailable()` in `security.ts`, all API routes already import it                                                   |
| 7   | Typed error handling (`catch (e: unknown)`) | ~0 (same lines) | 30            | Low    | **Done** (v4.24) — `src/lib/errors.ts` with `getErrorMessage()`                                                                                    |
| 8   | Theme CSS generation                        | ~750            | 3+            | Medium | Pending (optional)                                                                                                                                 |
| 9   | Global `.card-padded` utility               | ~10             | 3             | Low    | **Done** (v4.32) — local `.card` overrides removed during page-merge extraction to tab components                                                  |
| 10  | Auto-refresh utility                        | ~60             | 5             | Low    | **Done** — utility in `src/lib/auto-refresh.svelte.ts`, adopted on 4 pages. Remaining pages use non-standard patterns (poll-until-done, per-entity, user-toggled) that don't fit the utility. |
| 11  | Table sort utility                          | ~80             | 5             | Low    | **Done** (v4.25) — `src/lib/sort.svelte.ts` created                                                                                                |

**Remaining items:** 8 (optional, medium effort — theme CSS generation).

Items 1–7, 9–11 are complete. Only item 8 (theme CSS generation) remains and is optional. As of v4.38, all client-side HTTP mutation helpers are fully unified: `postJson`, `putJson`, `patchJson`, and `deleteJson`.

---

## What NOT to Abstract

The following patterns were considered but intentionally left alone:

- **Per-page fetch+load patterns** — Each page's data loading is slightly different (error handling, multiple endpoints, conditional logic). A generic "useFetch" hook would be over-abstraction for a SvelteKit app where `+page.server.ts` already handles SSR data loading.
- **Individual page layouts** — While pages share some structure, each has unique content sections. A generic "page wrapper" component would be too rigid.
- **Per-page `<style>` blocks** — Beyond the specific classes called out above (`.page`, `.header`, `.card`), most per-page styles are genuinely unique and should stay local.
- **Toast calls** — Each toast message is unique; the `toast.*()` API is already clean.
- **Component imports** — Most pages import 3-6 components. A barrel export would save 1-2 lines per page but make tree-shaking harder to reason about.
