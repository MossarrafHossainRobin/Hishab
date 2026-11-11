const CACHE = 'hishab-v2';

// Cache the app shell and its JS/CSS at install so the first offline launch works.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('/', { cache: 'reload' });
      const html = await res.clone().text();
      await cache.put('/', res);
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || [])];
      await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
      await cache.addAll(['/icon-192.png', '/manifest.webmanifest']).catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static files: cache first, fill the cache as they are fetched.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// Push notifications (Firebase Cloud Messaging data message).
// iOS requires a visible notification for every push, so always show one.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const d = { ...(payload.notification || {}), ...(payload.data || {}) };
  event.waitUntil(
    self.registration.showNotification(d.title || 'Hishab', {
      body: d.body || '',
      icon: '/icon-192.png',
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});