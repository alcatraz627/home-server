# Skill Runtime Notes

Append-only log of skill run insights. Newest entries at top.

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
