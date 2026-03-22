import path from 'node:path';

/**
 * Security utilities for input sanitization and validation.
 * Apply these to all API endpoints that handle user-supplied paths,
 * shell arguments, or POST bodies.
 */

/**
 * Resolve a user-supplied path and validate it stays within the given base directory.
 * Prevents directory traversal attacks (../../etc/passwd).
 *
 * @throws Error if the resolved path escapes basePath
 */
export function sanitizePath(userPath: string, basePath: string): string {
  const resolvedBase = path.resolve(basePath);
  const resolved = path.resolve(resolvedBase, userPath);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`Path traversal detected: "${userPath}" escapes base directory`);
  }
  return resolved;
}

/**
 * Strip characters that could enable shell injection from a user-supplied argument.
 * Removes: ; | ` $ ( ) { } < > & \n \r
 *
 * Use this when passing user input to execSync/spawn as part of a command string.
 * Prefer spawn with an args array over execSync when possible.
 */
export function sanitizeShellArg(arg: string): string {
  return arg.replace(/[;|`$(){}<>&\n\r\\]/g, '');
}

/**
 * Validate that all required fields exist (are not undefined/null/empty-string) on a body object.
 *
 * @throws Error listing the missing fields
 */
export function validateRequired(body: any, fields: string[]): void {
  if (!body || typeof body !== 'object') {
    throw new Error(`Request body is required`);
  }
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}
