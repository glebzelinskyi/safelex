// Спільне для браузерних тестів: перевірка, що в консолі немає помилок,
// і заготовки збереженого прогресу.
import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend({
  // Будь-яка помилка JS або console.error на сторінці валить тест.
  pageErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await use(errors);
    expect(errors, 'помилки на сторінці').toEqual([]);
  }, { auto: true }]
});

/**
 * Записує дані в localStorage до запуску застосунку — один раз на вкладку,
 * щоб перезавантаження сторінки не затирало те, що зберіг сам застосунок.
 * `days` — скільки днів тому виконано завдання дня (дати рахує браузер у своєму часовому поясі).
 */
export async function seed(page, { data = {}, days = null, firstLaunch = false } = {}) {
  await page.addInitScript(({ data, days, firstLaunch }) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      if (!firstLaunch) localStorage.setItem('safelex:launched', '1');
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      if (days) {
        const pad = n => String(n).padStart(2, '0');
        const key = ago => { const d = new Date(); d.setDate(d.getDate() - ago); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
        localStorage.setItem('safelex:days', JSON.stringify(days.map(key)));
      }
    } catch {}
  }, { data, days, firstLaunch });
}

/** Відкриває застосунок і чекає, поки головний екран намалюється. */
export async function open(page, hash = '#/') {
  await page.goto('./' + hash);
  await expect(page.locator('#app > *').first()).toBeVisible();
}

export const storage = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);

/**
 * Знаходить правильну відповідь на поточне питання тренажера так, як це зробила б людина
 * з відкритим словником: за текстом питання і базою термінів (window.TERMS з data/terms.js).
 * Повертає { id } для питань з варіантами або { en } для питань «Напишіть англійською».
 */
export const solveQuestion = page => page.evaluate(() => {
  const ask = document.querySelector('.q-card .q')?.textContent ?? '';
  const byId = id => window.TERMS.find(t => t.id === id);
  const fits = t => t && (t.en === ask || t.ua === ask || t.full === ask ||
    (ask.includes('_____') && (t.exEn || '').startsWith(ask.split('_____')[0])));
  const ids = [...document.querySelectorAll('.opt')].map(b => b.dataset.pick);
  if (ids.length) return { id: ids.find(id => fits(byId(id))) ?? null, ids };
  const t = window.TERMS.find(t => t.ua === ask);
  return { en: t ? t.en : null, ids: [] };
});

/** Проходить тест до екрана результату. right=true — правильні відповіді, false — помилки. */
export async function finishQuiz(page, { right = true, max = 80 } = {}) {
  for (let n = 0; n < max; n++) {
    // Під час плавного переходу новий екран з'являється не одразу — чекаємо питання або результат.
    await expect(page.locator('.opt:not(:disabled), #ans, .result-screen').first()).toBeVisible();
    if (await page.locator('.result-screen').isVisible()) return;
    const s = await solveQuestion(page);
    if (!s.ids.length) {
      if (right && s.en) { await page.locator('#ans').fill(s.en); await page.locator('[data-action="check"]').click(); }
      else await page.locator('[data-action="giveup"]').click();
    } else {
      const pick = right ? s.id ?? s.ids[0] : s.ids.find(id => id !== s.id) ?? s.ids[0];
      await page.locator(`.opt[data-pick="${pick}"]`).click();
    }
    await page.locator('[data-action="next"]').click();
  }
  throw new Error('тест не завершився');
}
