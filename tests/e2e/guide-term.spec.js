import { test, expect, seed, open, storage } from '../helpers.js';

test.beforeEach(async ({ page }) => { await seed(page); });

test.describe('Довідник', () => {
  test('показує всі розділи, згруповані за темами', async ({ page }) => {
    await open(page, '#/guide');
    await expect(page.locator('h1')).toHaveText('Довідник');
    await expect(page.locator('.lead')).toContainText('14 розділах');
    await expect(page.locator('a.topic')).toHaveCount(14);
    await expect(page.locator('.tabbar a[data-tab="guide"]')).toHaveClass(/active/);
  });

  test('розділ: фільтр, літери й тренування розділу', async ({ page }) => {
    await open(page, '#/guide');
    await page.locator('a.topic[href="#/guide/service"]').click();
    await expect(page.locator('#gcount')).toHaveText('Оберіть літеру або введіть слово');
    await expect(page.locator('#glist a.row').first()).toBeVisible();

    await page.locator('#gq').fill('academy');
    await expect(page.locator('#gcount')).toContainText('Знайдено:');
    await expect(page.locator('#glist')).toContainText('fire academy');
    await expect(page.locator('#glist mark').first()).toBeVisible();

    await page.locator('#gq').fill('');
    const letter = page.locator('[data-letter]').first();
    const l = await letter.getAttribute('data-letter');
    await letter.click();
    await expect(letter).toHaveClass(/active/);
    for (const en of await page.locator('#glist .en').allTextContents())
      expect(en.replace(/^[^a-z0-9]+/i, '')[0].toUpperCase()).toBe(l);
    await letter.click();
    await expect(letter).not.toHaveClass(/active/);

    await expect(page.locator('a.train-cta')).toHaveAttribute('href', '#/train?cat=service');
  });

  test('«Усі терміни» довантажує список під час гортання', async ({ page }) => {
    await open(page, '#/guide/all');
    const rows = page.locator('#glist a.row');
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeLessThan(3000);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 20000);
    await expect.poll(() => rows.count()).toBeGreaterThan(before);
  });

  test('невідомий розділ відкриває загальний довідник', async ({ page }) => {
    await open(page, '#/guide/no-such-topic');
    await expect(page.locator('h1')).toHaveText('Довідник');
  });

  test('фільтр розуміє іншу розкладку', async ({ page }) => {
    await open(page, '#/guide/all');
    await page.locator('#gq').fill('фкыщт');
    await expect(page.locator('#gcount')).toContainText('інша розкладка');
  });
});

test.describe('Картка терміна', () => {
  test('показує переклад, приклад і статус навчання', async ({ page }) => {
    await open(page, '#/term/arson');
    await expect(page.locator('.abbr')).toHaveText('arson');
    await expect(page.locator('.ua-big')).toHaveText('підпал');
    await expect(page.locator('.core-tag')).toBeVisible();
    await expect(page.locator('.ex-en')).not.toBeEmpty();
    await expect(page.locator('details.learn')).toContainText('Новий термін');
    await expect(page.locator('.src-note')).toContainText('Шуневича');
  });

  test('потрапляє в «Нещодавні» на головній', async ({ page }) => {
    await open(page, '#/term/arson');
    await page.locator('.tabbar a[data-tab="home"]').click();
    await expect(page.locator('.recent a[href="#/term/arson"]')).toBeVisible();
    await page.locator('[data-action="recent-clear"]').click();
    await expect(page.locator('.recent')).toHaveCount(0);
  });

  test('зірочка зберігає термін і він з’являється в «Моє»', async ({ page }) => {
    await open(page, '#/term/arson');
    const star = page.locator('[data-action="fav"]');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(await storage(page, 'safelex:favs')).toEqual(['arson']);
    await page.locator('.tabbar a[data-tab="me"]').click();
    await expect(page.locator('.list a[href="#/term/arson"]')).toBeVisible();
    await page.goto('./#/term/arson');
    await page.locator('[data-action="fav"]').click();
    await expect(page.locator('[data-action="fav"]')).toHaveAttribute('aria-pressed', 'false');
    expect(await storage(page, 'safelex:favs')).toEqual([]);
  });

  test('неіснуючий термін — зрозуміле повідомлення', async ({ page }) => {
    await open(page, '#/term/does-not-exist');
    await expect(page.locator('.empty')).toContainText('Термін не знайдено');
  });

  test('пов’язані терміни й розділ ведуть далі', async ({ page }) => {
    await open(page, '#/term/arson');
    await page.locator('a.cat-badge').click();
    await expect(page).toHaveURL(/#\/guide\//);
  });
});

test.describe('Навігація', () => {
  test('кнопка «Назад» повертає на попередній екран і зберігає прокрутку', async ({ page }) => {
    await open(page, '#/guide/all');
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
    const y = await page.evaluate(() => scrollY);
    // Рядок посередині екрана: натискання не має прокручувати сторінку.
    await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('a.row').click());
    await expect(page).toHaveURL(/#\/term\//);
    await page.locator('[data-action="back"]').click();
    await expect(page).toHaveURL(/#\/guide\/all$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 50);
  });

  test('«Назад» після переходу вперед-назад не виводить із застосунку', async ({ page }) => {
    await open(page, '#/guide/all');
    await page.locator('#glist a.row').first().click();
    await expect(page).toHaveURL(/#\/term\//);
    await page.locator('[data-action="back"]').click();
    await expect(page).toHaveURL(/#\/guide\/all$/);
    await page.locator('[data-action="back"]').click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('#q')).toBeVisible();
  });

  test('«Назад» на першому екрані веде на головну', async ({ page }) => {
    await open(page, '#/about');
    await page.locator('[data-action="back"]').click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('#q')).toBeVisible();
  });

  test('вкладки перемикаються й підсвічуються', async ({ page }) => {
    await open(page);
    for (const tab of ['guide', 'train', 'me', 'home']) {
      await page.locator(`.tabbar a[data-tab="${tab}"]`).click();
      await expect(page.locator(`.tabbar a[data-tab="${tab}"]`)).toHaveClass(/active/);
    }
  });

  test('невідома адреса відкриває головну', async ({ page }) => {
    await open(page, '#/whatever/else');
    await expect(page.locator('#q')).toBeVisible();
  });

  test('«Про застосунок» показує авторів і права', async ({ page }) => {
    await open(page, '#/about');
    await expect(page.locator('.authors')).toContainText('Зелінський Гліб Сергійович');
    await expect(page.locator('.authors')).toContainText('Пальчевська Олександра Святославівна');
    await expect(page.locator('section')).toContainText('Усі права захищено');
  });
});
