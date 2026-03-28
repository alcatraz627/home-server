/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `hs-cache-${version}`;
const OFFLINE_URL = '/offline';

// Assets to precache: build output (JS/CSS) + static files (icons, favicon, manifest)
const PRECACHE_ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_ASSETS);
      // Cache offline page separately (it's a SvelteKit route, not a static file)
      try {
        await cache.add(OFFLINE_URL);
      } catch {
        // Offline page may not be prerendered yet during first build — ignore
      }
    }),
  );
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-HTTP(S) requests (e.g., chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))),
    );
    return;
  }

  // Build assets (immutable JS/CSS): cache-first
  if (build.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => caches.match(OFFLINE_URL).then((cached) => cached || caches.match(request)) as Promise<Response>,
      ),
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      });
      return cached || networkFetch;
    }),
  );
});
