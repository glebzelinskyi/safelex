// Копія прогресу: збереження у файл (меню «Поділитися» або завантаження), відновлення, нагадування в «Моє».
import { readFileSync } from 'node:fs';
import { test, expect, seed, open, storage } from '../helpers.js';

const PROGRESS = {
  'safelex:best': 7, 'safelex:favs': ['arson'], 'safelex:sprintBest': 12,
  'safelex:srs': { arson: { checks: 3, day: '2026-01-01', due: 0, wrong: 0 }, arsonist: { checks: 1, day: '2026-01-02', due: 0, wrong: 2 } }
};
const DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Підміняє меню «Поділитися»: mode — 'ok', 'abort' (користувач закрив меню), 'fail' (система відмовила) або 'none' (меню немає). */
const stubShare = (page, mode) => page.addInitScript(mode => {
  window.__shared = [];
  if (mode === 'none') {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, 'canShare', { value: d => !!d?.files?.length, configurable: true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
    if (mode === 'abort') throw new DOMException('закрито', 'AbortError');
    if (mode === 'fail') throw new DOMException('не можна', 'NotAllowedError');
    const f = d.files[0];
    window.__shared.push({ name: f.name, type: f.type, text: await f.text() });
  } });
}, mode);

const backupFile = (data, name = 'safelex-progress-2026-01-01.txt') =>
  ({ name, mimeType: 'text/plain', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify({ app: 'safelex', v: 1, saved: '2026-01-01', data })) });

async function pickFile(page, file, button = null) {
  if (!button) {
    await page.locator('[data-action="backup-open"]').click();
    button = page.locator('.backup-sheet [data-action="backup-restore"]');
  }
  const chooser = page.waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(file);
}

async function saveFromSheet(page, how = 'click') {
  await page.locator('[data-action="backup-open"]').click();
  await page.locator('.backup-sheet [data-action="backup-save"]')[how]();
}

const warnToast = page => page.locator('.note-toast.warn');

test.describe('Зберегти прогрес', () => {
  test('через меню «Поділитися»: текстовий файл з усім прогресом', async ({ page }) => {
    await stubShare(page, 'ok');
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    await expect(page.locator('.bk-last')).toHaveText('Є новий прогрес — пора зберегти');
    await expect(page.locator('.backup-link')).toHaveClass(/due/);
    await saveFromSheet(page);
    await expect(page.locator('.note-toast b')).toHaveText('Копію прогресу створено');
    await expect(page.locator('.bk-last')).toHaveText('Остання копія: сьогодні');
    await expect(page.locator('.sheet-wrap')).toHaveCount(0);
    await expect(page.locator('.backup-link')).not.toHaveClass(/due/);

    const [shared] = await page.evaluate(() => window.__shared);
    expect(shared.name).toMatch(/^safelex-progress-\d{4}-\d\d-\d\d\.txt$/);
    expect(shared.type).toBe('text/plain');
    const file = JSON.parse(shared.text);
    expect(file).toMatchObject({ app: 'safelex', v: 1 });
    expect(file.data.days).toHaveLength(7);
    expect(file.data.srs.arson.checks).toBe(3);
    expect(file.data.favs).toEqual(['arson']);
    expect(file.data).toMatchObject({ best: 7, sprintBest: 12 });
    expect(await storage(page, 'safelex:backupAt')).toBeGreaterThan(0);
  });

  test('без меню «Поділитися» файл завантажується', async ({ page }) => {
    await stubShare(page, 'none');
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    const download = page.waitForEvent('download');
    await saveFromSheet(page);
    const d = await download;
    expect(d.suggestedFilename()).toMatch(/^safelex-progress-\d{4}-\d\d-\d\d\.txt$/);
    const file = JSON.parse(readFileSync(await d.path(), 'utf8'));
    expect(file.data.days).toHaveLength(7);
    await expect(page.locator('.note-toast span')).toContainText('у завантаженнях');
    await expect(page.locator('.bk-last')).toHaveText('Остання копія: сьогодні');
  });

  test('закрите меню «Поділитися» не вважається збереженням', async ({ page }) => {
    await stubShare(page, 'abort');
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    let downloads = 0;
    page.on('download', () => downloads++);
    await saveFromSheet(page);
    await page.waitForTimeout(300);
    await expect(page.locator('.backup-sheet')).toBeVisible();
    await expect(page.locator('.note-toast')).toHaveCount(0);
    expect(await storage(page, 'safelex:backupAt')).toBeNull();
    expect(downloads).toBe(0);
  });

  test('система відмовила в «Поділитися» — файл завантажується', async ({ page }) => {
    await stubShare(page, 'fail');
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    const download = page.waitForEvent('download');
    await saveFromSheet(page);
    expect((await download).suggestedFilename()).toContain('safelex-progress-');
    await expect(page.locator('.bk-last')).toHaveText('Остання копія: сьогодні');
  });
});

