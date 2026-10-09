import { test, expect, seed, open, storage } from '../helpers.js';

test.beforeEach(async ({ page }) => { await seed(page); });

test.describe('Головний екран', () => {
  test('показує пошук, завдання дня, термін дня й нижнє меню', async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle(/SafeLex/);
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('a.daily')).toContainText('Завдання дня');
    await expect(page.locator('.tod')).toContainText('Термін дня');
    await expect(page.locator('.tabbar a')).toHaveCount(4);
    await expect(page.locator('.tabbar a[data-tab="home"]')).toHaveClass(/active/);
    await expect(page.locator('#qchips')).toContainText('Спробуйте');
  });

  test('заставка показується лише при першому запуску', async ({ page }) => {
    const fresh = await page.context().newPage();
    await seed(fresh, { firstLaunch: true });
    await fresh.goto('./');
    await expect(fresh.locator('#splash')).toBeAttached();
    await expect(fresh.locator('#splash')).not.toBeAttached({ timeout: 3000 });
    await fresh.reload();
    await expect(fresh.locator('#splash')).not.toBeAttached();
  });

  test('«Термін дня» відкриває переклад і показує інший термін', async ({ page }) => {
    await open(page);
    const tod = page.locator('.tod');
    const first = await tod.locator('.tod-en').textContent();
    await tod.locator('[data-action="tod-reveal"]').click();
    await expect(tod.locator('[data-action="tod-reveal"]')).toHaveAttribute('aria-expanded', 'true');
    await tod.locator('[data-action="tod-next"]').click();
    await expect(page.locator('.tod .label')).toHaveText('Випадковий термін');
    await expect(page.locator('.tod .tod-en')).not.toHaveText(first);
  });
});

test.describe('Пошук', () => {
  test('точний збіг англійською показується карткою з перекладом', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('arson');
    const best = page.locator('.best');
    await expect(best.locator('.best-en')).toHaveText('arson');
    await expect(best.locator('.best-ua')).toHaveText('підпал');
    await expect(page.locator('a.result').first()).toBeVisible();
  });

  test('шукає українською з урахуванням закінчень', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('підпалу');
    await expect(page.locator('a.result, .best').first()).toBeVisible();
    await expect(page.locator('#homeBody')).toContainText('arson');
  });

  test('виправляє розкладку клавіатури', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('фкыщт'); // «arson» в українській розкладці
    await expect(page.locator('.sr-note')).toContainText('інша розкладка');
    await expect(page.locator('.best .best-en')).toHaveText('arson');
  });

  test('знаходить слово з одруківкою', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('evacuaton'); // приклад з README
    await expect(page.locator('#homeBody')).toContainText('evacuation');
  });

  test('порожній результат пояснює, що робити', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('zzqqxxwv');
    await expect(page.locator('.sr-empty')).toContainText('Нічого не знайдено');
  });

  test('фільтр за розділом і кнопка очищення', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('fire');
    const chips = page.locator('#qchips [data-cat]');
    await expect(chips.first()).toHaveText(/Усі/);
    expect(await chips.count()).toBeGreaterThan(2);
    const second = chips.nth(1);
    const cat = await second.getAttribute('data-cat');
    await second.click();
    await expect(page.locator(`#qchips [data-cat="${cat}"]`)).toHaveClass(/active/);
    await page.locator('[data-action="clear"]').click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('a.daily')).toBeVisible();
  });

  test('Enter зберігає запит в історії, історію можна очистити', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('ladder');
    await page.locator('#q').press('Enter');
    await page.locator('[data-action="clear"]').click();
    await expect(page.locator('#qchips')).toContainText('Ви шукали');
    await expect(page.locator('#qchips [data-q="ladder"]')).toBeVisible();
    expect(await storage(page, 'safelex:qhist')).toEqual(['ladder']);
    await page.locator('[data-action="qhist-clear"]').click();
    await expect(page.locator('#qchips')).toContainText('Спробуйте');
  });

  test('запит з адреси #/search?q= підставляється в поле', async ({ page }) => {
    await open(page, '#/search?q=arson');
    await expect(page.locator('#q')).toHaveValue('arson');
    await expect(page.locator('.best .best-en')).toHaveText('arson');
  });

  test('показує не більше 50 результатів', async ({ page }) => {
    await open(page);
    await page.locator('#q').fill('a');
    await expect(page.locator('#homeBody .meta').first()).toContainText('показано перші 50');
    expect(await page.locator('a.result').count()).toBeLessThanOrEqual(50);
  });
});
