// Копія прогресу: що потрапляє у файл, як він перевіряється і як зливається з прогресом на телефоні.
// Модулі зберігають стан, тому кожен тест завантажує їх наново (vi.resetModules) з чистим localStorage.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { DAY } from '../../js/core/dates.js';

const fresh = async () => { vi.resetModules(); return import('../../js/learn/backup.js'); };
const at = (y, m, d, h = 12) => vi.setSystemTime(new Date(y, m - 1, d, h));
const put = data => { for (const [k, v] of Object.entries(data)) localStorage.setItem('safelex:' + k, JSON.stringify(v)); };
const get = k => JSON.parse(localStorage.getItem('safelex:' + k));
const fileOf = (data, extra = {}) => JSON.stringify({ app: 'safelex', v: 1, saved: '2026-10-09', data, ...extra });
const rec = (checks, day = '', wrong = 0, due = 0) => ({ checks, day, due, wrong });
const ids = () => window.TERMS.slice(0, 6).map(t => t.id);

const OLD_PHONE = () => ({
  srs: { [ids()[0]]: rec(3, '2026-09-20'), [ids()[1]]: rec(1, '2026-10-01', 2) },
  days: ['2026-10-05', '2026-10-06', '2026-10-07'], restoredDays: [],
  best: 3, ranksSeen: [3], matchBest: 42, sprintBest: 17,
  log: { '2026-10-07': { a: 10, r: 8 } },
  favs: [ids()[2]]
});

beforeEach(() => { vi.useFakeTimers(); at(2026, 10, 9); });
afterEach(() => vi.useRealTimers());

describe('файл копії', () => {
  test('містить увесь прогрес і збережені терміни, але не історію пошуку', async () => {
    put({ ...OLD_PHONE(), recent: [ids()[0]], qhist: ['arson'], dailyScore: { date: '2026-10-07', score: 9, total: 10 } });
    const b = await fresh();
    const file = JSON.parse(b.buildBackup());
    expect(file).toMatchObject({ app: 'safelex', v: 1, saved: '2026-10-09' });
    expect(file.data).toEqual(OLD_PHONE());
    expect(b.backupName()).toBe('safelex-progress-2026-10-09.txt');
  });

  test('зберегти → стерти все → відновити повертає той самий прогрес', async () => {
    put(OLD_PHONE());
    let b = await fresh();
    const text = b.buildBackup();
    localStorage.clear();
    b = await fresh();
    expect(b.restoreBackup(text)).toEqual({ changed: true, days: 3, terms: 2, favs: 1 });
    expect(b.readProgress()).toEqual(OLD_PHONE());
    expect(get('days')).toEqual(OLD_PHONE().days);
  });

  test('повторне відновлення того самого файлу нічого не змінює', async () => {
    const b = await fresh();
    const text = fileOf(OLD_PHONE());
    expect(b.restoreBackup(text).changed).toBe(true);
    const snapshot = JSON.stringify({ ...localStorage });
    expect(b.restoreBackup(text).changed).toBe(false);
    expect(JSON.stringify({ ...localStorage })).toBe(snapshot);
  });
});

