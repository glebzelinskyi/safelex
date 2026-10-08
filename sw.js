const VERSION = 10;
const CACHE = 'safelex-v' + VERSION;
const NET_TIMEOUT_MS = 3000, SLOW_WINDOW_MS = 30000;
let slowUntil = 0;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/fonts.css',
  './fonts/onest-cyrillic-wght-normal.woff2',
  './fonts/onest-latin-wght-normal.woff2',
  './fonts/unbounded-cyrillic-wght-normal.woff2',
  './fonts/unbounded-latin-wght-normal.woff2',
  './js/boot.js',
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

  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  let saved;
  const fromNetwork = fetch(req, isOwn ? { cache: 'no-cache' } : undefined).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      saved = caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  });
  event.waitUntil(fromNetwork.then(() => saved).catch(() => {}));
  const wait = Date.now() < slowUntil ? 0 : NET_TIMEOUT_MS;
  const slowNetwork = new Promise(resolve => setTimeout(resolve, wait))
    .then(() => caches.match(req, { ignoreSearch: true })).then(hit => {
      if (!hit) return fromNetwork;
      if (wait) slowUntil = Date.now() + SLOW_WINDOW_MS;
      return hit;
    });

  event.respondWith(Promise.race([fromNetwork, slowNetwork]).catch(fromCache));
});
