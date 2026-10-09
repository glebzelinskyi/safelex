import { test, expect, seed, open, finishQuiz } from '../helpers.js';

const PAYLOADS = [
  '<img src=x onerror="window.__xss=1">',
  '"><svg onload="window.__xss=1">',
  "'><script>window.__xss=1</script>",
  '<a href="javascript:window.__xss=1">x</a>',
  '${window.__xss=1}',
  '</mark><img src=x onerror=window.__xss=1>'
];

async function expectClean(page) {
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#app img[src="x"], #app svg[onload], #app script, #app a[href^="javascript:"]').count()).toBe(0);
}

test.describe('Захист від шкідливого тексту', () => {
  // Перевіряємо і з вимкненою Content-Security-Policy: захищати має сам код, а не лише браузер.
  for (const bypassCSP of [false, true]) {
    test.describe(bypassCSP ? 'без CSP' : 'з CSP', () => {
      test.use({ bypassCSP });

      test('поле пошуку й фільтр довідника', async ({ page }) => {
        await seed(page);
        await open(page);
        for (const p of PAYLOADS) {
          await page.locator('#q').fill(p);
          await expect(page.locator('#homeBody')).not.toBeEmpty();
          await page.locator('#q').press('Enter');
        }
        await page.locator('[data-action="clear"]').click();
        await expect(page.locator('#qchips .qc').first()).toBeVisible();
        await expectClean(page);
        await page.goto('./#/guide/all');
        for (const p of PAYLOADS) await page.locator('#gq').fill(p);
        await expectClean(page);
      });

      test('адреса сторінки', async ({ page }) => {
        await seed(page);
        for (const p of PAYLOADS) {
          const e = encodeURIComponent(p);
          for (const hash of [`#/search?q=${e}`, `#/term/${e}`, `#/guide/${e}`, `#/train?cat=${e}`, `#/train/quiz?cat=${e}`, `#/${e}`]) {
            await page.goto('./' + hash);
            await expect(page.locator('#app > *').first()).toBeVisible();
            await expectClean(page);
          }
        }
      });

      test('збережені дані', async ({ page }) => {
        const p = PAYLOADS[0];
        await seed(page, { data: {
          'safelex:qhist': PAYLOADS,
          'safelex:recent': [p, 'arson'],
          'safelex:favs': [p, 'arson'],
          'safelex:trainCat': p,
          'safelex:dailyScore': { date: p, score: p, total: p },
          'safelex:srs': { [p]: { checks: 1, day: p, due: 0, wrong: 3 } },
          'safelex:log': { [p]: { a: 1, r: 1 } }
        } });
        for (const hash of ['#/', '#/guide', '#/train', '#/me', '#/stats', '#/term/arson']) {
          await page.goto('./' + hash);
          await expect(page.locator('#app > *').first()).toBeVisible();
          await expectClean(page);
        }
        await expect(page.locator('#app')).toContainText('arson');
      });
    });
  }

  test('сторінка має Content-Security-Policy без inline-скриптів', async ({ page }) => {
    await seed(page);
    await open(page);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline' 'unsafe-eval'");
    expect(csp).toMatch(/script-src 'self';/);
    expect(await page.locator('script:not([src])').count()).toBe(0);
  });

  test('у чужому iframe показується лише посилання на оригінал', async ({ page, baseURL }) => {
    // Захист спрацьовує в будь-якому фреймі (window.top !== window.self), тож «чужу» сторінку
    // можна підставити на тому ж сервері — Chrome не дає фреймам з інших адрес вантажити localhost.
    const evil = baseURL + 'evil.html';
    await page.route(evil, r => r.fulfill({ contentType: 'text/html', body: `<iframe src="${baseURL}" width=400 height=600></iframe>` }));
    await page.goto(evil);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('a[target="_top"]')).toHaveText('Відкрити SafeLex на офіційному сайті');
    await expect(frame.locator('#q')).toHaveCount(0);
  });
});

test.describe('Пошкоджені або недоступні дані', () => {
  const GARBAGE = {
    'safelex:srs': '{"arson":null,"arsonist":"x","abacus":{"checks":"NaN","due":"soon","wrong":-5,"box":9},"x":{"checks":1e309}}',
    'safelex:days': '[1, null, {}, "2026-01-01", "not-a-date"]',
    'safelex:best': '"дуже багато"',
    'safelex:log': '{"2026-01-01":{"a":"x","r":99},"bad":5,"2026-01-02":null}',
    'safelex:favs': '{"not":"array"}',
    'safelex:recent': '[1,2,3]',
    'safelex:qhist': '[null, 5, "   ", "ok"]',
    'safelex:ranksSeen': '"x"',
    'safelex:dailyScore': '[]',
    'safelex:matchBest': '-1',
    'safelex:sprintBest': 'NaN',
    'safelex:trainCat': '{}',
    'safelex:hideInstall': '"yes"'
  };

  test('пошкоджений JSON і дані неправильного типу не ламають жоден екран', async ({ page }) => {
    await seed(page, { data: GARBAGE });
    for (const hash of ['#/', '#/guide', '#/guide/all', '#/term/arson', '#/train', '#/me', '#/stats',
      '#/train/quiz', '#/train/cards', '#/train/match', '#/train/sprint', '#/train/mistakes', '#/train/daily']) {
      await page.goto('./' + hash);
      await expect(page.locator('#app > *').first()).toBeVisible();
    }
    await page.goto('./#/train/quiz?cat=service');
    await finishQuiz(page);
    await expect(page.locator('.result-screen')).toBeVisible();
  });

  test('недоступне сховище (приватний режим, заборонені cookies) — застосунок працює', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    await page.goto('./#/');
    await expect(page.locator('#q')).toBeVisible();
    await page.locator('#q').fill('arson');
    await expect(page.locator('.best .best-en')).toHaveText('arson');
    await page.goto('./#/train/quiz?cat=service');
    await finishQuiz(page);
    await expect(page.locator('.result-screen')).toBeVisible();
    await page.goto('./#/me');
    await expect(page.locator('.rank-hero')).toBeVisible();
  });

  test('переповнене сховище — відповіді не ламаються', async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
    });
    await open(page, '#/train/quiz?cat=water');
    await finishQuiz(page);
    await expect(page.locator('.result-screen')).toBeVisible();
  });
});