describe('перевірка файлу', () => {
  test.each([
    ['не JSON', 'привіт'],
    ['порожній', ''],
    ['чужий JSON', '{"name":"x","data":{}}'],
    ['масив', '[1,2,3]'],
    ['без даних', '{"app":"safelex","v":1}'],
    ['без версії', '{"app":"safelex","data":{}}'],
    ['не рядок', null]
  ])('%s — помилка формату, прогрес не чіпається', async (_, text) => {
    put(OLD_PHONE());
    const b = await fresh();
    expect(() => b.restoreBackup(text)).toThrow(expect.objectContaining({ code: 'format' }));
    expect(b.readProgress()).toEqual(OLD_PHONE());
  });

  test('завеликий файл відхиляється без розбору', async () => {
    const b = await fresh();
    expect(() => b.parseBackup(fileOf({}, { pad: 'x'.repeat(b.MAX_BACKUP_CHARS) }))).toThrow(expect.objectContaining({ code: 'format' }));
  });

  test('файл новішої версії — окрема помилка', async () => {
    const b = await fresh();
    expect(() => b.parseBackup(fileOf({}, { v: 2 }))).toThrow(expect.objectContaining({ code: 'version' }));
  });

  test('файл із позначкою BOM читається', async () => {
    const b = await fresh();
    expect(b.parseBackup('\uFEFF' + fileOf(OLD_PHONE())).days).toHaveLength(3);
  });

  test('сміття у файлі відкидається: невідомі терміни, чужі поля, зіпсовані значення', async () => {
    const b = await fresh();
    const data = b.parseBackup(fileOf({
      srs: {
        [ids()[0]]: { checks: 99, day: 'вчора', due: 'x', wrong: -5, fixed: 7, evil: '<img onerror=alert(1)>' },
        'нема-такого': rec(3), __proto__: rec(3), [ids()[1]]: 'рядок'
      },
      days: ['2026-10-07', '2026-10-07', 'сміття', 5, null, '2026-13-99x'],
      best: 'багато', ranksSeen: [3, 4, 'x', 1e9], matchBest: -1, sprintBest: 3.7,
      log: { '2026-10-07': { a: 5, r: 99 }, 'x': { a: 1, r: 1 }, '2026-10-06': 'рядок', '2026-10-05': { a: 0, r: 0 } },
      favs: [ids()[2], ids()[2], 'нема', 7, { a: 1 }],
      extra: 'ігнорується'
    }));
    expect(data).toEqual({
      srs: { [ids()[0]]: { checks: 3, day: '', due: 0, wrong: 0, fixed: 0 } },
      days: ['2026-10-07'], restoredDays: [], best: 0, ranksSeen: [3], matchBest: 0, sprintBest: 4,
      log: { '2026-10-07': { a: 5, r: 5 } },
      favs: [ids()[2]]
    });
  });

  test('дні з майбутнього (неправильна дата на старому телефоні) не потрапляють у прогрес', async () => {
    const b = await fresh();
    const data = b.parseBackup(fileOf({
      days: ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2030-01-01'],
      srs: { [ids()[0]]: rec(2, '2030-01-01', 0, Date.now() + 5000 * DAY) },
      log: { '2030-01-01': { a: 3, r: 3 }, '2026-10-09': { a: 3, r: 3 } }
    }));
    expect(data.days).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);   // +1 день запасу на часові пояси
    expect(data.srs[ids()[0]].day).toBe('');
    expect(data.srs[ids()[0]].due).toBeLessThanOrEqual(Date.now() + 10 * DAY);
    expect(Object.keys(data.log)).toEqual(['2026-10-09']);
  });

  test('рекорд серії з файлу не може бути більшим за кількість днів у ньому', async () => {
    const b = await fresh();
    expect(b.parseBackup(fileOf({ best: 1000, days: ['2026-10-07', '2026-10-08'] })).best).toBe(2);
  });

  test('власні дані на телефоні не обрізаються за датою (годинник могли перевести назад)', async () => {
    put({ days: ['2026-10-09', '2026-10-10'], best: 5 });
    const b = await fresh();
    b.restoreBackup(fileOf({ days: ['2026-10-01'] }));
    expect(get('days')).toEqual(['2026-10-01', '2026-10-09', '2026-10-10']);
    expect(get('best')).toBe(5);
  });
});

