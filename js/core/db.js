// Підготовка бази термінів з data/terms.js: нормалізація полів, пошукові форми
// та перевірка помилок. Чисті функції — без DOM і без глобальних змінних.
import { lookup } from './util.js';

/**
 * Усі варіанти написання терміна, які має знаходити пошук:
 * "hose (pipe)" → ["hose pipe", "hose"], "fire [smoke] alarm" → ["fire alarm", "smoke alarm"].
 * Дужки з "pl ..." (множина) не розгортаються.
 */
export function formsOf(en) {
  const out = new Set(), todo = [String(en)];
  while (todo.length && out.size < 24) {
    const s = todo.pop();
    const p = s.match(/\(([^()]*)\)/), b = s.match(/\[([^\[\]]*)\]/);
    if (p && (!b || p.index < b.index)) {
      const before = s.slice(0, p.index), after = s.slice(p.index + p[0].length);
      todo.push(before + after);
      if (!/^pl\s/.test(p[1])) todo.push(before + p[1] + after);
    } else if (b) {
      const before = s.slice(0, b.index).replace(/\s+$/, ''), after = s.slice(b.index + b[0].length);
      const head = before.replace(/\S+$/, '');
      todo.push(before + after);
      b[1].split(/\s*,\s*/).forEach(alt => todo.push(head + alt + after));
    } else out.add(s.replace(/\s+/g, ' ').trim());
  }
  return [...out].filter(Boolean);
}

/** Однаковий апостроф в українських словах: п'ять, пʼять, п`ять → п’ять. */
export const apos = str => typeof str === 'string' ? str.replace(/([а-яіїєґ])['ʼ`]([а-яіїєґ])/gi, '$1’$2') : str;

/** Доповнює терміни полями, потрібними застосунку. Змінює об'єкти на місці, як і раніше. */
function normalize(t) {
  if (!t || !t.en || !t.ua) return;
  t.cat = t.cat || t.topic;
  if (Array.isArray(t.ex)) { t.exEn = t.ex[0] || ''; t.exUa = apos(t.ex[1] || ''); }
  t.ua = apos(String(t.ua)).replace(/(^|[;,]\s*)pl\s+/g, '$1мн. ');
  t.senses = t.ua.split(/\s*;\s*/).filter(Boolean);
  t.uaShort = (t.senses[0] || t.ua).replace(/\.$/, '');
  t.forms = formsOf(t.en);
  t.find = [t.en, ...t.forms, ...(t.syn || [])].map(x => String(x).toLowerCase());
}

/** Причина, з якої термін не можна показати, або '' — якщо все гаразд. */
export function termProblem(t, ids, catById) {
  return !t || !t.id ? 'немає id' : !t.en || !t.ua ? 'немає en або ua' : ids.has(t.id) ? `id «${t.id}» повторюється`
    : !catById[t.cat] ? `невідомий розділ «${t.cat}»` : '';
}

/**
 * Будує базу з глобальних змінних data/terms.js.
 * Підтримує поточний формат (TOPICS + TERMS + SOURCES) і старий (CATEGORIES + TERMS + MARCH_STEPS).
 * Помилкові терміни пропускаються з попередженням у консолі — решта бази працює.
 */
export function createDb(src, warn = (...a) => console.warn(...a)) {
  let cats = [], terms = [], march = [], sources = {};
  if (src.TOPICS) {
    cats = src.TOPICS.map(tp => ({ id: tp.id, title: tp.ua, short: tp.short, en: tp.en, icon: tp.icon, desc: tp.desc }));
    terms = src.TERMS || [];
    sources = src.SOURCES || {};
  } else if (src.CATEGORIES && src.TERMS) {
    cats = src.CATEGORIES; terms = src.TERMS;
    if (src.MARCH_STEPS) march = src.MARCH_STEPS;
  }
  cats.forEach(c => { c.title = apos(c.title); c.short = apos(c.short); c.desc = apos(c.desc); });
  terms.forEach(normalize);

  const catById = lookup(cats.map(c => [c.id, c]));
  const ids = new Set();
  const valid = terms.filter(t => {
    const why = termProblem(t, ids, catById);
    if (why) { warn(`SafeLex: термін пропущено — ${why}:`, t); return false; }
    ids.add(t.id); return true;
  });
  // Той самий масив, що й window.TERMS: data/terms.js та інструменти бачать перевірену базу.
  terms.length = 0;
  valid.forEach(t => terms.push(t));

  const byCat = Object.create(null);
  terms.forEach(t => (byCat[t.cat] ||= []).push(t));
  return {
    CATEGORIES: cats, TERMS: terms, SOURCES: sources, MARCH_STEPS: march,
    catById, termById: lookup(terms.map(t => [t.id, t])), byCat, CORE: terms.filter(t => t.core)
  };
}
