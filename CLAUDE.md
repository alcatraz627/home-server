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
