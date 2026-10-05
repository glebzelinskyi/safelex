/* =====================================================================
   SafeLex — service worker (робота без інтернету)
   Стратегія «спочатку мережа»: коли є інтернет — завжди свіжа версія
   (нові терміни підтягуються самі), коли немає — береться з пам’яті.

   Коли міняти VERSION: лише якщо ви додали НОВІ файли в список ASSETS
   (щоб вони одразу працювали офлайн). Для правок у terms.js, app.js,
   style.css тощо нічого міняти не треба — телефон підтягне їх сам.
   ===================================================================== */
const VERSION = 8;
const CACHE = 'safelex-v' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/fonts.css',
  './fonts/onest-cyrillic-wght-normal.woff2',
  './fonts/onest-latin-wght-normal.woff2',
  './fonts/unbounded-cyrillic-wght-normal.woff2',
  './fonts/unbounded-latin-wght-normal.woff2',
  './js/app.js',
  './data/terms.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/emblem.png',
  './icons/ldubzhd-logo.png',
  './icons/ldubzhd-logo-white.png',
  './icons/ldubzhd-crest.png',
  './icons/apple-touch-icon.png'
];

// Кожен файл кешується окремо: якщо якогось немає (перейменували чи видалили),
// решта все одно збережеться, і офлайн-режим не зламається.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(ASSETS.map(a =>
        cache.add(new Request(a, { cache: 'reload' })).catch(() => console.warn('SafeLex: не знайдено файл', a)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isOwn = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isOwn && !isFont) return;

  // 'no-cache' — завжди звіряємося з сервером, а не з кешем браузера,
  // інакше оновлення на GitHub Pages доходили б із затримкою до 10 хв.
  event.respondWith(
    fetch(req, isOwn ? { cache: 'no-cache' } : undefined)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
