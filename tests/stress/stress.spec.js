// Стрес-тести: те, що описано в README («Як перевірено»), тепер можна повторити командою
//   npm run test:stress
// Пороги часу щедрі (з запасом на повільний CI) — тест ловить «зависання» і витоки, а не мілісекунди.
import { test, expect, seed, open, finishQuiz } from '../helpers.js';

const ROUTES = ['#/', '#/guide', '#/guide/all', '#/guide/water', '#/term/arson', '#/train', '#/train?cat=core',
  '#/train/quiz?cat=service', '#/train/cards?cat=water', '#/train/match?cat=service', '#/train/sprint?cat=all',
  '#/train/mistakes?cat=all', '#/train/daily', '#/me', '#/stats', '#/about', '#/search?q=fire', '#/term/nope'];

async function metrics(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  await cdp.detach();
  const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
  return { heapMB: m.JSHeapUsedSize / 2 ** 20, nodes: m.Nodes, listeners: m.JSEventListeners };
}

/** Швидко міняє адресу n разів, не чекаючи кінця анімацій — як нетерплячий користувач. */
const hop = (page, n, offset = 0) => page.evaluate(async ({ routes, n, offset }) => {
  for (let i = 0; i < n; i++) {
    location.hash = routes[(i * 7 + offset) % routes.length];
    await new Promise(r => setTimeout(r, i % 10 === 0 ? 30 : 4));
  }
  await new Promise(r => setTimeout(r, 1000));
}, { routes: ROUTES, n, offset });

async function stillWorks(page) {
  await page.goto('./#/');
  await page.locator('#q').fill('arson');
  await expect(page.locator('.best .best-ua')).toHaveText('підпал');
  await page.locator('[data-action="clear"]').click();
}

test('600 швидких переходів між екранами — без помилок і витоків пам’яті', async ({ page }) => {
  await seed(page);
  await open(page);
  await hop(page, 100);
  const before = await metrics(page);
  await hop(page, 500, 3);
  await page.goto('./#/');
  await page.waitForTimeout(500);
  const after = await metrics(page);
  console.log('пам’ять/вузли/слухачі до→після', before, after);
  expect(after.heapMB - before.heapMB).toBeLessThan(8);
  expect(after.listeners - before.listeners).toBeLessThan(40);
  expect(after.nodes - before.nodes).toBeLessThan(3000);
  await expect(page.locator('.sheet-wrap, .celebrate')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/dark/);
  await stillWorks(page);
});

test('сотні натискань у кожному режимі тренажера', async ({ page }) => {
  await seed(page);
  await open(page, '#/train/quiz?cat=all');

  // Тест: 300 відповідей поспіль, з перезапусками.
  const answered = await page.evaluate(async () => {
    const tick = () => new Promise(r => setTimeout(r, 0));
    let n = 0;
    while (n < 300) {
      const restart = document.querySelector('[data-action="restart"]');
      if (restart) { restart.click(); await tick(); continue; }
      const opt = document.querySelectorAll('.opt:not(:disabled)');
      if (opt.length) opt[n % opt.length].click();
      else document.querySelector('[data-action="giveup"]')?.click();
      n++; await tick();
      document.querySelector('[data-action="next"]')?.click(); await tick();
    }
    return n;
  });
  expect(answered).toBe(300);
  // Повторні питання після помилки в журнал не пишуться, тому записів менше, ніж натискань.
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('safelex:log')));
  expect(Object.values(log)[0].a).toBeGreaterThanOrEqual(150);

  // Картки: 300 натискань «Знаю/Ще вчу» без пауз — під час анімації зайві ігноруються.
  await page.goto('./#/train/cards?cat=all');
  await page.evaluate(async () => {
    for (let i = 0; i < 300; i++) {
      (document.querySelector('[data-action="restart"]') || document.querySelector(i % 3 ? '[data-action="card-yes"]' : '[data-action="card-no"]')
        || document.querySelector('.flash'))?.click();
      await new Promise(r => setTimeout(r, i % 5 ? 2 : 120));
    }
  });
  await expect(page.locator('.deck .flash, .result-screen').first()).toBeVisible();
  const tally = await page.locator('.counter').textContent();
  expect(tally).toMatch(/^\d+\/\d+$/);

  // Пари: 500 випадкових натискань на плитки.
  await page.goto('./#/train/match?cat=all');
  await page.evaluate(async () => {
    for (let i = 0; i < 500; i++) {
      const tiles = document.querySelectorAll('.match .tile:not(:disabled)');
      const again = document.querySelector('[data-action="restart"]');
      if (again) again.click(); else if (tiles.length) tiles[(i * 37) % tiles.length].click();
      await new Promise(r => setTimeout(r, i % 20 ? 3 : 400));
    }
  });
  await expect(page.locator('.mt-miss, .result-screen').first()).toBeVisible();

  // Спринт: 400 відповідей за кілька секунд — рахунок не перевищує кількість відповідей.
  await page.goto('./#/train/sprint?cat=all');
  await page.locator('[data-action="sprint-go"]').click();
  await page.evaluate(async () => {
    for (let i = 0; i < 400; i++) { document.querySelector(`[data-sprint="${i % 2}"]`)?.click(); if (i % 25 === 0) await new Promise(r => setTimeout(r, 0)); }
  });
  const score = Number(await page.locator('.sp-score b').textContent());
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(400);

  await stillWorks(page);
});

