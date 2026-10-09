import { describe, test, expect, vi } from 'vitest';
import { formsOf, apos, createDb } from '../../js/core/db.js';

describe('formsOf — варіанти написання для пошуку', () => {
  test.each([
    ['arson', ['arson']],
    ['hose (pipe)', ['hose pipe', 'hose']],
    ['fire [smoke] alarm', ['fire alarm', 'smoke alarm']],
    ['ladder (pl ladders)', ['ladder']],
    ['  extra   spaces ', ['extra spaces']]
  ])('%s', (en, forms) => {
    expect(formsOf(en).sort()).toEqual(forms.sort());
  });

  test('не розростається безмежно', () => {
    expect(formsOf('a (b) (c) (d) (e) (f) (g) [h, i, j]').length).toBeLessThanOrEqual(24);
  });
});

test('apos замінює апострофи лише всередині українських слів', () => {
  expect(apos("п'ять, пʼять, п`ять")).toBe('п’ять, п’ять, п’ять');
  expect(apos("don't")).toBe("don't");
  expect(apos(5)).toBe(5);
});

describe('createDb', () => {
  const topics = () => [{ id: 'a', ua: "Пов'язане", short: 'A', terms: [] }];

  test('нормалізує поля терміна', () => {
    const TERMS = [{ id: 'x', en: 'fire (smoke) alarm', ua: "сигнал; pl сигнали тривоги.", topic: 'a', ex: ['The alarm rang.', "Пролунав сигнал п'ять разів."] }];
    const db = createDb({ TOPICS: topics(), TERMS, SOURCES: {} });
    const t = db.termById.x;
    expect(t.cat).toBe('a');
    expect(t.senses).toEqual(['сигнал', 'мн. сигнали тривоги.']);
    expect(t.uaShort).toBe('сигнал');
    expect(t.exUa).toBe('Пролунав сигнал п’ять разів.');
    expect(t.forms).toContain('fire alarm');
    expect(t.find).toContain('fire smoke alarm');
    expect(db.CATEGORIES[0].title).toBe('Пов’язане');
  });

  test('пропускає помилкові терміни з попередженням, решта працює', () => {
    const warn = vi.fn();
    const TERMS = [
      { id: 'ok', en: 'ok', ua: 'так', topic: 'a' },
      { en: 'no id', ua: 'x', topic: 'a' },
      { id: 'noua', en: 'x', topic: 'a' },
      { id: 'ok', en: 'dup', ua: 'дубль', topic: 'a' },
      { id: 'cat', en: 'x', ua: 'x', topic: 'missing' },
      null
    ];
    const db = createDb({ TOPICS: topics(), TERMS }, warn);
    expect(db.TERMS.map(t => t.id)).toEqual(['ok']);
    expect(db.TERMS).toBe(TERMS); // той самий масив, що й window.TERMS
    expect(warn.mock.calls.map(c => c[0])).toEqual([
      'SafeLex: термін пропущено — немає id:', 'SafeLex: термін пропущено — немає en або ua:',
      'SafeLex: термін пропущено — id «ok» повторюється:', 'SafeLex: термін пропущено — невідомий розділ «missing»:',
      'SafeLex: термін пропущено — немає id:'
    ]);
  });

  test('підтримує старий формат (CATEGORIES + MARCH_STEPS)', () => {
    const db = createDb({ CATEGORIES: [{ id: 'medical', title: 'Медицина' }], TERMS: [{ id: 'm', en: 'm', ua: 'м', cat: 'medical' }], MARCH_STEPS: [{ letter: 'M' }] });
    expect(db.byCat.medical).toHaveLength(1);
    expect(db.MARCH_STEPS).toHaveLength(1);
  });

  test('порожні дані не ламають застосунок', () => {
    const db = createDb({});
    expect(db.TERMS).toEqual([]);
    expect(db.CATEGORIES).toEqual([]);
  });
});

describe('база data/terms.js', () => {
  // Перевірки якості бази: падають, якщо після редагування terms.js щось пішло не так.
  const warn = vi.fn();
  const src = { TOPICS: globalThis.TOPICS, TERMS: globalThis.TERMS.slice(), SOURCES: globalThis.SOURCES };
  const db = createDb(src, warn);

  test('жоден термін не пропущено через помилку', () => {
    expect(warn).not.toHaveBeenCalled();
    expect(db.TERMS.length).toBe(globalThis.TOPICS.reduce((n, t) => n + t.terms.length, 0));
  });

  test('14 розділів, у кожному є терміни', () => {
    expect(db.CATEGORIES).toHaveLength(14);
    for (const c of db.CATEGORIES) expect(db.byCat[c.id]?.length, c.id).toBeGreaterThan(0);
  });

  test('id — латиниця, цифри й дефіси, без повторів', () => {
    const ids = db.TERMS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  test('у кожного терміна є переклад і приклад з двох речень', () => {
    for (const t of db.TERMS) {
      expect(t.ua.trim(), t.id).not.toBe('');
      expect(t.exEn, t.id).toBeTruthy();
      expect(t.exUa, t.id).toBeTruthy();
    }
  });

  test('є ключові терміни й джерело', () => {
    expect(db.CORE.length).toBeGreaterThan(100);
    for (const t of db.TERMS) expect(db.SOURCES[t.src], t.id).toBeTruthy();
  });

  test('пов’язані терміни (related) посилаються на існуючі id', () => {
    for (const t of db.TERMS) for (const r of t.related || []) expect(db.termById[r], `${t.id} → ${r}`).toBeTruthy();
  });
});
