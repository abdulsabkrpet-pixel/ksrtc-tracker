// KSRTC Where Is My Bus - Progressive Web App Service Worker
const CACHE_NAME = 'ksrtc-tracker-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=3',
  '/app.js?v=3',
  '/styles.css',
  '/app.js',
  '/driver.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const API_ROUTES_TO_CACHE = [
  '/api/timetables',
  '/api/routes',
  '/api/stops'
];

// Install Event - Pre-cache shell assets and timetables
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching offline shell and timetables');
      
      // Cache core static assets
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Could not pre-cache asset:', asset, err);
        }
      }

      // Pre-fetch and cache offline timetables and routes
      for (const apiRoute of API_ROUTES_TO_CACHE) {
        try {
          const response = await fetch(apiRoute);
          if (response && response.status === 200) {
            await cache.put(apiRoute, response.clone());
          }
        } catch (err) {
          console.warn('[SW] Could not pre-fetch API:', apiRoute);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate for APIs & Cache-First for static
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignore WebSocket and POST requests
  if (event.request.method !== 'GET' || requestUrl.protocol.startsWith('ws')) {
    return;
  }

  // Handle Timetables and Route APIs: Stale-While-Revalidate
  if (API_ROUTES_TO_CACHE.some(route => requestUrl.pathname === route)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Handle HTML navigation, scripts & styles: Network-first, fallback to cache
  const isHtml = event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
  if (isHtml || requestUrl.pathname === '/' || requestUrl.pathname === '/index.html' || requestUrl.pathname.endsWith('.js') || requestUrl.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Handle all other assets (images, fonts): Cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.url.startsWith('http://') || event.request.url.startsWith('https://'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML navigation when completely offline
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
