import { test, expect, seed, open, storage, finishQuiz } from '../helpers.js';

test.describe('Завдання дня й серія', () => {
  test('виконане завдання дня починає серію', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(page.locator('a.daily .k')).toHaveText('Серія ще не почалася');
    await page.locator('a.daily').click();
    await expect(page.locator('.mode-title')).toHaveText('Завдання дня');
    await finishQuiz(page);
    await expect(page.locator('.result-screen .msg')).toHaveText('Завдання дня виконано!');
    await expect(page.locator('.res-fire')).toContainText('1 день поспіль');
    expect(await storage(page, 'safelex:days')).toHaveLength(1);
    expect(await storage(page, 'safelex:best')).toBe(1);
    await page.locator('.result-screen ~ a.btn[href="#/"]').click();
    await expect(page.locator('a.daily')).toHaveClass(/done/);
    await expect(page.locator('a.daily .t')).toHaveText('Сьогодні виконано');
    await expect(page.locator('a.daily .s')).toContainText('наступне — завтра');
  });

  test('третій день поспіль присвоює звання «Рядовий» зі святковим екраном', async ({ page }) => {
    await seed(page, { days: [1, 2], data: { 'safelex:best': 2 } });
    await open(page);
    await expect(page.locator('a.daily .fire b')).toHaveText('2');
    await page.locator('a.daily').click();
    await finishQuiz(page);
    const cel = page.locator('.celebrate');
    await expect(cel).toBeVisible();
    await expect(cel.locator('h2')).toHaveText('Рядовий');
    expect(await storage(page, 'safelex:ranksSeen')).toEqual([3]);
    await cel.locator('[data-action="cel-close"]').click();
    await expect(cel).toHaveCount(0);
  });

  test('пропущений день обнуляє серію, але рекорд лишається', async ({ page }) => {
    await seed(page, { days: [2, 3, 4], data: { 'safelex:best': 3 } });
    await open(page, '#/me');
    await expect(page.locator('.me-stats > span').nth(0).locator('em')).toHaveText('0');
    await expect(page.locator('.me-stats > span').nth(1).locator('em')).toHaveText('3');
    await expect(page.locator('.rank-hero .rh-body > b')).toHaveText('Рядовий');
  });

  test('завдання дня не повторюється вдруге за день', async ({ page }) => {
    await seed(page, { days: [0] });
    await open(page);
    await expect(page.locator('a.daily')).toHaveClass(/done/);
  });
});

test.describe('Моє', () => {
  test('звання відкриваються в нижній шторці й гортаються', async ({ page }) => {
    await seed(page, { days: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], data: { 'safelex:best': 10 } });
    await open(page, '#/me');
    await expect(page.locator('.rank-hero .rh-body > b')).toHaveText('Сержант');
    await expect(page.locator('.ranks .rank.got')).toHaveCount(3);
    await page.locator('.ranks [data-rank="0"]').click();
    const sheet = page.locator('.sheet.rank-sheet');
    await expect(sheet.locator('.rs-title')).toHaveText('Курсант');
    await sheet.locator('.rs-nav[data-rank="1"]').click();
    await expect(sheet.locator('.rs-title')).toHaveText('Рядовий');
    await expect(sheet.locator('.rs-nav[data-rank="-1"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet-wrap')).toHaveCount(0);
  });

  test('прогрес вивчення рахує нові, вчу й вивчено', async ({ page }) => {
    await seed(page, { data: { 'safelex:srs': {
      arson: { checks: 3, day: '2026-01-01', due: 0, wrong: 0 },
      arsonist: { checks: 1, day: '2026-01-01', due: 0, wrong: 2 }
    } } });
    await open(page, '#/me');
    await expect(page.locator('.legend')).toContainText('Вивчено 1');
    await expect(page.locator('.legend')).toContainText('Вчу 1');
    await page.goto('./#/term/arson');
    await expect(page.locator('details.learn')).toContainText('Вивчено');
  });

  test('«Скинути прогрес» стирає навчання, але не збережені терміни', async ({ page }) => {
    await seed(page, { days: [0, 1], data: {
      'safelex:best': 2, 'safelex:favs': ['arson'],
      'safelex:srs': { arson: { checks: 2, day: '', due: 0, wrong: 1 } }
    } });
    await open(page, '#/me');
    page.once('dialog', d => d.accept());
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('.legend')).toContainText('Вивчено 0');
    expect(await storage(page, 'safelex:srs')).toBeNull();
    expect(await storage(page, 'safelex:days')).toBeNull();
    expect(await storage(page, 'safelex:favs')).toEqual(['arson']);
  });

  test('скасоване скидання нічого не змінює', async ({ page }) => {
    await seed(page, { data: { 'safelex:srs': { arson: { checks: 3, day: '', due: 0, wrong: 0 } } } });
    await open(page, '#/me');
    page.once('dialog', d => d.dismiss());
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('.legend')).toContainText('Вивчено 1');
  });
});

test.describe('Статистика', () => {
  test('показує відповіді, точність, календар і найскладніші терміни', async ({ page }) => {
    await seed(page, { data: {
      'safelex:srs': { arson: { checks: 0, day: '', due: 0, wrong: 4 } }
    } });
    await open(page, '#/train/quiz?cat=service');
    await finishQuiz(page);
    await page.goto('./#/stats');
    await expect(page.locator('h1')).toHaveText('Статистика');
    await expect(page.locator('.st-tiles')).toContainText('точність');
    await expect(page.locator('.abars .ab.today')).toBeVisible();
    await expect(page.locator('.list a[href="#/term/arson"]')).toContainText('4 помилки');
    await expect(page.locator('.st-due a b')).toHaveText(/^\d+$/);

    const title = page.locator('.hm-title b');
    const month = await title.textContent();
    await page.locator('[data-action="hm-prev"]').click();
    await expect(title).not.toHaveText(month);
    await page.locator('[data-action="hm-next"]').click();
    await expect(title).toHaveText(month);

    await page.locator('#hmBox .hm-cell.today').click();
    await expect(page.locator('#hmBox').locator('..').locator('.st-read')).toContainText('Сьогодні');
  });
});

test.describe('Демо-режим', () => {
  test('скасування демо нічого не змінює', async ({ page }) => {
    await seed(page);
    page.once('dialog', d => d.dismiss());
    await page.goto('./#/demo');
    await expect(page).toHaveURL(/#\/$/);
    expect(await storage(page, 'safelex:srs')).toBeNull();
  });

  test('демо заповнює прогрес і серію', async ({ page }) => {
    await seed(page);
    page.once('dialog', d => d.accept());
    await page.goto('./#/demo');
    await expect(page.locator('a.daily .fire b')).toHaveText('456');
    await page.goto('./#/me');
    await expect(page.locator('.legend')).toContainText('Вивчено 1298');
  });
});

test('тисячі збережених показуються частинами з кнопкою «Показати ще»', async ({ page }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => localStorage.setItem('safelex:favs', JSON.stringify(window.TERMS.slice(0, 120).map(t => t.id))));
  await page.goto('./#/me');
  await page.reload();
  const rows = page.locator('#savedList a.row'), more = page.locator('[data-action="saved-more"]');
  await expect(rows).toHaveCount(50);
  await expect(more).toHaveText('Показати ще · 70');
  await more.click();
  await expect(rows).toHaveCount(100);
  await more.click();
  await expect(rows).toHaveCount(120);
  await expect(more).toHaveCount(0);
});
