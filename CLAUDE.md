# Home Server — Agent Instructions

## Build Version Tag

After making any change, update `APP.version` in `src/lib/constants/app.ts`.

**Format:** `major.minor.patch-word-word-number`

**Versioning rules:**
- **major**: Breaking changes, large rewrites, architectural shifts
- **minor**: New features, new widgets, new pages, new API endpoints
- **patch**: Bug fixes, tweaks, small UI improvements, config changes
- **phrase**: Random `word-word-number` tag (e.g., `crisp-sage-42`, `bold-fern-7`) — pick a new random one each time

**When to update:**
- After every set of changes, before finishing your response
- Determine which semantic number to bump based on the scope of changes
- Reset patch to 0 when bumping minor; reset minor and patch to 0 when bumping major

**Output requirement:**
- Print the new version string at the end of your response so the user can verify the browser matches

**Do not update** if no files were modified.

## Cross-Platform Support (macOS + Linux)

This project must work on both macOS and Linux (including Raspberry Pi / ARM).

**Before adding or modifying any feature that uses system commands:**

1. Read `docs/linux-support.md` — it has the full inventory of platform-specific code, Linux equivalents, and required patterns.
2. Implement both macOS and Linux code paths using `os.platform()` checks.
3. Wrap system commands in try/catch — return empty/null on failure, never crash.
4. Use the shared patterns documented there (platform-gated execution, dynamic interface detection, graceful degradation).
5. After changes, update the compatibility matrix and tech debt backlog in `docs/linux-support.md`.

**Never** add a macOS-only system command without a Linux fallback or an explicit `// TODO: Linux support` with an entry in the tech debt backlog.

## Code Formatting

After editing any `.ts`, `.svelte`, or `.css` files, run `npx prettier --write` on the changed files before committing. The project uses Prettier with `prettier-plugin-svelte`.

**Key settings:** 2-space indent (no tabs), single quotes, trailing commas, 120 char print width.

A pre-commit hook automatically formats staged files, but always verify formatting is clean before committing.
