/** Extract a safe error message from an unknown caught value */
export function errorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

/** Extract error code (e.g., ENOENT) from an unknown caught value */
export function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as any).code);
  return '';
}
