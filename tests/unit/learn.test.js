// Логіка навчання: галочки, повторення, серія днів, звання, питання.
// Модулі зберігають стан, тому кожен тест завантажує їх наново (vi.resetModules) з чистим localStorage.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { MASTERED, REVIEW_DAYS } from '../../js/config.js';
import { DAY } from '../../js/core/dates.js';

const fresh = async () => {
  vi.resetModules();
  return {
    srs: await import('../../js/learn/srs.js'),
    streak: await import('../../js/learn/streak.js'),
    activity: await import('../../js/learn/activity.js'),
    questions: await import('../../js/learn/questions.js'),
    ranks: await import('../../js/learn/ranks.js'),
    reset: await import('../../js/learn/reset.js'),
    data: await import('../../js/data.js')
  };
};
const at = (y, m, d, h = 12) => vi.setSystemTime(new Date(y, m - 1, d, h));
const pad = n => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

beforeEach(() => { vi.useFakeTimers(); at(2026, 10, 9); });
afterEach(() => vi.useRealTimers());

describe('applyAnswer — правило галочок', async () => {
  const { srs: { applyAnswer } } = await fresh();
  const blank = () => ({ checks: 0, day: '', due: 0, wrong: 0 });

  test('правильна відповідь: +1 галочка, повторення за розкладом', () => {
    const s = blank();
    expect(applyAnswer(s, true, 'd1', 1000)).toEqual({ gain: 1, checks: 1, mastered: false });
    expect(s).toMatchObject({ checks: 1, day: 'd1', due: 1000 + REVIEW_DAYS[1] * DAY });
  });

  test('не більше однієї галочки на день', () => {
    const s = blank();
    applyAnswer(s, true, 'd1', 0);
    expect(applyAnswer(s, true, 'd1', 0).gain).toBe(0);
    expect(s.checks).toBe(1);
  });

  test(`вивчено після ${MASTERED} різних днів, далі галочки не ростуть`, () => {
    const s = blank();
    let g;
    for (let d = 1; d <= MASTERED; d++) g = applyAnswer(s, true, 'd' + d, 0);
    expect(g.mastered).toBe(true);
    expect(applyAnswer(s, true, 'd99', 0)).toEqual({ gain: 0, checks: MASTERED, mastered: false });
  });

  test('помилка: −1 галочка (не нижче 0), лічильник помилок, повторити одразу', () => {
    const s = { checks: 2, day: 'd1', due: 5e12, wrong: 0, box: 4 };
    expect(applyAnswer(s, false, 'd2', 777)).toEqual({ gain: -1, checks: 1, mastered: false });
    expect(s).toEqual({ checks: 1, day: 'd1', due: 777, wrong: 1 });
    applyAnswer(s, false, 'd2', 0); applyAnswer(s, false, 'd2', 0);
    expect(s.checks).toBe(0);
    expect(s.wrong).toBe(3);
  });
});

describe('sanitizeSrs', async () => {
  const { srs: { sanitizeSrs } } = await fresh();
  test('виправляє пошкоджені записи й переводить старий формат', () => {
    const out = sanitizeSrs({
      ok: { checks: 2, day: 'd', due: 5, wrong: 1 },
      bad: null, str: 'x', arr: [1],
      big: { checks: 99, due: 'soon', wrong: -3, day: 5 },
      old4: { box: 4 }, old2: { box: 2 }, old0: { box: 0 }, nan: { checks: NaN }
    });
    expect(Object.keys(out).sort()).toEqual(['big', 'nan', 'ok', 'old0', 'old2', 'old4']);
    expect(out.big).toMatchObject({ checks: MASTERED, due: 0, wrong: 0, day: '' });
    expect([out.old4.checks, out.old2.checks, out.old0.checks, out.nan.checks]).toEqual([MASTERED, 1, 0, 0]);
  });
});

