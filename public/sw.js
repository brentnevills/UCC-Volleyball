// UCC Lancers Volleyball - Service Worker for PWA Offline Support & Android Installability
const CACHE_NAME = 'ucc-lancers-v3';

self.addEventListener('install', (event) => {
  const scopeUrl = self.registration.scope;
  const staticAssets = [
    scopeUrl,
    new URL('index.html', scopeUrl).href,
    new URL('manifest.json', scopeUrl).href,
    new URL('pwa-192x192.png', scopeUrl).href,
    new URL('pwa-maskable-192x192.png', scopeUrl).href,
    new URL('pwa-512x512.png', scopeUrl).href,
    new URL('pwa-maskable-512x512.png', scopeUrl).href,
    new URL('apple-touch-icon.png', scopeUrl).href,
    new URL('lancer-logo.png', scopeUrl).href
  ];

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(staticAssets).catch((err) => {
        console.warn('SW Precache failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests or Firebase / API calls
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.includes('firestore') || url.pathname.includes('googleapis')) {
    return;
  }

  // For HTML navigation requests, use Network First, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const indexUrl = new URL('index.html', self.registration.scope).href;
          const cached = (await caches.match(indexUrl)) || (await caches.match(self.registration.scope)) || (await caches.match('/index.html'));
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // For static assets (images, icons, styles), use Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
