import { test, expect, seed, open, storage, finishQuiz, solveQuestion } from '../helpers.js';

test.beforeEach(async ({ page }) => { await seed(page); });

const srsOf = page => storage(page, 'safelex:srs').then(s => s || {});

test.describe('Тренажер: вибір режиму', () => {
  test('показує розділи й режими, «Помилки» вимкнено без помилок', async ({ page }) => {
    await open(page, '#/train');
    await expect(page.locator('h1')).toHaveText('Тренажер');
    await expect(page.locator('[data-tcat="all"]')).toHaveClass(/active/);
    await expect(page.locator('[data-tcat="core"]')).toBeVisible();
    await expect(page.locator('[data-tcat="fav"]')).toHaveCount(0);
    await expect(page.locator('a.mode')).toHaveCount(5);
    await expect(page.locator('a.m-mistakes')).toHaveClass(/off/);
  });

  test('обраний розділ запам’ятовується', async ({ page }) => {
    await open(page, '#/train');
    await page.locator('[data-tcat="water"]').click();
    await expect(page.locator('[data-tcat="water"]')).toHaveClass(/active/);
    await expect(page.locator('a.m-quiz')).toHaveAttribute('href', '#/train/quiz?cat=water');
    expect(await storage(page, 'safelex:trainCat')).toBe('water');
    await page.reload();
    await expect(page.locator('[data-tcat="water"]')).toHaveClass(/active/);
  });

  test('невідомий розділ у адресі замінюється на «Усі розділи»', async ({ page }) => {
    await open(page, '#/train?cat=<b>nope</b>');
    await expect(page.locator('[data-tcat="all"]')).toHaveClass(/active/);
  });
});

test.describe('Тест', () => {
  test('10 правильних відповідей — результат і галочки', async ({ page }) => {
    await open(page, '#/train/quiz?cat=service');
    await expect(page.locator('.mode-title')).toHaveText('Тест · Пожежна служба');
    await finishQuiz(page, { right: true });
    await expect(page.locator('.result-screen .score')).toHaveText(/^(9|10)\/10$/);
    await expect(page.locator('.res-gain')).toContainText('галоч');
    const srs = await srsOf(page);
    expect(Object.keys(srs)).toHaveLength(10);
    expect(Object.values(srs).filter(s => s.checks === 1).length).toBeGreaterThanOrEqual(9);
    const log = await storage(page, 'safelex:log');
    expect(Object.values(log)[0].a).toBeGreaterThanOrEqual(10);
  });

  test('помилки повторюються в цьому ж тесті й потрапляють у «Помилки»', async ({ page }) => {
    await open(page, '#/train/quiz?cat=service');
    const first = await solveQuestion(page);
    await page.locator(`.opt[data-pick="${first.ids.find(id => id !== first.id)}"]`).click();
    await expect(page.locator('.feedback.bad')).toContainText('Запам’ятайте');
    await expect(page.locator('.counter')).toHaveText('1/11');
    await page.locator('[data-action="next"]').click();
    await finishQuiz(page, { right: false });
    await expect(page.locator('.result-screen .score')).toHaveText('0/10');
    await expect(page.locator('.miss a')).toHaveCount(10);

    await page.goto('./#/train?cat=service');
    await expect(page.locator('a.m-mistakes')).not.toHaveClass(/off/);
    await expect(page.locator('a.m-mistakes .mode-meta')).toHaveText('10 термінів');
    await page.locator('a.m-mistakes').click();
    await expect(page.locator('.mode-title')).toContainText('Робота над помилками');
    await finishQuiz(page, { right: true });
    await expect(page.locator('.result-screen .score')).toHaveText(/\/10$/);
  });

  test('«Помилки» без помилок показують порожній стан', async ({ page }) => {
    await open(page, '#/train/mistakes?cat=all');
    await expect(page.locator('.empty-box')).toContainText('Помилок поки немає');
  });

  test('«Ще раз» починає новий тест', async ({ page }) => {
    await open(page, '#/train/quiz?cat=water');
    await finishQuiz(page);
    await page.locator('[data-action="restart"]').click();
    await expect(page.locator('.counter')).toHaveText('0/10');
  });

  test('клавіатура: 1–4 відповідає, Enter — далі', async ({ page }) => {
    await open(page, '#/train/quiz?cat=service');
    await page.keyboard.press('2');
    await expect(page.locator('.feedback')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('.feedback')).toHaveCount(0);
    await expect(page.locator('.counter')).toHaveText(/^1\/1[01]$/);
  });

  test('питання «Напишіть англійською» приймає відповідь з одруківкою', async ({ page }) => {
    // Терміни з двома галочками отримують питання «як це англійською» або на введення.
    await open(page, '#/train');
    const srs = await page.evaluate(() => Object.fromEntries(window.TERMS
      .filter(t => t.topic === 'water' && /^[a-z]{7,}$/i.test(t.en))
      .map(t => [t.id, { checks: 2, day: '2000-01-01', due: 0, wrong: 0 }])));
    await page.evaluate(s => localStorage.setItem('safelex:srs', JSON.stringify(s)), srs);
    await page.reload();
    const cat = Object.keys(srs).length ? 'water' : 'all';
    for (let n = 0; n < 30 && !(await page.locator('#ans').count()); n++) {
      await page.goto('./#/train');
      await page.goto(`./#/train/quiz?cat=${cat}`);
      await expect(page.locator('.q-card')).toBeVisible();
    }
    const s = await solveQuestion(page);
    expect(s.en).toBeTruthy();
    await page.locator('#ans').fill(s.en.slice(0, -1) + (s.en.endsWith('x') ? 'y' : 'x'));
    await page.locator('#ans').press('Enter');
    await expect(page.locator('.feedback')).toHaveClass(/ok/);
  });
});

