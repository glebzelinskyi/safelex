const VERSION = 31;
const CACHE = 'safelex-v' + VERSION, NEXT = CACHE + '-next';
const NET_TIMEOUT_MS = 3000, SLOW_WINDOW_MS = 30000;
let slowUntil = 0;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/fonts.css',
  './fonts/jetbrains-mono-cyrillic-wght-normal.woff2',
  './fonts/jetbrains-mono-latin-wght-normal.woff2',
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
  './js/learn/backup.js',
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
  './js/ui/backup.js',
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
  './icons/ldubzhd-logo-white.png',
  './icons/apple-touch-icon.png'
];

const urlOf = a => { const u = new URL(a, location.href); return u.origin + u.pathname; };
const ASSET_URLS = ASSETS.map(urlOf), READY = urlOf('./__ready'), INDEX = urlOf('./index.html');
const isAsset = new Set(ASSET_URLS);
const live = () => caches.open(CACHE);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('install', event => {
  const add = (cache, a) => cache.add(new Request(a, { cache: 'no-cache' }));
  event.waitUntil(
    live()
      .then(cache => Promise.all(ASSETS.map(a => add(cache, a).catch(() => add(cache, a)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('safelex-v') && k !== CACHE && k !== NEXT).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function same(old, res) {
  if (!old) return false;
  const tag = res.headers.get('etag');
  if (tag && tag === old.headers.get('etag')) return true;
  const [a, b] = (await Promise.all([old.arrayBuffer(), res.clone().arrayBuffer()])).map(x => new Uint8Array(x));
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function stage() {
  const fresh = await Promise.all(ASSET_URLS.map(async u => {
    const res = await fetch(u, { cache: 'no-cache' });
    if (!res.ok || res.type !== 'basic') throw new Error(u);
    return res;
  }));
  const cache = await live();
  const unchanged = await Promise.all(fresh.map(async (res, i) => same(await cache.match(ASSET_URLS[i]), res)));
  if (unchanged.every(Boolean)) return false;
  await caches.delete(NEXT);
  const next = await caches.open(NEXT);
  await Promise.all(fresh.map((res, i) => next.put(ASSET_URLS[i], res)));
  await next.put(READY, new Response('ok'));
  return true;
}

let refreshing = null;
const refresh = () => refreshing ||= stage().catch(() => false).finally(() => { refreshing = null; });

async function promote() {
  if (!await caches.has(NEXT)) return;
  const next = await caches.open(NEXT);
  if (!await next.match(READY)) return;
  const cache = await live();
  await Promise.all(ASSET_URLS.map(async u => { const res = await next.match(u); if (res) await cache.put(u, res); }));
  await caches.delete(NEXT);
}

const announce = () => self.clients.matchAll({ type: 'window' }).then(list => list.forEach(c => c.postMessage({ type: 'update' })));

async function navigate(event, key) {
  await promote().catch(() => {});
  const wait = Date.now() < slowUntil ? 0 : NET_TIMEOUT_MS;
  const fresh = refresh();
  const late = Symbol();
  const got = await Promise.race([fresh, sleep(wait).then(() => late)]);
  if (got === late) {
    if (wait) slowUntil = Date.now() + SLOW_WINDOW_MS;
    event.waitUntil(fresh.then(changed => changed && announce()));
  } else if (got) await promote().catch(() => {});
  const cache = await live();
  const hit = await cache.match(key);
  if (hit) return hit;
  if (!isAsset.has(key)) { try { return await fetch(event.request); } catch {} }
  return await cache.match(INDEX) || fetch(event.request);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = url.origin + url.pathname;
  if (req.mode === 'navigate') return event.respondWith(navigate(event, key));

  const fromNetwork = () => fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); event.waitUntil(live().then(c => c.put(key, copy)).catch(() => {})); }
    return res;
  });
  const fromCache = () => live().then(c => c.match(key));
  event.respondWith(isAsset.has(key)
    ? fromCache().then(hit => hit || fromNetwork())
    : fromNetwork().then(res => res.ok ? res : fromCache().then(hit => hit || res), () => fromCache().then(hit => hit || Response.error())));
});