describe('злиття', () => {
  const merge = async (mine, theirs) => {
    const b = await fresh();
    return b.mergeProgress(b.cleanProgress(mine), b.cleanProgress(theirs));
  };

  test('дні, збережені терміни і звання об’єднуються', async () => {
    const m = await merge(
      { days: ['2026-10-08', '2026-10-09'], favs: [ids()[0]], ranksSeen: [3] },
      { days: ['2026-10-01', '2026-10-08'], favs: [ids()[1], ids()[0]], ranksSeen: [3, 10] });
    expect(m.days).toEqual(['2026-10-01', '2026-10-08', '2026-10-09']);
    expect(m.favs).toEqual([ids()[0], ids()[1]].sort());
    expect(m.ranksSeen).toEqual([3, 10]);
  });

  test('рекорди: серія і спринт — більше, «Пари» — менший час, нуль означає «ще не грали»', async () => {
    expect(await merge({ best: 4, sprintBest: 20, matchBest: 30 }, { best: 9, sprintBest: 11, matchBest: 45 }))
      .toMatchObject({ best: 9, sprintBest: 20, matchBest: 30 });
    expect((await merge({ matchBest: 0 }, { matchBest: 45 })).matchBest).toBe(45);
    expect((await merge({ matchBest: 45 }, { matchBest: 0 })).matchBest).toBe(45);
    expect((await merge({}, {})).matchBest).toBe(0);
  });

  test('термін: перемагає запис, де більше галочок', async () => {
    const [a, b, c] = ids();
    const m = await merge(
      { srs: { [a]: rec(1, '2026-10-09'), [b]: rec(3, '2026-09-01'), [c]: rec(2, '2026-10-01') } },
      { srs: { [a]: rec(3, '2026-09-01'), [b]: rec(0, '2026-10-08', 4), [ids()[3]]: rec(1, '2026-10-02') } });
    expect(m.srs[a]).toEqual(rec(3, '2026-09-01'));
    expect(m.srs[b]).toEqual(rec(3, '2026-09-01'));
    expect(m.srs[c]).toEqual(rec(2, '2026-10-01'));
    expect(m.srs[ids()[3]]).toEqual(rec(1, '2026-10-02'));
  });

  test('термін: за однакових галочок — новіший день, а за повної рівності лишається запис із телефона', async () => {
    const [a, b] = ids();
    const m = await merge(
      { srs: { [a]: rec(2, '2026-10-01', 0, 111), [b]: rec(2, '2026-10-05', 0, 111) } },
      { srs: { [a]: rec(2, '2026-10-07', 1, 222), [b]: rec(2, '2026-10-05', 0, 222) } });
    expect(m.srs[a]).toEqual(rec(2, '2026-10-07', 1, 222));
    expect(m.srs[b]).toEqual(rec(2, '2026-10-05', 0, 111));
  });

  test('журнал активності: за кожен день береться запис із більшою кількістю відповідей', async () => {
    const m = await merge(
      { log: { '2026-10-08': { a: 10, r: 5 }, '2026-10-09': { a: 3, r: 3 } } },
      { log: { '2026-10-08': { a: 4, r: 4 }, '2026-10-07': { a: 6, r: 2 } } });
    expect(m.log).toEqual({ '2026-10-07': { a: 6, r: 2 }, '2026-10-08': { a: 10, r: 5 }, '2026-10-09': { a: 3, r: 3 } });
  });

  test('злиття ніколи не зменшує зароблене і не залежить від порядку телефонів', async () => {
    const mine = { ...OLD_PHONE(), days: ['2026-10-08', '2026-10-09'], best: 2 };
    const theirs = OLD_PHONE();
    const ab = await merge(mine, theirs), ba = await merge(theirs, mine);
    expect(ab).toEqual(ba);
    expect(ab.days).toHaveLength(5);
    expect(ab.best).toBe(5);   // 5–9 жовтня — одна серія
    for (const id of Object.keys(theirs.srs)) expect(ab.srs[id].checks).toBeGreaterThanOrEqual(theirs.srs[id].checks);
  });

  test('відновлення на телефоні з власним прогресом додає, а не перезаписує', async () => {
    const [a, , , d] = ids();
    put({ srs: { [d]: rec(2, '2026-10-09') }, days: ['2026-10-08', '2026-10-09'], best: 2, favs: [d], sprintBest: 30 });
    const b = await fresh();
    expect(b.restoreBackup(fileOf(OLD_PHONE()))).toEqual({ changed: true, days: 5, terms: 3, favs: 2 });
    expect(get('srs')[d]).toEqual(rec(2, '2026-10-09'));
    expect(get('srs')[a]).toEqual(rec(3, '2026-09-20'));
    expect(get('sprintBest')).toBe(30);
    expect(get('matchBest')).toBe(42);
    expect(get('best')).toBe(5);   // 5–9 жовтня склалися в одну серію
  });

  test('рекорд серії: якщо злиті дні склалися в довшу серію, ніж була на кожному телефоні', async () => {
    const m = await merge(
      { days: ['2026-09-28', '2026-09-29', '2026-09-30'], best: 3 },
      { days: ['2026-10-01', '2026-10-02'], best: 2 });
    expect(m.best).toBe(5);   // 28 вересня – 2 жовтня, через межу місяця
    expect((await merge({ days: ['2026-10-01', '2026-10-03'], best: 1 }, { days: ['2026-10-05'], best: 1 })).best).toBe(1);
    expect((await merge({ days: ['2026-10-01'], best: 40 }, { days: ['2026-10-02'], best: 7 })).best).toBe(40);
  });

  test('серія рахується зі злитих днів', async () => {
    put({ days: ['2026-10-08', '2026-10-09'] });
    const b = await fresh();
    b.restoreBackup(fileOf({ days: ['2026-10-05', '2026-10-06', '2026-10-07'] }));
    vi.resetModules();
    const { streak } = await import('../../js/learn/streak.js');
    expect(streak()).toBe(5);
  });
});

