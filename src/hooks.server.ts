import type { Handle } from '@sveltejs/kit';
import { startScheduler } from '$lib/server/scheduler';
import { checkRateLimit, RATE_LIMITS } from '$lib/server/rate-limit';
import { createLogger } from '$lib/server/logger';

const log = createLogger('http');

// Start scheduler on first request (lazy init)
let schedulerStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!schedulerStarted) {
    schedulerStarted = true;
    startScheduler().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Scheduler failed to start', { error: message });
    });
  }

  // Rate limiting for expensive API endpoints
  const pathname = event.url.pathname;
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) {
      const clientIp = event.getClientAddress();
      const key = `${clientIp}:${prefix}`;
      const result = checkRateLimit(key, config.max, config.windowMs);

      if (result.limited) {
        log.warn('Rate limit exceeded', {
          ip: clientIp,
          endpoint: prefix,
          retryAfter: Math.ceil(result.resetIn / 1000),
        });
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(result.resetIn / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil(result.resetIn / 1000)),
            },
          },
        );
      }
      break;
    }
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

  // Structured request logging (skip static assets)
  if (pathname.startsWith('/api/') || (!pathname.includes('.') && pathname !== '/favicon.svg')) {
    log.info('request', {
      method: event.request.method,
      path: pathname,
      status: response.status,
      duration,
    });
  }

  return response;
};
