/* ── DegenFeed Service Worker ────────────────────────────────
 *  Cache-first for static assets, stale-while-revalidate for
 *  navigation & API calls, network-only for POST.
 *  Offline fallback page when no cached response exists.
 *  ────────────────────────────────────────────────────────── */

const CACHE = {
  static: 'degenfeed-static-v2',
  page: 'degenfeed-pages-v2',
  api: 'degenfeed-api-v2',
  font: 'degenfeed-fonts-v2',
};

const STATIC_URLS = ['/', '/home', '/feed', '/news', '/status', '/discover', '/offline'];

const ASSET_EXT = /\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|avif)$/;
const API_PATTERN = /^\/api\//;

/* ── Install ───────────────────────────────────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE.static);
      // Best-effort pre-cache — ignore individual failures
      await Promise.allSettled(
        STATIC_URLS.map((url) =>
          cache.add(url).catch(() => {}),
        ),
      );
    })(),
  );
  self.skipWaiting();
});

/* ── Activate — prune old caches ──────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const valid = new Set(Object.values(CACHE));
      await Promise.all(keys.filter((k) => !valid.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/* ── Fetch — strategy router ──────────────────────────────── */
self.addEventListener('fetch', (e) => {
  // Only GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Same-origin only for caching; passthrough for cross-origin (CDN, etc.)
  if (url.origin !== self.location.origin) {
    // Still cache cross-origin fonts & images on first load
    if (ASSET_EXT.test(url.pathname)) {
      e.respondWith(cacheFirst(e.request, CACHE.static));
    }
    return;
  }

  // ---- Same-origin strategies ----

  // Static assets: cache-first
  if (ASSET_EXT.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request, CACHE.static));
    return;
  }

  // Font files (woff2 etc. cached separately)
  if (url.pathname.match(/\.(woff2?|ttf|otf)$/)) {
    e.respondWith(cacheFirst(e.request, CACHE.font));
    return;
  }

  // API calls: stale-while-revalidate
  if (API_PATTERN.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE.api));
    return;
  }

  // Navigation & pages: stale-while-revalidate with offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(navStrategy(e.request));
    return;
  }

  // Everything else: network-first with cache fallback
  e.respondWith(networkFirst(e.request, CACHE.page));
});

/* ── Cache strategies ──────────────────────────────────────── */

/** Cache-first: return from cache, fetch in background. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok) {
      const clone = res.clone();
      caches.open(cacheName).then((c) => c.put(request, clone));
    }
    return res;
  } catch {
    return caches.match('/offline');
  }
}

/** Stale-while-revalidate: serve cache instantly, update in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);

  return cached || (await fetchPromise);
}

/** Network-first: try network, fall back to cache, then offline page. */
async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const clone = res.clone();
      caches.open(cacheName).then((c) => c.put(request, clone));
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || (await caches.match('/offline'));
  }
}

/** Navigation strategy: stale-while-revalidate, offline → /offline. */
async function navStrategy(request) {
  const cache = await caches.open(CACHE.page);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(async () => {
      return (await caches.match('/offline')) || new Response('Offline', { status: 503 });
    });

  return cached || (await fetchPromise);
}

/* ── Push notifications ────────────────────────────────────── */
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'DegenFeed', {
      body: data.body || 'New activity on your feed',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'degenfeed',
      vibrate: [200, 100, 200],
    }),
  );
});

/* ── Periodic background sync (Chromium-based) ─────────────── */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'degenfeed-refresh') {
    e.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE.api);
        const keys = await cache.keys();
        // Refresh the first 5 cached API responses
        await Promise.allSettled(
          keys.slice(0, 5).map(async (req) => {
            try {
              const res = await fetch(req);
              if (res.ok) cache.put(req, res);
            } catch {
              /* offline — skip */
            }
          }),
        );
      })(),
    );
  }
});
