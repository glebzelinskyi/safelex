import { test, expect, seed, open } from '../helpers.js';

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