test.describe('Зберегти прогрес: крайні випадки', () => {
  test('подвійний дотик не відкриває «Поділитися» двічі й не завантажує зайвий файл', async ({ page }) => {
    await seed(page, { days: DAYS, data: PROGRESS });
    await page.addInitScript(() => {
      window.__calls = 0;
      let busy = false;
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
        window.__calls++;
        if (busy) throw new DOMException('уже відкрито', 'InvalidStateError');
        busy = true;
        await new Promise(r => setTimeout(r, 400));
        busy = false;
      } });
    });
    await open(page, '#/me');
    let downloads = 0;
    page.on('download', () => downloads++);
    await saveFromSheet(page, 'dblclick');
    await expect(page.locator('.note-toast b')).toHaveText('Копію прогресу створено');
    expect(await page.evaluate(() => window.__calls)).toBe(1);
    expect(downloads).toBe(0);
  });

  test('недоступне сховище: головна без плашки про збій, файл однаково зберігається', async ({ page }) => {
    await stubShare(page, 'none');
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    await page.goto('./#/');
    await expect(page.locator('.restore-hint')).toBeVisible();
    await expect(page.locator('.save-toast')).toHaveCount(0);
    await page.goto('./#/me');
    const download = page.waitForEvent('download');
    await saveFromSheet(page);
    expect(JSON.parse(readFileSync(await (await download).path(), 'utf8')).data.days).toEqual([]);
  });
});

