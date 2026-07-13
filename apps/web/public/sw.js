self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open('degenfeed-v1')
      .then((c) => c.addAll(['/', '/feed', '/home', '/news', '/status']))
      .catch(() => {}),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches
      .match(e.request)
      .then(
        (r) =>
          r ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              var clone = res.clone();
              caches.open('degenfeed-v1').then((c) => c.put(e.request, clone));
            }
            return res;
          }),
      )
      .catch(() => caches.match('/feed')),
  );
});
self.addEventListener('push', (e) => {
  var data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'DegenFeed', {
      body: data.body || 'New activity on your feed',
      icon: '/icon-192.png',
      tag: 'degenfeed',
    }),
  );
});
