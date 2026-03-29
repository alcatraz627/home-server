/**
 * App-wide constants. version is updated after each change to verify
 * the browser is serving the latest build (shown in sidebar footer).
 *
 * Format: major.minor.patch-word-word-number
 * - major: breaking changes, large rewrites
 * - minor: new features, new widgets, new pages
 * - patch: bug fixes, tweaks, small improvements
 * - phrase: random word-word-number tag for quick visual verification
 */
export const APP = {
  title: 'Home Server',
  version: '4.59.0-offline-27',
} as const;