test('екстремальні пошукові запити — без зависань', async ({ page }) => {
  await seed(page);
  await open(page, '#/guide/all');
  const QUERIES = [
    'a'.repeat(10_000), 'вогонь '.repeat(500), '.*+?^${}()|[]\\/', '((((((((((((((((((((', '[[[[[', '\\', '%', '%%20%',
    '🔥🚒🧯'.repeat(200), 'ﷺ‮arson‬', 'a​b‌c', 'Ａｒｓｏｎ', 'ARSON', "п'ять ’ ʼ ` ´ ‘", '́́́',
    Array.from({ length: 300 }, (_, i) => 'word' + i).join(' '), '1234567890'.repeat(100), ' '.repeat(5000), '\n\t\r',
    'fire fire fire fire fire fire fire fire fire fire fire fire fire', 'ёъыэ', 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.'
  ];
  const times = await page.evaluate(qs => qs.map(q => {
    const input = document.getElementById('gq');
    const t0 = performance.now();
    input.value = q; input.dispatchEvent(new Event('input'));
    return Math.round(performance.now() - t0);
  }), QUERIES);
  console.log('час фільтра, мс:', times.join(' '));
  for (const t of times) expect(t).toBeLessThan(1500);

  await page.goto('./#/');
  for (const q of QUERIES) {
    await page.locator('#q').fill(q);
    await expect(page.locator('#homeBody')).not.toBeEmpty();
  }
  await stillWorks(page);
});

test('прогрес на всі терміни, серія 1000 днів і тисячі збережених — усі екрани швидкі', async ({ page }) => {
  await seed(page);
  await open(page);
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const key = ago => { const d = new Date(); d.setDate(d.getDate() - ago); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const srs = {}, log = {};
    window.TERMS.forEach((t, i) => { srs[t.id] = { checks: i % 4 === 0 ? 1 : 3, day: key(1), due: Date.now() - (i % 2) * 1e3, wrong: i % 7 }; });
    for (let i = 0; i < 400; i++) log[key(i)] = { a: 30 + i % 50, r: 20 };
    for (let i = 0; i < 20000; i++) srs['ghost-' + i] = { checks: 1, day: '', due: 0, wrong: 1 }; // терміни, яких уже немає в базі
    const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    s('safelex:srs', srs); s('safelex:log', log);
    s('safelex:days', Array.from({ length: 1000 }, (_, i) => key(i + 1)));
    s('safelex:best', 1000);
    s('safelex:favs', window.TERMS.map(t => t.id));
    s('safelex:ranksSeen', [3, 10, 30, 60, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });
  await page.reload();
  for (const hash of ['#/', '#/guide', '#/guide/all', '#/train', '#/train?cat=fav', '#/me', '#/stats', '#/train/mistakes?cat=all', '#/train/daily']) {
    const t0 = Date.now();
    await page.goto('./' + hash);
    await expect(page.locator('#app > *').first()).toBeVisible();
    const ms = Date.now() - t0;
    console.log(hash, ms, 'мс');
    expect(ms).toBeLessThan(4000);
  }
  await page.goto('./#/');
  await expect(page.locator('a.daily .fire b')).toHaveText('1000');
  await page.goto('./#/me');
  await expect(page.locator('.rank-hero .rh-body > b')).toHaveText('Генерал');
  await page.goto('./#/train/quiz?cat=fav');
  await finishQuiz(page);
  // Журнал активності обрізається до 400 днів — сховище не росте безмежно.
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('safelex:log'))).length)).toBeLessThanOrEqual(400);
});

