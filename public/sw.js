// ===================================================
// ゲルぴよポータル — Service Worker
// キャッシュ戦略: 静的アセット→Cache-First / ページ→Network-First
// ===================================================

const CACHE_NAME = 'gelpiyo-portal-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// --- Install ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// --- Activate (旧キャッシュ削除) ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// --- Fetch ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 静的アセット（画像、フォント）→ Cache-First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|woff2?|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // ページ → Network-First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