test.describe('Картки', () => {
  test('перевертаються, «Знаю» й «Ще вчу» рахуються, «Ще вчу» повертає картку в колоду', async ({ page }) => {
    await open(page, '#/train/cards?cat=service');
    await expect(page.locator('.counter')).toHaveText('1/20');
    const card = page.locator('.deck .flash');
    await card.click();
    await expect(card).toHaveClass(/flipped/);
    await page.locator('[data-action="card-no"]').click();
    await expect(page.locator('#cNo')).toHaveText('Ще вчу · 1');
    await expect(page.locator('.counter')).toHaveText('2/21');
    for (let i = 2; i <= 21; i++) {
      await page.locator('[data-action="card-yes"]').click();
      // Поки картка відлітає (~0,4 с), повторні натискання ігноруються — чекаємо наступну.
      await expect(i < 21 ? page.locator('.counter') : page.locator('.result-screen')).toHaveText(i < 21 ? `${i + 1}/21` : /20/);
    }
    await expect(page.locator('.result-screen .score')).toHaveText('20');
    await expect(page.locator('.result-screen .msg')).toContainText('ще вчите: 1');
    expect(Object.keys(await srsOf(page))).toHaveLength(20);
  });

  test('стрілки на клавіатурі оцінюють картку, пробіл перевертає', async ({ page }) => {
    await open(page, '#/train/cards?cat=water');
    await page.keyboard.press(' ');
    await expect(page.locator('.deck .flash')).toHaveClass(/flipped/);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#cYes')).toHaveText('Знаю · 1');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#cNo')).toHaveText('Ще вчу · 1');
  });

  test('свайп праворуч — «Знаю»', async ({ page }) => {
    await open(page, '#/train/cards?cat=water');
    const box = await page.locator('.deck .flash').boundingBox();
    const y = box.y + box.height / 2, x = box.x + box.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x + i * 20, y);
    await page.mouse.up();
    await expect(page.locator('#cYes')).toHaveText('Знаю · 1');
  });
});

async function solveMatch(page, { mistakes = 0 } = {}) {
  for (let n = 0; n < 40; n++) {
    const next = page.locator('.match .tile[data-mt="l"]:not(.ok)').first();
    await expect(next.or(page.locator('.result-screen'))).toBeVisible();
    if (await page.locator('.result-screen').isVisible()) return;
    const id = await next.getAttribute('data-id');
    if (mistakes > 0) {
      mistakes--;
      await next.click();
      await page.locator(`.match .tile[data-mt="r"]:not(.ok):not([data-id="${id}"])`).first().click();
      continue;
    }
    await next.click();
    await page.locator(`.match .tile[data-mt="r"][data-id="${id}"]`).click();
  }
  throw new Error('гра в пари не завершилась');
}

test.describe('Пари', () => {
  test('3 раунди, лічильник помилок і рекорд', async ({ page }) => {
    await open(page, '#/train/match?cat=service');
    await expect(page.locator('.rounds b')).toHaveText('Раунд 1 з 3');
    await solveMatch(page, { mistakes: 1 });
    await expect(page.locator('.result-screen .msg')).toContainText('1 помилка');
    await expect(page.locator('.miss a')).toHaveCount(2);
    expect(await storage(page, 'safelex:matchBest')).toBeGreaterThan(0);
  });

  test('повторний вибір того самого терміна знімає виділення', async ({ page }) => {
    await open(page, '#/train/match?cat=service');
    const tile = page.locator('.match .tile[data-mt="l"]').first();
    await tile.click();
    await expect(tile).toHaveClass(/sel/);
    await tile.click();
    await expect(tile).not.toHaveClass(/sel/);
  });
});

test.describe('Спринт', () => {
  test('60 секунд, рахунок, рекорд', async ({ page }) => {
    await page.clock.install();
    await open(page, '#/train/sprint?cat=service');
    await expect(page.locator('.q-card .q')).toHaveText('Правильно чи ні?');
    await page.locator('[data-action="sprint-go"]').click();
    for (let i = 0; i < 15; i++) await page.locator(`[data-sprint="${i % 2}"]`).click();
    await expect(page.locator('.sp-score b')).not.toHaveText('');
    await page.clock.runFor(61_000);
    await expect(page.locator('.result-screen')).toBeVisible();
    await expect(page.locator('.result-screen .msg')).toContainText(/із 15|рекорд/);
  });

  test('без термінів показує, що їх замало', async ({ page }) => {
    await open(page, '#/train/sprint?cat=fav');
    await expect(page.locator('.empty-box')).toContainText('Замало термінів');
  });
});
