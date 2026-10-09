import { describe, test, expect } from 'vitest';
import { normS, wordsOf, stem, swapLayout } from '../../js/search/text.js';
import { createSearchEngine } from '../../js/search/engine.js';
import { highlight, exSnippet } from '../../js/search/highlight.js';
import { TERMS } from '../../js/data.js';

describe('text', () => {
  test('normS прибирає наголоси й вирівнює апострофи', () => {
    expect(normS('Зва́ння п’ять ЁЖ')).toBe("звання п'ять еж");
  });
  test('wordsOf ділить на слова', () => {
    expect(wordsOf("Fire-fighter's  hose, 2 'шланги'")).toEqual(["fire", "fighter's", 'hose', '2', 'шланги']);
  });
  test.each([['рукава', 'рукав'], ['ladders', 'ladder'], ['burning', 'burn'], ['ab', 'ab'], ['fire', 'fire']])('stem(%s) → %s', (w, s) => {
    expect(stem(w)).toBe(s);
  });
  test('swapLayout перекладає з іншої розкладки в обидва боки', () => {
    expect(swapLayout('фкыщт')).toBe('arson');
    expect(swapLayout('ujhsyyz')).toBe('горіння');
    expect(swapLayout('mixed змішано')).toBe('');
  });
});

describe('пошук по справжній базі', () => {
  const { search } = createSearchEngine(TERMS);
  const top = q => search(q).list[0]?.t.en;
  const has = (q, en) => search(q).list.some(r => r.t.en === en);

  test('точний збіг англійською — першим', () => {
    expect(top('arson')).toBe('arson');
    expect(search('arson').list[0].score).toBeGreaterThanOrEqual(100);
  });
  test('українською, з іншими закінченнями', () => {
    expect(has('підпал', 'arson')).toBe(true);
    expect(has('підпалу', 'arson')).toBe(true);
  });
  test('інша розкладка', () => {
    const r = search('фкыщт');
    expect(r.layout).toBe('arson');
    expect(r.list[0].t.en).toBe('arson');
  });
  test('одруківка позначається як неточний збіг', () => {
    const r = search('evacuaton');
    expect(r.list.length).toBeGreaterThan(0);
    expect(r.list[0].fuzzy).toBe(true);
    expect(r.list[0].t.en).toMatch(/evacuation/);
  });
  test('кілька слів у будь-якому порядку', () => {
    expect(has('alarm fire', 'fire alarm')).toBe(true);
  });
  test('пошук у межах переданого списку', () => {
    const water = TERMS.filter(t => t.cat === 'water');
    expect(search('fire', water).list.every(r => r.t.cat === 'water')).toBe(true);
  });
  test('порожні, дивні й величезні запити не ламаються', () => {
    for (const q of ['', '   ', '((((', '.*+?^${}()|[]\\', '🔥', 'a'.repeat(10000), '́']) {
      expect(() => search(q)).not.toThrow();
    }
    expect(search('').list).toEqual([]);
    expect(search('zzqqxxwv').list).toEqual([]);
  });
  test('однаковий запит береться з пам’яті', () => {
    expect(search('ladder')).toBe(search('ladder'));
  });
  test('нещодавно переглянуті піднімаються вище', () => {
    const plain = createSearchEngine(TERMS).search('fire');
    const id = plain.list[5].t.id;
    const boosted = createSearchEngine(TERMS, { isRecent: x => x === id }).search('fire');
    expect(boosted.list.find(r => r.t.id === id).score).toBeCloseTo(plain.list[5].score + 2);
  });
});

describe('highlight', () => {
  test('обгортає знайдене слово в <mark> і екранує решту', () => {
    expect(highlight('<b>fire</b> alarm', ['alarm'])).toBe('&lt;b&gt;fire&lt;/b&gt; <mark>alarm</mark>');
  });
  test('лише на початку слова', () => {
    expect(highlight('firefighter fire', ['fighter'])).toBe('firefighter fire');
  });
  test('спецсимволи в словах не ламають регулярний вираз', () => {
    expect(() => highlight('a(b)c', ['(b', '[', '\\'])).not.toThrow();
    expect(highlight('x', [])).toBe('x');
  });
  test('апострофи будь-якого виду', () => {
    expect(highlight('п’ять', ["п'ять"])).toBe('<mark>п’ять</mark>');
  });
});

test('exSnippet вирізає шматок прикладу навколо слова', () => {
  const t = { exEn: 'A'.repeat(100) + ' hydrant ' + 'B'.repeat(100), exUa: '' };
  const s = exSnippet(t, ['hydrant']);
  expect(s).toContain('hydrant');
  expect(s.startsWith('…') && s.endsWith('…')).toBe(true);
  expect(s.length).toBeLessThan(80);
});
