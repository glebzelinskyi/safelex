// Відновлення серії: раз на місяць пропущений учора день можна повернути.
import { test, expect, seed, open, storage, finishQuiz } from '../helpers.js';

test.describe('Відновлення серії', () => {
  test('пропустив учора — на головній картка, одне натискання повертає серію', async ({ page }) => {
    await seed(page, { days: [2, 3, 4, 5, 6], data: { 'safelex:best': 5, 'safelex:ranksSeen': [3] } });
    await open(page);
    const card = page.locator('.streak-back');
    await expect(card).toContainText('Серію на 5 днів ще можна врятувати');
    await expect(page.locator('a.daily .fire b')).toHaveText('0');
    await card.locator('[data-action="streak-restore"]').click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.note-toast b')).toHaveText('Серію відновлено');
    await expect(page.locator('.note-toast')).toContainText('6 днів поспіль');
    await expect(page.locator('a.daily .fire b')).toHaveText('6');
    expect(await storage(page, 'safelex:restoredDays')).toHaveLength(1);
    expect(await storage(page, 'safelex:best')).toBe(6);

    await page.reload();
    await expect(page.locator('a.daily .fire b')).toHaveText('6');
    await expect(page.locator('.streak-back')).toHaveCount(0);
    await page.locator('a.daily').click();
    await finishQuiz(page);
    await expect(page.locator('.res-fire')).toContainText('7 днів поспіль');
  });

  test('відновлення, що доводить серію до звання, показує святковий екран', async ({ page }) => {
    await seed(page, { days: [2, 3, 4, 5, 6, 7, 8, 9, 10], data: { 'safelex:best': 9, 'safelex:ranksSeen': [3] } });
    await open(page);
    await page.locator('.streak-back [data-action="streak-restore"]').click();
    await expect(page.locator('.celebrate h2')).toHaveText('Сержант');
    expect(await storage(page, 'safelex:ranksSeen')).toEqual([3, 10]);
  });

  test('у «Моє» картка відновлення є лише після втрати серії, і можна відновити звідти', async ({ page }) => {
    await seed(page, { days: [2, 3, 4], data: { 'safelex:best': 3 } });
    await open(page, '#/me');
    const card = page.locator('.streak-back');
    await expect(card).toContainText('Серію на 3 дні ще можна врятувати');
    await expect(page.locator('.me-streak .ms-now')).toHaveCount(0);
    await card.locator('[data-action="streak-restore"]').click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.me-streak .ms-v b')).toHaveText('4');
    await expect(page.locator('.me-streak .ms-now')).toHaveText('Серія триває — це ваш рекорд');
  });

  test('вдруге за місяць не пропонується', async ({ page }) => {
    await page.clock.install();
    await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
    await seed(page, { days: [2, 3, 4], data: { 'safelex:best': 3, 'safelex:restoredDays': ['2026-10-05'] } });
    await open(page);
    await expect(page.locator('a.daily')).toBeVisible();
    await expect(page.locator('.streak-back')).toHaveCount(0);
    await page.goto('./#/me');
    await expect(page.locator('.me-streak')).toBeVisible();
    await expect(page.locator('.streak-back')).toHaveCount(0);
  });

  test('пропущено два дні — повернути вже не можна', async ({ page }) => {
    await seed(page, { days: [3, 4, 5, 6], data: { 'safelex:best': 4 } });
    await open(page);
    await expect(page.locator('a.daily')).toBeVisible();
    await expect(page.locator('.streak-back')).toHaveCount(0);
    await page.goto('./#/me');
    await expect(page.locator('.me-streak')).toBeVisible();
    await expect(page.locator('.streak-back')).toHaveCount(0);
  });

  test('без рекорду картка серії спокійна й підказує почати', async ({ page }) => {
    await seed(page);
    await open(page, '#/me');
    await expect(page.locator('.me-streak')).toHaveClass(/zero/);
    await expect(page.locator('.me-streak .ms-now')).toHaveText('Почніть із завдання дня');
  });
});
