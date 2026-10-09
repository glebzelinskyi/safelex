import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4173;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Телефон — основна платформа SafeLex.
    ...devices['Pixel 7'],
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'e2e', testDir: 'tests/e2e', use: { reducedMotion: 'reduce' } },
    // Без трейсу: його знімки DOM на десятки тисяч вузлів самі гальмують сторінку й спотворюють заміри.
    { name: 'stress', testDir: 'tests/stress', timeout: 180_000, fullyParallel: false, use: { trace: 'off' } }
  ],
  webServer: {
    command: 'node tests/server.mjs',
    url: `http://localhost:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI
  }
});
