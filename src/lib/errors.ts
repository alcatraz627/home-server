/** Extract a human-readable error message from an unknown caught value. */
export function getErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
