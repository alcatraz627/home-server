/**
 * Simple in-memory rate limiter.
 * Tracks request counts per IP per window.
 */

import { RATE_LIMITER_CLEANUP_INTERVAL_MS } from '$lib/constants/limits';

interface RateWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateWindow>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of store) {
    if (now > window.resetAt) store.delete(key);
  }
}, RATE_LIMITER_CLEANUP_INTERVAL_MS);

/**
 * Check if a request should be rate-limited.
 * @returns { limited: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: maxRequests - 1, resetIn: windowMs };
  }

  existing.count++;
  const remaining = Math.max(0, maxRequests - existing.count);
  const resetIn = existing.resetAt - now;

  if (existing.count > maxRequests) {
    return { limited: true, remaining: 0, resetIn };
  }

  return { limited: false, remaining, resetIn };
}

/**
 * Rate limit configurations for expensive endpoints.
 */
export const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/network': { max: 30, windowMs: 60_000 }, // 30 req/min
  '/api/ports': { max: 10, windowMs: 60_000 }, // 10 req/min
  '/api/ai/chat': { max: 20, windowMs: 60_000 }, // 20 req/min
  '/api/speedtest': { max: 15, windowMs: 60_000 }, // 15 req/min
  '/api/dns/trace': { max: 15, windowMs: 60_000 }, // 15 req/min
  '/api/packets': { max: 5, windowMs: 60_000 }, // 5 req/min
  '/api/benchmarks': { max: 10, windowMs: 300_000 }, // 10 per 5min
  '/api/databases': { max: 30, windowMs: 60_000 }, // 30 req/min
};
