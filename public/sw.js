// eLink Service Worker - Auto-versioned by server on each deploy
const CACHE_NAME = 'elink-__APP_VERSION__';
const STATIC_ASSETS = [
  '/',
  '/style.css',
  '/app.js',
  '/i18n.js',
  '/login.html',
  '/register.html',
  '/profile.html',
  '/E-Link-1024x500.png',
  '/inova-logo.png',
  '/icon-192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls and WebSocket: network only
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/live')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigation requests: network-first (always get fresh HTML from server)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // All other assets (CSS, JS, images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      }));

      return cached || fetchPromise;
    })
  );
});
