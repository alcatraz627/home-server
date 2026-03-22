# Indexing Notes

Append-only log of every `/project-index` run. Newest entries are at the bottom.
Each entry captures a dated summary of what changed vs the previous run.

---

## Run: 2026-03-21 — First full scan of home-server project

### What was scanned

- Full scan of all source files, configuration, dependencies, and architecture
- 54 source files across src/, static/, and root config files
- 8 server modules, 5 document renderers, 8 page routes, 9 API endpoint groups

### Changes since last run

- First run — no previous index to compare against

### Notable findings

- **No database**: All persistence is JSON files in ~/.home-server/ — simple but may not scale if history grows large
- **Svelte 5 Runes**: Project uses the newest Svelte reactivity model ($state, $derived, $effect, $props)
- **No authentication layer**: Security relies entirely on Tailscale VPN network isolation
- **Clean server module separation**: Each domain has exactly one file in src/lib/server/ with no cross-imports
- **Plugin-style renderer registry**: Adding new file format support requires only implementing DocumentRenderer interface
- **Two-tier process stats**: Smart split between cheap passive data and expensive active inspection
- **Version tagging convention**: major.minor.patch-word-word-number format, must be updated after every change
- **@types packages in production deps**: @types/node-cron and @types/ws are in dependencies instead of devDependencies

### Files updated this run

- `.claude/project-index.md` — created
- `.claude/indexing-notes.md` — created (this entry)
