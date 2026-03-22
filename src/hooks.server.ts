import type { Handle } from '@sveltejs/kit';
import { startScheduler } from '$lib/server/scheduler';

// Start scheduler on first request (lazy init)
let schedulerStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!schedulerStarted) {
    schedulerStarted = true;
    startScheduler().catch((err) => console.error('Scheduler failed to start:', err));
  }

  const start = Date.now();
  const response = await resolve(event);
  const duration = Date.now() - start;

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  console.log(`${event.request.method} ${event.url.pathname} ${response.status} ${duration}ms`);

  return response;
};
