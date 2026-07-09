self.addEventListener('install', function (e) {
  e.waitUntil(
    caches
      .open('degenfeed-v1')
      .then(function (c) {
        return c.addAll(['/', '/feed', '/home', '/news', '/status']);
      })
      .catch(function () {}),
  );
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches
      .match(e.request)
      .then(function (r) {
        return (
          r ||
          fetch(e.request).then(function (res) {
            if (res.ok) {
              var clone = res.clone();
              caches.open('degenfeed-v1').then(function (c) {
                return c.put(e.request, clone);
              });
            }
            return res;
          })
        );
      })
      .catch(function () {
        return caches.match('/feed');
      }),
  );
});
self.addEventListener('push', function (e) {
  var data = (e.data && e.data.json()) || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'DegenFeed', {
      body: data.body || 'New activity on your feed',
      icon: '/icon-192.png',
      tag: 'degenfeed',
    }),
  );
});
