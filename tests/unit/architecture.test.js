// Перевірки будови проєкту. Ловлять типові помилки, які інакше видно лише на телефоні без інтернету:
// новий файл забули додати в sw.js, неправильний шлях в import, циклічні залежності між модулями.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, posix } from 'node:path';

const ROOT = process.cwd();
const read = p => readFileSync(resolve(ROOT, p), 'utf8');
const code = p => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'); // без коментарів
const walk = dir => readdirSync(resolve(ROOT, dir)).flatMap(f => {
  const p = posix.join(dir, f);
  return statSync(resolve(ROOT, p)).isDirectory() ? walk(p) : [p];
});

const modules = walk('js').filter(f => f.endsWith('.js') && f !== 'js/boot.js');
const sw = read('sw.js'), html = read('index.html');
const ASSETS = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]);

/** Імпорти модуля як шляхи від кореня проєкту. */
const importsOf = file => [...read(file).matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+'([^']+)'|^\s*import\s+'([^']+)'/gm)]
  .map(m => posix.normalize(posix.join(posix.dirname(file), m[1] || m[2])));

describe('файли застосунку', () => {
  test('кожен модуль є в sw.js (працює без інтернету) і в modulepreload (вантажиться паралельно)', () => {
    for (const m of modules) {
      expect(ASSETS, `${m} немає в ASSETS у sw.js`).toContain('./' + m);
      expect(preloads, `${m} немає в <link rel="modulepreload"> в index.html`).toContain(m);
    }
  });

  test('усі файли зі списку sw.js існують', () => {
    for (const a of ASSETS.filter(a => a !== './')) expect(existsSync(resolve(ROOT, a)), a).toBe(true);
  });

  test('index.html підключає базу термінів до модулів і не має inline-скриптів', () => {
    expect(html.indexOf('src="data/terms.js"')).toBeLessThan(html.indexOf('type="module" src="js/main.js"'));
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });
});

describe('модулі', () => {
  const graph = Object.fromEntries(modules.map(m => [m, importsOf(m)]));

  test('усі імпорти ведуть на існуючі файли', () => {
    for (const [m, deps] of Object.entries(graph)) for (const d of deps) expect(modules, `${m} → ${d}`).toContain(d);
  });

  test('немає циклічних залежностей', () => {
    const state = {}, path = [];
    const visit = m => {
      if (state[m] === 'done') return;
      if (state[m] === 'open') throw new Error('Цикл: ' + [...path.slice(path.indexOf(m)), m].join(' → '));
      state[m] = 'open'; path.push(m);
      graph[m].forEach(visit);
      path.pop(); state[m] = 'done';
    };
    expect(() => modules.forEach(visit)).not.toThrow();
  });

  // Шари знизу вгору: модуль може використовувати лише свій або нижчі шари.
  const LAYERS = [
    ['js/config.js', 'js/core/'],
    ['js/data.js', 'js/user.js'],
    ['js/learn/', 'js/search/'],
    ['js/ui/'],
    ['js/router.js'],
    ['js/screens/'],
    ['js/main.js']
  ];
  const layerOf = f => LAYERS.findIndex(l => l.some(p => p.endsWith('/') ? f.startsWith(p) : f === p));

  test('кожен модуль належить до шару', () => {
    for (const m of modules) expect(layerOf(m), m).toBeGreaterThanOrEqual(0);
  });

  test('шари імпортують лише вниз (core не знає про екрани, екрани — про main)', () => {
    for (const [m, deps] of Object.entries(graph)) for (const d of deps)
      expect(layerOf(d), `${m} (шар ${layerOf(m)}) імпортує ${d} (шар ${layerOf(d)})`).toBeLessThanOrEqual(layerOf(m));
  });

  test('core/ не звертається до сторінки — його можна перевіряти без браузера', () => {
    for (const m of modules.filter(m => m.startsWith('js/core/'))) {
      expect(code(m), m).not.toMatch(/\bdocument\.|\bwindow\.|\blocation\.|\bnavigator\./);
    }
  });

  test('innerHTML отримує текст із бази чи від користувача лише через esc() або highlight()', () => {
    // Груба евристика: у шаблонах ${t.en}, ${t.ua}, ${q} тощо без esc(...) — потенційна XSS.
    const risky = /\$\{\s*(?:t|r\.t|o|s|l|h|c|cat|q|best|prev|next|cur|rank|r)\.(?:en|ua|uaShort|full|title|text|desc|exEn|exUa|note|tr|short)\s*\}/;
    for (const m of modules.filter(m => m.startsWith('js/screens/') || m.startsWith('js/ui/')))
      code(m).split('\n').forEach((line, i) => expect(line, `${m}:${i + 1}`).not.toMatch(risky));
  });
});
