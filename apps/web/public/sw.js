/* ── DegenFeed Service Worker v4 ───────────────────────────────
 *  Features:
 *    - Navigation preload for instant back/forward navigations
 *    - Precached critical shell pages at install time
 *    - Cache-first for static assets (images, fonts, CSS, JS)
 *    - Stale-while-revalidate for API responses
 *    - Network-first for dynamic pages (feed, notifications, live)
 *    - Cache versioning with automatic old-cache cleanup
 *    - Offline fallback page with retry
 *    - Background periodic refresh of cached API data
 *    - Graceful timeout for slow networks (10s)
 *  ────────────────────────────────────────────────────────── */

const CACHE = {
  static: 'degenfeed-static-v4',
  page: 'degenfeed-pages-v4',
  api: 'degenfeed-api-v4',
  font: 'degenfeed-fonts-v4',
  image: 'degenfeed-images-v4',
};

const NETWORK_TIMEOUT_MS = 10000;

/* ── Critical shell pages to precache at install time ─────── */
const PRECACHE_URLS = [
  '/',
  '/home',
  '/feed',
  '/discover',
  '/trending',
  '/shorts',
  '/live',
  '/search',
  '/news',
  '/status',
  '/offline',
];

const ASSET_EXT = /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)$/;
const API_PATTERN = /^\/api\//;

/* ── Navigation Preload ──────────────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Enable navigation preload
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      // Prune old cache versions
      const keys = await caches.keys();
      const valid = new Set(Object.values(CACHE));
      await Promise.all(keys.filter((k) => !valid.has(k)).map((k) => caches.delete(k)));

      await self.clients.claim();
    })(),
  );
});

/* ── Install — precache critical pages ──────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE.page);
      // Best-effort pre-cache — don't fail install if one URL is down
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})));
    })(),
  );
  self.skipWaiting();
});

/* ── Fetch — strategy router ────────────────────────────── */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Cross-origin: cache images/fonts on first load
  if (url.origin !== self.location.origin) {
    if (ASSET_EXT.test(url.pathname)) {
      e.respondWith(cacheFirst(e.request, CACHE.image));
    }
    return;
  }

  // Same-origin strategies
  if (e.request.method !== 'GET') return;

  // Static assets: cache-first
  if (ASSET_EXT.test(url.pathname)) {
    if (url.pathname.match(/\.(woff2?|ttf|otf)$/)) {
      e.respondWith(cacheFirst(e.request, CACHE.font));
    } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|avif)$/)) {
      e.respondWith(cacheFirst(e.request, CACHE.image));
    } else {
      e.respondWith(cacheFirst(e.request, CACHE.static));
    }
    return;
  }

  // API calls: stale-while-revalidate (show cached, update in background)
  if (API_PATTERN.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE.api));
    return;
  }

  // Navigation: use preload response if available, with network-first fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(navStrategy(e));
    return;
  }

  // Everything else: network-first with cache fallback
  e.respondWith(networkFirst(e.request, CACHE.page));
});

/* ── Cache strategies ────────────────────────────────────── */

/** Cache-first: return from cache immediately; update in background. */
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

/**
 * Stale-while-revalidate: serve cached version instantly,
 * then fetch the latest in the background for next time.
 */
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

/**
 * Fetch with timeout — fails gracefully if network is slow.
 */
async function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(request, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Navigation strategy: use preload response, network-first with timeout.
 *
 * Navigation preload (`preloadResponse`) enables the browser to send
 * a fetch in parallel with the service worker boot, cutting ~100ms
 * off back/forward navigations.
 */
async function navStrategy(event) {
  // Try the preloaded response first (fast path for back/forward)
  if (event.preloadResponse) {
    const preload = await event.preloadResponse;
    if (preload) {
      // Cache the preloaded response for future offline use
      if (preload.ok) {
        const clone = preload.clone();
        caches.open(CACHE.page).then((c) => c.put(event.request, clone));
      }
      return preload;
    }
  }

  // Fall back to network-first with timeout
  try {
    const res = await fetchWithTimeout(event.request, NETWORK_TIMEOUT_MS);
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE.page).then((c) => c.put(event.request, clone));
    }
    return res;
  } catch {
    const cached = await caches.match(event.request);
    return cached || (await caches.match('/offline')) || new Response('Offline', { status: 503 });
  }
}

/* ── Push notifications ──────────────────────────────────── */
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const options = {
    body: data.body || 'New activity on DegenFeed',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.tag || 'degenfeed',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  };
  e.waitUntil(self.registration.showNotification(data.title || 'DegenFeed', options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    }),
  );
});

/* ── Periodic background sync (Chromium-based) ───────────── */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'degenfeed-refresh') {
    e.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE.api);
        const keys = await cache.keys();
        await Promise.allSettled(
          keys.slice(0, 10).map(async (req) => {
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
