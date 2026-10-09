import { describe, test, expect, vi } from 'vitest';
import { esc, plural, nDays, typos, sample, shuffle, fmtTime, hashStr, lookup } from '../../js/core/util.js';
import { dayKey, ymd, keyToDate } from '../../js/core/dates.js';
import { createStore, sameShape } from '../../js/core/store.js';

describe('util', () => {
  test('esc екранує всі небезпечні символи HTML', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    expect(esc(null)).toBe('');
    expect(esc(0)).toBe('0');
  });

  test.each([
    [1, 'день'], [2, 'дні'], [4, 'дні'], [5, 'днів'], [11, 'днів'], [12, 'днів'], [14, 'днів'],
    [21, 'день'], [22, 'дні'], [25, 'днів'], [101, 'день'], [111, 'днів'], [0, 'днів']
  ])('plural(%i) → %s', (n, word) => {
    expect(plural(n, 'день', 'дні', 'днів')).toBe(word);
    expect(nDays(n)).toBe(`${n}\u00A0${word}`);
  });

  test('typos рахує відстань Левенштейна', () => {
    expect(typos('evacuation', 'evacuation')).toBe(0);
    expect(typos('evacuaton', 'evacuation')).toBe(1);
    expect(typos('arsno', 'arson')).toBe(2);
    expect(typos('', 'abc')).toBe(3);
  });

  test('sample повертає різні елементи й поважає skip', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const out = sample(arr, 10, x => x % 2 === 0);
    expect(out).toHaveLength(10);
    expect(new Set(out).size).toBe(10);
    expect(out.every(x => x % 2 === 1)).toBe(true);
    expect(sample([1, 2], 5)).toHaveLength(2);
    expect(sample([], 3)).toEqual([]);
  });

  test('shuffle не змінює оригінал і зберігає елементи', () => {
    const arr = [1, 2, 3, 4, 5];
    const s = shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual(arr);
  });

  test('fmtTime, hashStr, lookup', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(75)).toBe('1:15');
    expect(hashStr('2026-10-09')).toBe(hashStr('2026-10-09'));
    expect(hashStr('a')).not.toBe(hashStr('b'));
    const l = lookup([['__proto__', 1], ['x', 2]]);
    expect(Object.getPrototypeOf(l)).toBeNull();
    expect(l.constructor).toBeUndefined();
    expect(l.x).toBe(2);
  });
});

describe('dates', () => {
  test('dayKey рахує дні за місцевим часом', () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 1, 0, 30) }); // 1 березня, 00:30
    expect(dayKey()).toBe('2026-03-01');
    expect(dayKey(1)).toBe('2026-02-28');
    expect(dayKey(-1)).toBe('2026-03-02');
    vi.useRealTimers();
  });

  test('ymd і keyToDate — взаємно обернені', () => {
    expect(ymd(keyToDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('store', () => {
  const memory = () => {
    const m = new Map();
    return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
  };

  test('зберігає й читає JSON', () => {
    const mem = memory(), s = createStore(() => mem);
    s.set('k', { a: [1, 2] });
    expect(s.get('k', {})).toEqual({ a: [1, 2] });
    s.remove('k');
    expect(s.get('k', 'def')).toBe('def');
  });

  test('пошкоджений JSON або інший тип → значення за замовчуванням', () => {
    const mem = memory(), s = createStore(() => mem);
    mem.setItem('bad', '{oops');
    mem.setItem('arr', '[1,2]');
    mem.setItem('nan', 'NaN');
    mem.setItem('str', '"x"');
    expect(s.get('bad', 5)).toBe(5);
    expect(s.get('arr', {})).toEqual({});
    expect(s.get('nan', 0)).toBe(0);
    expect(s.get('str', [])).toEqual([]);
    expect(s.get('missing', 'd')).toBe('d');
  });

  test('недоступне або переповнене сховище не кидає помилок', () => {
    const broken = createStore(() => { throw new Error('SecurityError'); });
    expect(broken.get('k', 1)).toBe(1);
    expect(() => broken.set('k', 1)).not.toThrow();
    expect(() => broken.remove('k')).not.toThrow();
    const full = createStore(() => ({ getItem: () => null, setItem() { throw new Error('QuotaExceeded'); }, removeItem() {} }));
    expect(() => full.set('k', 'v')).not.toThrow();
  });

  test('sameShape розрізняє масиви, об’єкти й числа', () => {
    expect(sameShape([], [])).toBe(true);
    expect(sameShape({}, [])).toBe(false);
    expect(sameShape([], {})).toBe(false);
    expect(sameShape(null, {})).toBe(false);
    expect(sameShape(Infinity, 0)).toBe(false);
    expect(sameShape(3, 0)).toBe(true);
  });
});