describe('відновлені дні серії у копії', () => {
  test('потрапляють у файл, об’єднуються при злитті й рахуються в серію та рекорд', async () => {
    put({ days: ['2026-10-05', '2026-10-06'], restoredDays: ['2026-10-07'], best: 3 });
    let b = await fresh();
    const text = b.buildBackup();
    expect(JSON.parse(text).data.restoredDays).toEqual(['2026-10-07']);
    localStorage.clear();
    put({ days: ['2026-10-08', '2026-10-09'] });
    b = await fresh();
    b.restoreBackup(text);
    expect(get('restoredDays')).toEqual(['2026-10-07']);
    expect(get('best')).toBe(5);
    vi.resetModules();
    const { streak } = await import('../../js/learn/streak.js');
    expect(streak()).toBe(5);
  });

  test('рекорд із файлу обмежується днями занять разом із відновленими', async () => {
    const b = await fresh();
    expect(b.parseBackup(fileOf({ best: 50, days: ['2026-10-07', '2026-10-08'], restoredDays: ['2026-10-06'] })).best).toBe(3);
  });
});

describe('збій запису', () => {
  test('якщо сховище переповнене, старий прогрес лишається і повертається помилка', async () => {
    put({ days: ['2026-10-09'], best: 1 });
    const b = await fresh();
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (k === 'safelex:log' && v !== '{}') throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, k, v);
    });
    expect(() => b.restoreBackup(fileOf(OLD_PHONE()))).toThrow(expect.objectContaining({ code: 'write' }));
    spy.mockRestore();
    expect(get('days')).toEqual(['2026-10-09']);
    expect(get('best')).toBe(1);
    expect(get('srs')).toEqual({});
  });
});

describe('нагадування про копію', () => {
  const days = n => Array.from({ length: n }, (_, i) => `2026-10-0${9 - i}`);

  test('не з’являється, поки занять менше семи днів', async () => {
    put({ days: days(6) });
    expect((await fresh()).backupDue()).toBe(false);
  });

  test('тренування без завдань дня теж рахуються: сім днів відповідей у журналі', async () => {
    const log = n => Object.fromEntries(days(n).map(k => [k, { a: 5, r: 4 }]));
    put({ log: log(6) });
    expect((await fresh()).backupDue()).toBe(false);
    put({ log: log(7) });
    expect((await fresh()).backupDue()).toBe(true);
  });

  test('з’являється з сьомого дня занять, якщо копії ще не було', async () => {
    put({ days: days(7) });
    expect((await fresh()).backupDue()).toBe(true);
  });

  test('після збереження мовчить місяць, а далі нагадує лише за наявності нового прогресу', async () => {
    put({ days: days(7) });
    const b = await fresh();
    b.markBackedUp();
    expect(b.backupDue()).toBe(false);
    put({ days: days(8) });
    expect(b.backupDue(Date.now() + 29 * DAY)).toBe(false);
    expect(b.backupDue(Date.now() + 30 * DAY)).toBe(true);
    b.markBackedUp(Date.now() + 30 * DAY);
    expect(b.backupDue(Date.now() + 90 * DAY)).toBe(false);   // прогрес не змінювався
  });

  test('відкрив шторку й не зберіг — наступне нагадування через місяць', async () => {
    put({ days: days(7) });
    const b = await fresh();
    b.snoozeBackup();
    expect(b.backupDue(Date.now() + 29 * DAY)).toBe(false);
    expect(b.backupDue(Date.now() + 30 * DAY)).toBe(true);
  });

  test('годинник перевели назад — нагадування не зникає назавжди', async () => {
    put({ days: days(7), backupAt: Date.now() + 100 * DAY, backupSig: 'старий' });
    expect((await fresh()).backupDue()).toBe(true);
  });

  test('після відновлення на новому телефоні не просить одразу зберігати те саме', async () => {
    const b = await fresh();
    b.restoreBackup(fileOf(OLD_PHONE()));
    expect(b.backupDue()).toBe(false);
    expect(b.backupDue(Date.now() + 60 * DAY)).toBe(false);
  });
});
