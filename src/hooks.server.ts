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

  console.log(`${event.request.method} ${event.url.pathname} ${response.status} ${duration}ms`);

  return response;
};
