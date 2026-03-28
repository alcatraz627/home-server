# Home Server — Agent Instructions

> SvelteKit 2 + Svelte 5 (Runes) fullstack dashboard for personal device/server management.
> Version: `4.22.1-swift-elm-9` | Node 20 | adapter-node | No CSS framework | No database

## Tech Stack

**Frontend**: Svelte 5 (Runes), SvelteKit 2, lucide-svelte icons, xterm.js terminal, epubjs reader
**Backend**: SvelteKit server routes, node-pty, node-cron, ws (WebSocket), mammoth (docx), xlsx
**Infra**: Docker (compose), Tailscale VPN, ntfy.sh push notifications, JSON file storage in `~/.home-server/`

## Directory Structure

```
src/
  app.css                  # Global styles, CSS custom properties, 25 themes
  hooks.server.ts          # Server hooks (security, CSRF)
  service-worker.ts        # PWA service worker
  lib/
    api.ts                 # fetchApi() wrapper for multi-device support
    components/            # 34 shared components (PageHeader, AsyncState, FilterBar, etc.)
    server/                # 27 domain modules (1 per feature — backups, terminal, keeper, etc.)
    constants/             # App version (APP.version in app.ts), config
    types/                 # Shared TypeScript types
    utils/                 # Client utilities
    renderers/             # File preview renderers
  routes/
    api/                   # API routes — thin wrappers around server modules
    <page>/                # 37+ pages (files, docker, lights, tasks, keeper, etc.)
      +page.svelte         # Page component (Svelte 5 runes)
      +page.server.ts      # SSR data load
      +server.ts           # API endpoint for client mutations
docs/
  pages/<name>.md          # Per-page specs (35 files) — READ before modifying a page
  architecture.md          # Server module pattern, data flow
  linux-support.md         # Cross-platform compatibility matrix
```

## Mandatory Rules

1. **Version bump**: After every change set, update `APP.version` in `src/lib/constants/app.ts`. Format: `major.minor.patch-word-word-number`. Print the new version at end of response.
2. **Cross-platform**: Both macOS + Linux paths (`os.platform()` checks). Wrap shell commands in try/catch. Read `docs/linux-support.md` first.
3. **Formatting**: Run `npx prettier --write` on changed `.ts`, `.svelte`, `.css` files. 2-space indent, single quotes, trailing commas, 120 char width.

## Component Patterns

Use shared components from `src/lib/components/` -- do not reinvent:

- **PageHeader**: Title + description + icon + action buttons. Use `{#snippet titleExtra()}` for badges, `{#snippet children()}` for actions.
- **AsyncState**: Replaces manual loading/error/empty tristate chains. Props: `loading`, `error`, `empty`. Inner `{#if data}` still needed for TypeScript narrowing.
- **FilterBar**: Single-row flex wrapper for filters/search. `search` prop for simple cases; use SearchInput as child when you need `bind:inputEl` or `debounce`.
- **Button**: Has `confirm`/`confirmText` props for inline confirmation. Use **ConfirmDialog** for modal confirmation with custom copy.
- **InfoRow**: Flex label-value pairs. `code` prop for monospace values. Not for CSS Grid layouts (breaks column alignment).
- **StatCard**, **DataChip**, **InteractiveChip**, **Tabs**, **ProgressBar**: Check `docs/audit-components.md` for usage.

## API / Backend Patterns

- **Server modules** (`src/lib/server/`): One file per domain. API routes are thin wrappers. No cross-imports between modules.
- **Data storage**: JSON files in `~/.home-server/`. File metadata as `.meta.json` sidecars. No database.
- **fetchApi()**: Use `$lib/api.ts` wrapper instead of raw `fetch('/api/...')` for multi-device support.
- **Logging**: `createLogger('module-name')` from `$lib/server/logger.ts`. Structured JSONL logs.
- **SSE streaming**: Long operations (port scan) use `ReadableStream` + `text/event-stream`. Client reads with `getReader()`, not `EventSource` (no POST support).
- **Cron scheduling**: `node-cron` via `$lib/server/scheduler.ts`. Min 1-minute granularity.

## Testing

No test framework configured. 25 test files exist but are not wired to a runner. Validate manually against the running server (`npm run dev`). Use `npm run check` for TypeScript/Svelte type checking.

## Key Gotchas (from 1000+ sessions)

1. **`os.freemem()` lies on macOS** -- reports near-zero due to aggressive caching. Use `vm_stat` to get actual available memory (Free + Inactive + Purgeable + Speculative pages).
2. **`+layout.server.ts` blocks ALL navigation** -- heavy computations in layout loads block every page transition. Use module-level cache with TTL for expensive operations.
3. **Svelte 5 runes require `.svelte.ts`** -- `$state()` in plain `.ts` files crashes SSR. Always use `.svelte.ts` extension for files containing runes.
4. **`crypto.randomUUID()` fails on HTTP** -- Tailscale serves over HTTP, not HTTPS. Always provide fallbacks for secure-context APIs.
5. **`sanitizeShellArg` must not strip `/`** -- it is a path separator, not a shell injection vector.
6. **Icon additions need both import AND map entry** -- `Icon.svelte` uses `ICON_MAP` lookup. Import from lucide-svelte and add lowercase key. Missing entries silently render HelpCircle.
7. **Grid layouts break with InfoRow** -- pages using `grid-template-columns` for label-value alignment cannot adopt flex-based InfoRow.
8. **`async onMount` loses cleanup** -- Svelte ignores the return value of async onMount. Store cleanup in a variable and call it in `onDestroy` manually.
9. **Audit docs go stale** -- always verify audit findings against current code before applying. Prior sessions may have already fixed items.
10. **Parallel agents conflict on shared files** -- `+layout.svelte`, `app.css`, `nav.ts` are shared. Only modify these from the main context.

## Doc Index (read on demand)

| Category | Docs |
|----------|------|
| Architecture | `docs/architecture.md`, `docs/api-reference.md`, `docs/security.md`, `docs/deployment.md` |
| UI/Components | `docs/audit-components.md`, `docs/audit-icons.md`, `docs/audit-tooltips.md`, `docs/widgets.md` |
| Per-page specs | `docs/pages/<name>.md` (35 files) |
| Roadmap | `docs/roadmap.md`, `docs/code-cleanup-plan.md`, `docs/page-merge-audit.md` |
| Research | `docs/research-android-readiness.md`, `docs/decentralization.md`, `docs/auth-implementation.md` |
| Runtime notes | `.claude/skills/runtime-notes.md` -- append-only log of session insights (1000+ entries) |