describe('grade — з сховищем і журналом', () => {
  test('зберігає прогрес у localStorage і записує відповідь у журнал', async () => {
    const { srs } = await fresh();
    srs.grade('arson', true);
    srs.grade('arson', false);
    expect(JSON.parse(localStorage.getItem('safelex:srs')).arson).toMatchObject({ checks: 0, wrong: 1 });
    expect(JSON.parse(localStorage.getItem('safelex:log'))[key(2026, 10, 9)]).toEqual({ a: 2, r: 1 });
  });

  test('стан коректно відновлюється після перезапуску', async () => {
    let m = await fresh();
    m.srs.grade('arson', true);
    at(2026, 10, 10); m.srs.grade('arson', true);
    m = await fresh();
    expect(m.srs.boxOf('arson')).toBe(2);
    expect(m.srs.statusOf('arson')).toBe('learning');
    expect(m.srs.statusOf('arsonist')).toBe('new');
  });

  test('noteMistake (спринт) не знімає галочку, але додає в «Помилки»', async () => {
    const { srs } = await fresh();
    srs.grade('arson', true);
    srs.noteMistake('arson');
    expect(srs.boxOf('arson')).toBe(1);
    expect(srs.mistakesIn('all').map(t => t.id)).toEqual(['arson']);
    expect(srs.isDue('arson')).toBe(true);
  });

  test('правильна відповідь у «Роботі над помилками» прибирає термін зі списку до наступної помилки', async () => {
    let { srs } = await fresh();
    srs.grade('arson', false);
    srs.resolveMistake('arson');
    expect(srs.mistakesIn('all')).toEqual([]);
    ({ srs } = await fresh());
    expect(srs.mistakesIn('all')).toEqual([]);
    expect(srs.srs.arson.wrong).toBe(1);
    srs.grade('arson', false);
    expect(srs.mistakesIn('all').map(t => t.id)).toEqual(['arson']);
  });

  test('журнал зберігає не більше 400 днів', async () => {
    const log = {};
    for (let i = 0; i < 500; i++) log[`2000-${String(i).padStart(5, '0')}`] = { a: 1, r: 1 };
    localStorage.setItem('safelex:log', JSON.stringify(log));
    const { activity } = await fresh();
    activity.logAnswer(true);
    expect(Object.keys(activity.actLog)).toHaveLength(400);
    expect(activity.actLog[key(2026, 10, 9)]).toEqual({ a: 1, r: 1 });
  });
});

describe('pickTerms — порядок тренування', () => {
  test('спершу ті, що чекають повторення, потім нові (ключові першими), потім решта', async () => {
    const { srs, data } = await fresh();
    const pool = data.byCat.service;
    const [dueT, laterT] = pool.filter(t => !t.core);
    srs.srs[dueT.id] = { checks: 1, day: '', due: Date.now() - 1, wrong: 0 };
    srs.srs[laterT.id] = { checks: 1, day: '', due: Date.now() + DAY, wrong: 0 };
    const picked = srs.pickTerms(pool, pool.length);
    expect(picked[0]).toBe(dueT);
    expect(picked[1].core).toBe(true);
    expect(picked.at(-1)).toBe(laterT);
    expect(new Set(picked).size).toBe(pool.length);
  });
});

