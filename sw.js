const VERSION = 25;
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
  './js/main.js',
  './js/config.js',
  './js/core/dates.js',
  './js/core/db.js',
  './js/core/store.js',
  './js/core/util.js',
  './js/data.js',
  './js/learn/activity.js',
  './js/learn/questions.js',
  './js/learn/ranks.js',
  './js/learn/reset.js',
  './js/learn/srs.js',
  './js/learn/streak.js',
  './js/router.js',
  './js/screens/about.js',
  './js/screens/demo.js',
  './js/screens/guide.js',
  './js/screens/home.js',
  './js/screens/me.js',
  './js/screens/stats.js',
  './js/screens/term.js',
  './js/screens/train/cards.js',
  './js/screens/train/hub.js',
  './js/screens/train/index.js',
  './js/screens/train/match.js',
  './js/screens/train/quiz.js',
  './js/screens/train/shared.js',
  './js/screens/train/sprint.js',
  './js/search/engine.js',
  './js/search/highlight.js',
  './js/search/index.js',
  './js/search/text.js',
  './js/ui/authors.js',
  './js/ui/badge.js',
  './js/ui/dom.js',
  './js/ui/events.js',
  './js/ui/fav.js',
  './js/ui/gestures.js',
  './js/ui/icons.js',
  './js/ui/install.js',
  './js/ui/learn.js',
  './js/ui/ranks.js',
  './js/ui/sheet.js',
  './js/ui/splash.js',
  './js/user.js',
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
  if (url.origin !== location.origin) return;
  const key = url.origin + url.pathname;

  const fromCache = () => caches.match(key)
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  let saved;
  const fromNetwork = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      saved = caches.open(CACHE).then(c => c.put(key, copy));
    }
    return res;
  });
  event.waitUntil(fromNetwork.then(() => saved).catch(() => {}));
  const wait = Date.now() < slowUntil ? 0 : NET_TIMEOUT_MS;
  const slowNetwork = new Promise(resolve => setTimeout(resolve, wait))
    .then(() => caches.match(key)).then(hit => {
      if (!hit) return fromNetwork;
      if (wait) slowUntil = Date.now() + SLOW_WINDOW_MS;
      return hit;
    });

  event.respondWith(Promise.race([fromNetwork, slowNetwork]).catch(fromCache));
});
