import { test, expect, seed, open, storage } from '../helpers.js';

test.use({ serviceWorkers: 'allow' });

test('після першого відкриття працює без інтернету', async ({ page, context }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(async () => {
    const keys = await caches.keys();
    if (!keys.length) return 0;
    return (await (await caches.open(keys[0])).keys()).length;
  })).toBeGreaterThan(10);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#q')).toBeVisible();
  await page.locator('#q').fill('arson');
  await expect(page.locator('.best .best-ua')).toHaveText('підпал');
  await page.goto('./#/guide/water');
  await expect(page.locator('#glist a.row').first()).toBeVisible();
  await page.goto('./#/train/cards?cat=water');
  await expect(page.locator('.deck .flash')).toBeVisible();
  await context.setOffline(false);
});

test('service worker кешує лише файли SafeLex', async ({ page }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const urls = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(new URL(u).origin).toBe(new URL(page.url()).origin);
  expect(new Set(urls).size).toBe(urls.length);
});

/** Файли зі списку ASSETS у sw.js, яких немає в кеші. */
const missing = page => page.evaluate(async () => {
  const list = (await (await fetch('sw.js')).text()).match(/const ASSETS = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
  const out = [];
  for (const a of list) if (!await caches.match(new URL(a, location.href).href)) out.push(a);
  return out;
});

test('у кеші є кожен файл зі списку sw.js, а шрифт довідника працює без інтернету', async ({ page, context }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => missing(page)).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#q')).toBeVisible();
  await page.goto('./#/guide/water');
  await expect(page.locator('#glist a.row .en').first()).toBeVisible();
  const mono = () => page.evaluate(async () => {
    await document.fonts.load('600 15px "JetBrains Mono"', 'abc');
    return [...document.fonts].filter(f => f.family.includes('JetBrains')).map(f => f.status);
  });
  await expect.poll(mono).toContain('loaded');
  expect(await mono()).not.toContain('error');
  await context.setOffline(false);
});

test('оновлення: нова версія замінює кеш цілком, стара зникає, прогрес лишається', async ({ page }) => {
  await seed(page, { data: { 'safelex:srs': { arson: { checks: 3, day: '', due: 0, wrong: 0 } } } });
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => caches.keys())).toHaveLength(1);
  const [old] = await page.evaluate(() => caches.keys());
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator('#q')).toBeVisible();

  // Тестовий сервер віддає той самий sw.js з іншим номером версії — для браузера це оновлення.
  await page.evaluate(() => { navigator.serviceWorker.register('sw.js?version=9999'); });
  await expect(page.locator('.update-toast')).toContainText('Є оновлення');
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['safelex-v9999']);
  expect(old).not.toBe('safelex-v9999');
  await expect.poll(() => missing(page)).toEqual([]);
  expect((await storage(page, 'safelex:srs')).arson.checks).toBe(3);
  await page.goto('./#/me');
  await expect(page.locator('.legend')).toContainText('Вивчено 1');
});

test('сервер віддає помилку (збій хостингу) — застосунок запускається з кешу', async ({ page, context, browserName }) => {
  // У WebKit підміна відповіді в тесті спрацьовує ще до service worker, тож його реакцію там не перевірити.
  test.skip(browserName === 'webkit');
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => missing(page)).toEqual([]);
  let broken = 0;
  await context.route(/\/(js|css|data)\/.*|\/$|index\.html$/, r => { broken++; r.fulfill({ status: 503, body: 'down' }); });
  await page.reload();
  await expect(page.locator('#q')).toBeVisible();
  await page.locator('#q').fill('arson');
  await expect(page.locator('.best .best-ua')).toHaveText('підпал');
  await page.goto('./#/guide/water');
  await expect(page.locator('#glist a.row').first()).toBeVisible();
  expect(broken).toBeGreaterThan(10);
});

test('оновлення не чіпає кеші інших застосунків на тій самій адресі', async ({ page }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async () => { await (await caches.open('other-app-v1')).put('/x', new Response('x')); });
  await page.evaluate(() => { navigator.serviceWorker.register('sw.js?version=9998'); });
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['safelex-v9998', 'other-app-v1']));
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBe(2);
});

/** Сервер починає віддавати змінений style.css; delay — затримка відповіді, мс. */
const changeStyle = (context, mark, delay = 0) => context.route(/\/css\/style\.css$/, async r => {
  // Затримана відповідь може надійти вже після кінця тесту — тоді її нема кому віддавати.
  try {
    const body = await (await r.fetch()).text() + `\n/* ${mark} */`;
    if (delay) await new Promise(done => setTimeout(done, delay));
    await r.fulfill({ contentType: 'text/css; charset=utf-8', body });
  } catch {}
});
const cachedStyle = page => page.evaluate(async () => (await (await caches.match(new URL('css/style.css', location.href).href)).text()).slice(-20));
const ready = async page => {
  await seed(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => missing(page)).toEqual([]);
};

test.describe('оновлення файлів на сервері', () => {
  // У WebKit підміна відповіді в тесті спрацьовує ще до service worker.
  test.skip(({ browserName }) => browserName === 'webkit');
  test.afterEach(({ context }) => context.unrouteAll({ behavior: 'ignoreErrors' }));

  test('з інтернетом наступний запуск одразу бере нові файли — усі разом', async ({ page, context }) => {
    await ready(page);
    await changeStyle(context, 'fresh-1');
    await page.reload();
    await expect(page.locator('#q')).toBeVisible();
    expect(await cachedStyle(page)).toContain('fresh-1');
    expect(await page.evaluate(() => caches.keys())).toHaveLength(1);
    await expect(page.locator('.update-toast')).toHaveCount(0);
  });

  test('повільна мережа: відкривається стара версія цілком, нова — після плашки «Є оновлення»', async ({ page, context }) => {
    await ready(page);
    await changeStyle(context, 'fresh-2', 4000);
    await page.reload();
    await expect(page.locator('#q')).toBeVisible();
    expect(await cachedStyle(page)).not.toContain('fresh-2');
    await expect(page.locator('.update-toast')).toContainText('Є оновлення', { timeout: 10_000 });
    expect(await cachedStyle(page)).not.toContain('fresh-2');
    await page.locator('.update-toast').click();
    await expect(page.locator('#q')).toBeVisible();
    await expect.poll(() => cachedStyle(page)).toContain('fresh-2');
    await expect.poll(() => page.evaluate(() => caches.keys())).toHaveLength(1);
  });
});
