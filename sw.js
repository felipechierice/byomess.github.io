const CACHE_NAME = 'hype-hero-v1.0.0';
const urlsToCache = [
  '/',
  '/hype-hero/',
  '/hype-hero/index.html',
  '/hype-hero/index.js',
  '/hype-hero/index.css',
  '/hype-hero/charts/003_reaching-saturn-depths-of-titan_medium.json',
  '/hype-hero/charts/004_dia-delicia-nakama_medium.json',
  '/hype-hero/charts/005_passo-bem-solto-atlxs-slowed_medium.json',
  '/hype-hero/songs/003_reaching-saturn-depths-of-titan.mp3',
  '/hype-hero/songs/004_dia-delicia-nakama.mp3',
  '/hype-hero/songs/005_passo-bem-solto-atlxs-slowed.mp3',
  '/manifest.json',
  '/pwa-test.html',
  'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.9/browser/pixi.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: All files cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Add to cache
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(error => {
        console.error('Service Worker: Fetch failed', error);
        // You could return a custom offline page here
        throw error;
      })
  );
});

// Handle background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync');
    // Handle any background sync tasks here
  }
});

// Handle push notifications (if needed in the future)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    console.log('Service Worker: Push received', data);
    
    const options = {
      body: data.body || 'Novo update disponível no Hype Hero!',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'hype-hero-notification'
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Hype Hero', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/hype-hero/')
  );
});