describe('серія днів і звання', () => {
  const setDays = (...ago) => localStorage.setItem('safelex:days', JSON.stringify(ago.map(a => key(2026, 10, 9 - a))));

  test('серія рахується від учора, поки сьогодні не виконано', async () => {
    setDays(1, 2, 3, 5);
    const { streak } = await fresh();
    expect(streak.doneToday()).toBe(false);
    expect(streak.streak()).toBe(3);
  });

  test('пропущений учорашній день обнуляє серію', async () => {
    setDays(2, 3);
    const { streak } = await fresh();
    expect(streak.streak()).toBe(0);
  });

  test('серія понад 400 днів не обрізається після перезапуску', async () => {
    const ago = n => { const d = new Date(2026, 9, 9 - n); return key(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    localStorage.setItem('safelex:days', JSON.stringify(Array.from({ length: 499 }, (_, i) => ago(i + 1))));
    let m = await fresh();
    expect(m.streak.finishDaily(10, 10)).toMatchObject({ title: 'Підполковник', days: 500 });
    m = await fresh();
    expect(m.streak.streak()).toBe(500);
  });

  test('завдання дня на третій день присвоює «Рядовий» лише один раз', async () => {
    setDays(1, 2);
    let m = await fresh();
    expect(m.streak.finishDaily(8, 10)).toMatchObject({ title: 'Рядовий', days: 3 });
    expect(m.streak.streak()).toBe(3);
    expect(JSON.parse(localStorage.getItem('safelex:dailyScore'))).toEqual({ date: key(2026, 10, 9), score: 8, total: 10 });
    m = await fresh();
    expect(m.streak.finishDaily(10, 10)).toBeNull();
  });

  test('звання не присвоюється вдруге, якщо рекорд уже був вищим', async () => {
    setDays(1, 2);
    localStorage.setItem('safelex:best', '50');
    const { streak } = await fresh();
    expect(streak.finishDaily(5, 10)).toBeNull();
    expect(streak.bestStreak()).toBe(50);
  });

  test('rankOf / nextRank на межах', async () => {
    const { ranks: { rankOf, nextRank, RANKS, RANK_INS } } = await fresh();
    expect(rankOf(0).title).toBe('Курсант');
    expect(rankOf(2).title).toBe('Курсант');
    expect(rankOf(3).title).toBe('Рядовий');
    expect(rankOf(5000).title).toBe('Генерал');
    expect(nextRank(1000)).toBeNull();
    expect(nextRank(9).title).toBe('Сержант');
    expect(RANK_INS).toHaveLength(RANKS.length);
    expect(RANKS.map(r => r.days)).toEqual([...RANKS.map(r => r.days)].sort((a, b) => a - b));
  });

  test('rankDate: дата майбутнього звання', async () => {
    setDays(0, 1);
    const { streak } = await fresh();
    expect(streak.rankDate(2)).toBeNull();
    expect(streak.rankDate(10)).toBe('17 жовтня');
  });
});

describe('відновлення серії', () => {
  const ago = n => { const d = new Date(2026, 9, 9 - n); return key(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const setDays = (...n) => localStorage.setItem('safelex:days', JSON.stringify(n.map(ago)));
  const stored = k => JSON.parse(localStorage.getItem('safelex:' + k));

  test('пропущений учора день повертає серію, а рекорд і звання оновлюються', async () => {
    setDays(2, 3, 4, 5, 6, 7, 8, 9, 10);
    localStorage.setItem('safelex:best', '9');
    localStorage.setItem('safelex:ranksSeen', '[3]');
    const { streak } = await fresh();
    expect(streak.streak()).toBe(0);
    expect(streak.restoreOffer()).toEqual({ day: key(2026, 10, 8), lost: 9 });
    expect(streak.restoreStreak()).toMatchObject({ streak: 10, rank: { title: 'Сержант' } });
    expect(streak.streak()).toBe(10);
    expect(stored('best')).toBe(10);
    expect(stored('restoredDays')).toEqual([key(2026, 10, 8)]);
    expect(streak.doneToday()).toBe(false);
    expect(streak.finishDaily(10, 10)).toBeNull();
    expect(streak.streak()).toBe(11);
  });

  test('можна відновити й після того, як сьогодні вже виконано', async () => {
    setDays(0, 2, 3, 4);
    const { streak } = await fresh();
    expect(streak.streak()).toBe(1);
    expect(streak.restoreStreak().streak).toBe(5);
  });

  test('відновлений день зберігається після перезапуску', async () => {
    setDays(2, 3, 4);
    let m = await fresh();
    m.streak.restoreStreak();
    m = await fresh();
    expect(m.streak.streak()).toBe(4);
    expect(m.streak.restoreOffer()).toBeNull();
  });

  test('лише один раз на місяць', async () => {
    setDays(2, 3, 4);
    localStorage.setItem('safelex:restoredDays', JSON.stringify([key(2026, 10, 2)]));
    const { streak } = await fresh();
    expect(streak.restoreOffer()).toBeNull();
    expect(streak.restoreStreak()).toBeNull();
    expect(streak.streak()).toBe(0);
  });

  test('у новому місяці відновлення знову доступне', async () => {
    at(2026, 11, 3);
    localStorage.setItem('safelex:days', JSON.stringify([key(2026, 10, 30), key(2026, 10, 31), key(2026, 11, 1)]));
    localStorage.setItem('safelex:restoredDays', JSON.stringify([key(2026, 10, 20)]));
    const { streak } = await fresh();
    expect(streak.restoreOffer()).toEqual({ day: key(2026, 11, 2), lost: 3 });
  });

  test('не пропонується: пропущено два дні, коротка серія або вчора все виконано', async () => {
    setDays(3, 4, 5, 6);
    expect((await fresh()).streak.restoreOffer()).toBeNull();
    setDays(2, 3);
    expect((await fresh()).streak.restoreOffer()).toBeNull();
    setDays(1, 2, 3);
    expect((await fresh()).streak.restoreOffer()).toBeNull();
  });

  test('«Скинути прогрес» прибирає й відновлені дні', async () => {
    setDays(2, 3, 4);
    const m = await fresh();
    m.streak.restoreStreak();
    m.reset.resetProgress();
    expect(localStorage.getItem('safelex:restoredDays')).toBeNull();
    expect(m.streak.streak()).toBe(0);
  });
});

describe('скидання прогресу', () => {
  test('стирає навчання, але не збережені терміни', async () => {
    localStorage.setItem('safelex:favs', '["arson"]');
    localStorage.setItem('safelex:best', '7');
    const m = await fresh();
    m.srs.grade('arson', true);
    m.streak.finishDaily(1, 1);
    m.reset.resetProgress();
    expect(Object.keys(m.srs.srs)).toEqual([]);
    expect(m.streak.streak()).toBe(0);
    expect(Object.keys(m.activity.actLog)).toEqual([]);
    for (const k of m.reset.PROGRESS_KEYS) expect(localStorage.getItem(k), k).toBeNull();
    expect(localStorage.getItem('safelex:favs')).toBe('["arson"]');
  });
});

// localStorage вміщує близько 5 млн символів на весь сайт. Якщо тест упав — словник виріс настільки,
// що прогрес час переносити в IndexedDB або стискати (див. README, «Де зберігається прогрес»).
describe('запас місця для прогресу', () => {
  test('усі терміни вивчені й збережені, 400 днів журналу — менше 1 млн символів', async () => {
    const { data: { TERMS } } = await fresh();
    const srs = Object.fromEntries(TERMS.map(t => [t.id, { checks: MASTERED, day: '2026-10-09', due: Date.now() + 10 * DAY, wrong: 99 }]));
    const days = Array.from({ length: 400 }, (_, i) => key(2026, 1 + i % 12, 1 + i % 28) + i);
    const log = Object.fromEntries(days.map(d => [d, { a: 9999, r: 9999 }]));
    const size = [srs, log, days, TERMS.map(t => t.id)].reduce((n, v) => n + JSON.stringify(v).length, 0);
    expect(size).toBeLessThan(1_000_000);
  });
});

describe('питання', () => {
  test('blankOut замінює термін у прикладі на пропуск', async () => {
    const { questions: { blankOut } } = await fresh();
    expect(blankOut({ en: 'hose', forms: ['hose'], exEn: 'Roll the hoses back.' })).toBe('Roll the _____ back.');
    expect(blankOut({ en: 'fire alarm', forms: ['fire alarm'], exEn: 'The Fire alarm rang.' })).toBe('The _____ rang.');
    expect(blankOut({ en: 'ax', forms: ['ax'], exEn: 'Relax now.' })).toBe('');
  });

  test('typedRight приймає форми, синоніми й одну одруківку в довгих словах', async () => {
    const { questions: { typedRight } } = await fresh();
    const t = { en: 'adapter', forms: ['adapter'], syn: ['adaptor'] };
    expect(typedRight('Adapter', t)).toBe(true);
    expect(typedRight('adaptor', t)).toBe(true);
    expect(typedRight('adaptr', t)).toBe(true);
    expect(typedRight('adptr', t)).toBe(false);
    expect(typedRight('   ', t)).toBe(false);
    expect(typedRight('axe', { en: 'ax', forms: ['ax'] })).toBe(false);
  });

  test('makeQuestion: правильна відповідь серед варіантів, варіанти не повторюються', async () => {
    const { questions: { makeQuestion, sense }, data: { TERMS } } = await fresh();
    for (const t of TERMS.slice(0, 300)) for (const kind of ['en2ua', 'ua2en', 'context']) {
      const q = makeQuestion(t, kind);
      if (q.kind === 'context' && !q.ask) continue;
      expect(q.options).toContain(t);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      const shown = q.options.map(o => sense(o[q.key]));
      expect(new Set(shown).size, `${t.id} ${kind}`).toBe(shown.length);
    }
  });

  test('нові терміни питаються «оберіть переклад», вивчені — англійською', async () => {
    const { questions: { makeQuestion }, srs, data: { TERMS } } = await fresh();
    const t = TERMS[0];
    expect(makeQuestion(t).kind).toBe('en2ua');
    srs.srs[t.id] = { checks: 2, day: '', due: 0, wrong: 0 };
    for (let i = 0; i < 20; i++) expect(['ua2en', 'type']).toContain(makeQuestion(t).kind);
  });

  test('завдання дня: 10 різних термінів', async () => {
    const { questions: { dailyTerms } } = await fresh();
    const d = dailyTerms();
    expect(d).toHaveLength(10);
    expect(new Set(d).size).toBe(10);
  });
});
