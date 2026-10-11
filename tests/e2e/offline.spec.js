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
