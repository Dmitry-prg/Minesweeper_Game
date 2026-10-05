/* Service Worker для игры «Сапёр» */

const CACHE_NAME = 'saper-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'  // опционально, если создадите отдельный манифест
];

// Установка: кэшируем основные ресурсы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

// Активация: чистим старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Перехват запросов: cache-first с обновлением
self.addEventListener('fetch', event => {
  const req = event.request;

  // Пропускаем всё, кроме GET
  if (req.method !== 'GET') return;

  // Пропускаем запросы к другим origin
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        // Кэшируем только валидные ответы
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));

      return cached || network;
    })
  );
});