test.describe('Відновити з файлу', () => {
  test('збережений файл повертає прогрес на «новому телефоні»', async ({ page, browser }) => {
    await stubShare(page, 'ok');
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    await saveFromSheet(page);
    await expect(page.locator('.note-toast')).toBeVisible();
    const [shared] = await page.evaluate(() => window.__shared);

    const phone = await (await browser.newContext({ baseURL: test.info().project.use.baseURL, serviceWorkers: 'block' })).newPage();
    const errors = [];
    phone.on('pageerror', e => errors.push(e.message));
    await seed(phone, { firstLaunch: true });
    await open(phone);
    await expect(phone.locator('a.daily .k')).toHaveText('Серія ще не почалася');
    await pickFile(phone, { name: shared.name, mimeType: shared.type, buffer: Buffer.from(shared.text) }, phone.locator('.restore-hint [data-action="backup-restore"]'));

    await expect(phone.locator('.note-toast b')).toHaveText('Прогрес відновлено');
    await expect(phone.locator('.note-toast span')).toContainText('7 днів занять · 2 терміни із прогресом');
    await expect(phone.locator('a.daily .fire b')).toHaveText('7');
    await expect(phone.locator('.restore-hint')).toHaveCount(0);
    await expect(phone.locator('.tabbar a[data-tab="me"]')).not.toHaveClass(/dot/);   // щойно відновлене не просимо зберігати знову
    await phone.goto('./#/me');
    await expect(phone.locator('.legend')).toContainText('Вивчено 1');
    await expect(phone.locator('.legend')).toContainText('Вчу 1');
    await expect(phone.locator('#savedList .row')).toHaveCount(1);
    await expect(phone.locator('.rank-hero .rh-body > b')).toHaveText('Рядовий');
    expect(errors).toEqual([]);
    await phone.context().close();
  });

  test('прогрес із файлу додається до того, що вже є на телефоні', async ({ page }) => {
    await seed(page, { days: [0, 1], data: {
      'safelex:best': 2, 'safelex:favs': ['arsonist'], 'safelex:sprintBest': 30,
      'safelex:srs': { arson: { checks: 1, day: '2026-02-01', due: 0, wrong: 0 }, alarm: { checks: 2, day: '2026-02-01', due: 0, wrong: 0 } }
    } });
    await open(page, '#/me');
    await pickFile(page, backupFile({
      days: ['2026-01-01', '2026-01-02', '2026-01-03'], best: 3, favs: ['arson'], sprintBest: 12, matchBest: 40,
      srs: { arson: { checks: 3, day: '2026-01-01', due: 0, wrong: 0 }, arsonist: { checks: 1, day: '2026-01-02', due: 0, wrong: 2 } }
    }));
    await expect(page.locator('.note-toast b')).toHaveText('Прогрес відновлено');
    expect(await storage(page, 'safelex:days')).toHaveLength(5);
    expect(await storage(page, 'safelex:best')).toBe(3);
    expect(await storage(page, 'safelex:sprintBest')).toBe(30);
    expect(await storage(page, 'safelex:matchBest')).toBe(40);
    expect((await storage(page, 'safelex:favs')).sort()).toEqual(['arson', 'arsonist']);
    const srs = await storage(page, 'safelex:srs');
    expect(srs.arson.checks).toBe(3);
    expect(Object.keys(srs).sort()).toEqual(['alarm', 'arson', 'arsonist']);
    await expect(page.locator('.me-streak .ms-v b')).toHaveText('3');
    await expect(page.locator('.me-streak .ms-now')).toHaveText('Поточна серія — 2 дні');
  });

  for (const [name, body] of [
    ['не той файл', 'Це просто нотатки'],
    ['чужий JSON', '{"hello":"world"}'],
    ['шкідливий текст', JSON.stringify({ app: '<img src=x onerror=alert(1)>', v: 1, data: {} })]
  ]) test(`${name} — зрозуміле повідомлення, прогрес цілий`, async ({ page }) => {
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    await pickFile(page, backupFile(body, 'notes.txt'));
    await expect(warnToast(page)).toContainText('Це не файл прогресу SafeLex');
    await expect(page.locator('.sr-live')).toContainText('Не вдалося відновити');
    await expect(page.locator('.backup-sheet')).toHaveCount(0);
    expect(await storage(page, 'safelex:days')).toHaveLength(7);
    expect((await storage(page, 'safelex:srs')).arson.checks).toBe(3);
  });

  test('шкідливі значення у файлі прогресу не виконуються і не потрапляють у сховище', async ({ page }) => {
    await seed(page);
    await open(page, '#/me');
    await pickFile(page, backupFile({
      days: ['2026-01-01', '<img src=x onerror="window.__xss=1">'],
      favs: ['arson', '<script>window.__xss=1</script>'],
      srs: { arson: { checks: 2, day: '<b>', due: 0, wrong: 0 }, '"><img src=x onerror=window.__xss=1>': { checks: 3 } }
    }));
    await expect(page.locator('.note-toast b')).toHaveText('Прогрес відновлено');
    expect(await storage(page, 'safelex:days')).toEqual(['2026-01-01']);
    expect(await storage(page, 'safelex:favs')).toEqual(['arson']);
    expect(await storage(page, 'safelex:srs')).toEqual({ arson: { checks: 2, day: '', due: 0, wrong: 0 } });
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();   // сторінка перезавантажилась, і код із файлу не запускався
  });

  test('файл новішої версії просить оновити застосунок', async ({ page }) => {
    await seed(page);
    await open(page, '#/me');
    await pickFile(page, backupFile(JSON.stringify({ app: 'safelex', v: 99, data: {} })));
    await expect(warnToast(page)).toContainText('новішою версією');
  });

  test('файл без нового прогресу нічого не змінює', async ({ page }) => {
    await seed(page, { days: DAYS, data: PROGRESS });
    await open(page, '#/me');
    await pickFile(page, backupFile({ favs: ['arson'], best: 0, srs: { arson: { checks: 1, day: '2025-01-01', due: 0, wrong: 0 } } }));
    await expect(page.locator('.note-toast b')).toHaveText('Нічого нового');
    await expect(warnToast(page)).toHaveCount(0);
    expect((await storage(page, 'safelex:srs')).arson.checks).toBe(3);
  });
});

const meTab = page => page.locator('.tabbar a[data-tab="me"]');

