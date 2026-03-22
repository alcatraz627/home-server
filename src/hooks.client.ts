import type { HandleClientError } from '@sveltejs/kit';

/** Report client-side errors to the server log */
export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  const err = error as Error;

  // Don't report 404s
  if (status === 404) return;

  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: err?.message || message || 'Unknown client error',
        stack: err?.stack,
        url: event.url.pathname,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
  } catch {
    // If the report fails, don't cascade
  }
};

// Also catch unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: reason?.message || String(reason) || 'Unhandled promise rejection',
          stack: reason?.stack,
          url: window.location.pathname,
        }),
      });
    } catch {}
  });
}
