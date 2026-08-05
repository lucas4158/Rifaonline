const CACHE_NAME = 'rifamaster-pwa-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/favicon.png',
  '/icon-maskable.png'
];

// On installation, cache the primary critical files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching PWA core shells and icons');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Clear old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  // 1. EARLY GUARD: Never intercept or handle non-GET, /api/, or /admin requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/admin')
  ) {
    return; // Pass directly to browser network pipeline without respondWith
  }

  const url = new URL(event.request.url);

  // 2. Bypass cache for Firebase / Firestore SDK requests
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis')
  ) {
    return; // Pass directly to network
  }

  // 3. Network-First approach for standard static assets with quick Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we got a valid response, cache a copy of it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it is a navigation request, fall back to the main shell (SPA)
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