test.describe('Нагадування про копію', () => {
  test('після тижня занять — крапка на вкладці «Моє» і підказка в рядку; після збереження зникають', async ({ page }) => {
    await stubShare(page, 'ok');
    await seed(page, { days: DAYS });
    await open(page);
    await expect(meTab(page)).toHaveClass(/dot/);
    await meTab(page).click();
    await expect(page.locator('.backup-link')).toHaveClass(/due/);
    await expect(page.locator('.bk-last')).toHaveText('Є новий прогрес — пора зберегти');
    await saveFromSheet(page);
    await expect(page.locator('.bk-last')).toHaveText('Остання копія: сьогодні');
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await page.reload();
    await expect(page.locator('.backup-link')).not.toHaveClass(/due/);
    await expect(meTab(page)).not.toHaveClass(/dot/);
  });

  test('відкрив шторку і закрив, не зберігши, — крапка зникає на місяць', async ({ page }) => {
    await page.clock.install();
    await seed(page, { days: DAYS });
    await open(page, '#/me');
    await expect(meTab(page)).toHaveClass(/dot/);
    await expect(meTab(page)).toHaveAttribute('aria-label', /пора зберегти/);
    await page.locator('[data-action="backup-open"]').click();
    await expect(page.locator('.backup-sheet')).toBeVisible();
    await expect(meTab(page)).toHaveClass(/dot/);   // поки шторка відкрита, нагадування ще не відкладено
    await page.keyboard.press('Escape');
    await expect(page.locator('.backup-sheet')).toHaveCount(0);
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await expect(meTab(page)).not.toHaveAttribute('aria-label');
    await expect(page.locator('.backup-link')).not.toHaveClass(/due/);
    await page.reload();
    await expect(page.locator('.backup-link')).toBeVisible();
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await expect(page.locator('.bk-last')).toHaveText('Копію ще не зберігали');
    await page.clock.setFixedTime(Date.now() + 30 * 24 * 3600 * 1000 + 60000);
    await page.reload();
    await expect(meTab(page)).toHaveClass(/dot/);
  });

  test('через місяць нагадує знову, лише якщо прогрес змінився', async ({ page }) => {
    await page.clock.install();
    await stubShare(page, 'ok');
    await seed(page, { days: DAYS });
    await open(page, '#/me');
    await saveFromSheet(page);
    // Чекаємо, поки збереження справді завершиться.
    await expect(page.locator('.note-toast b')).toHaveText('Копію прогресу створено');
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await page.clock.setFixedTime(Date.now() + 31 * 24 * 3600 * 1000);
    await page.reload();
    await expect(page.locator('.backup-link')).toBeVisible();
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await page.evaluate(() => localStorage.setItem('safelex:favs', '["arson"]'));
    await page.reload();
    await expect(meTab(page)).toHaveClass(/dot/);
  });

  test('крапка з’являється одразу після заняття, без перезавантаження', async ({ page }) => {
    await seed(page, { days: [1, 2, 3, 4, 5, 6], data: { 'safelex:best': 6 } });
    await open(page);
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await page.evaluate(() => {
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      const days = JSON.parse(localStorage.getItem('safelex:days'));
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      localStorage.setItem('safelex:days', JSON.stringify(days));
    });
    await page.locator('.tabbar a[data-tab="guide"]').click();
    await expect(meTab(page)).toHaveClass(/dot/);
  });

  test('новачкові нічого не нагадуємо, а пропонуємо відновити з файлу', async ({ page }) => {
    await seed(page, { days: [0, 1, 2, 3, 4, 5], firstLaunch: true });
    await open(page);
    await expect(meTab(page)).not.toHaveClass(/dot/);
    await expect(page.locator('.restore-hint')).toHaveCount(0);   // прогрес уже є

    const fresh = await page.context().newPage();
    await open(fresh);
    await fresh.evaluate(() => { localStorage.clear(); });
    await fresh.reload();
    await expect(fresh.locator('.restore-hint')).toContainText('Вже займалися раніше?');
    await fresh.evaluate(() => localStorage.setItem('safelex:firstSeen', String(Date.now() - 8 * 24 * 3600 * 1000)));
    await fresh.reload();
    await expect(fresh.locator('a.daily')).toBeVisible();
    await expect(fresh.locator('.restore-hint')).toHaveCount(0);
  });
});