test('процесор сповільнений ушестеро — запуск, пошук і переходи без «зависань»', async ({ page }) => {
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.addInitScript(() => {
    window.__longest = 0;
    new PerformanceObserver(l => l.getEntries().forEach(e => { window.__longest = Math.max(window.__longest, e.duration); }))
      .observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await open(page);
  const startMs = Date.now() - t0;
  console.log('запуск ×6:', startMs, 'мс');
  expect(startMs).toBeLessThan(10_000);

  await page.locator('#q').pressSequentially('breathing', { delay: 30 });
  await expect(page.locator('#homeBody a.result, #homeBody .best').first()).toBeVisible();
  await page.locator('#q').press('Enter'); // ховає клавіатуру, разом з нею повертається нижнє меню
  for (const tab of ['guide', 'train', 'me', 'home']) {
    await page.locator(`.tabbar a[data-tab="${tab}"]`).click();
    await expect(page.locator(`.tabbar a[data-tab="${tab}"]`)).toHaveClass(/active/);
  }
  await page.goto('./#/guide/all');
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 3000);
  await page.goto('./#/train/quiz?cat=service');
  await finishQuiz(page);
  const longest = await page.evaluate(() => window.__longest);
  console.log('найдовша блокуюча задача ×6:', Math.round(longest), 'мс');
  expect(longest).toBeLessThan(3000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test.describe('без мережі', () => {
  test.use({ serviceWorkers: 'allow' });

  test('без мережі й зі сповільненим процесором відкривається з пам’яті', async ({ page, context }) => {
    await seed(page);
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
    await context.setOffline(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await page.reload();
      await expect(page.locator('#q')).toBeVisible();
      expect(Date.now() - t0).toBeLessThan(10_000);
    }
    await hop(page, 120);
    await stillWorks(page);
    await context.setOffline(false);
  });
});

test('заставка розчиняється плавно навіть на повільному телефоні (процесор ×4)', async ({ page }) => {
  for (const returning of [false, true]) {
    await page.context().clearCookies();
    const p = await page.context().newPage();
    const cdp = await page.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.addInitScript(r => {
      try { sessionStorage.getItem('x') || (localStorage.clear(), r && localStorage.setItem('safelex:launched', '1')); sessionStorage.setItem('x', 1); } catch {}
      window.__f = []; let last = 0;
      const f = t => { if (last && document.querySelector('#splash.hide')) window.__f.push(t - last); last = t; if (t < 6000) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }, returning);
    await p.goto('./');
    await expect(p.locator('#splash')).not.toBeAttached({ timeout: 6000 });
    const gaps = await p.evaluate(() => window.__f);
    const janky = gaps.filter(g => g > 50).length;
    console.log(returning ? 'наступний запуск' : 'перший запуск', 'кадрів:', gaps.length, 'найдовший:', Math.round(Math.max(...gaps)), 'мс, пропусків >50 мс:', janky);
    // Розчинення заставки (~0,34 с) має йти рівно: на 60 кадрах/с кадр — ~17 мс.
    expect(gaps.length).toBeGreaterThan(8);
    expect(Math.max(...gaps)).toBeLessThan(50);
    await p.close();
  }
});
