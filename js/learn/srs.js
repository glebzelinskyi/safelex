// Інтервальне повторення. Для кожного терміна зберігається:
//   checks — галочки (0…MASTERED): скільки різних днів відповідь була правильною;
//   day    — день останньої зарахованої галочки (не більше однієї на день);
//   due    — коли показати термін знову; wrong — скільки разів була помилка.
import { store } from '../core/store.js';
import { isRecord, num, shuffle } from '../core/util.js';
import { DAY, dayKey } from '../core/dates.js';
import { MASTERED, REVIEW_DAYS } from '../config.js';
import { TERMS, CORE, byCat } from '../data.js';
import { favs } from '../user.js';
import { logAnswer } from './activity.js';

/** Виправляє пошкоджені записи й переводить старий формат (box 0…5) у галочки. Змінює об'єкт на місці. */
export function sanitizeSrs(srs) {
  for (const id in srs) {
    const s = srs[id];
    if (!isRecord(s)) { delete srs[id]; continue; }
    s.checks = Number.isFinite(s.checks) ? Math.max(0, Math.min(MASTERED, Math.round(s.checks))) : undefined;
    s.due = num(s.due); s.wrong = Math.max(0, num(s.wrong)); s.day = typeof s.day === 'string' ? s.day : '';
    const b = num(s.box);
    if (s.checks === undefined) s.checks = b >= 4 ? MASTERED : b >= 2 ? 1 : 0;
  }
  return srs;
}

const blank = () => ({ checks: 0, day: '', due: 0, wrong: 0 });

/**
 * Зараховує відповідь у запис s (змінює його). Чиста функція — дата й час передаються ззовні.
 * Повертає { gain, checks, mastered }: на скільки змінились галочки і чи термін щойно став вивченим.
 */
export function applyAnswer(s, right, today, now) {
  const before = s.checks;
  if (right) {
    if (s.day !== today) { s.checks = Math.min(MASTERED, s.checks + 1); s.day = today; }
    s.due = now + REVIEW_DAYS[s.checks] * DAY;
  } else {
    s.checks = Math.max(0, s.checks - 1);
    s.wrong = (s.wrong || 0) + 1;
    s.due = now;
  }
  delete s.box;
  return { gain: s.checks - before, checks: s.checks, mastered: before < MASTERED && s.checks >= MASTERED };
}

export const srs = sanitizeSrs(store.get('safelex:srs', {}));
const save = () => store.set('safelex:srs', srs);

export function grade(id, right) {
  const s = srs[id] ||= blank();
  const g = applyAnswer(s, right, dayKey(), Date.now());
  save(); logAnswer(right);
  return g;
}

/** Помилка без зняття галочки (спринт): термін потрапляє в «Помилки» й на повторення. */
export function noteMistake(id) {
  const s = srs[id] ||= blank();
  s.wrong = (s.wrong || 0) + 1;
  s.due = Date.now();
  save(); logAnswer(false);
}

export function resetSrs() { for (const id in srs) delete srs[id]; }

export const boxOf = id => srs[id]?.checks ?? 0;
export const isDue = id => !!srs[id] && srs[id].due <= Date.now();
export const statusOf = id => !srs[id] ? 'new' : srs[id].checks >= MASTERED ? 'mastered' : 'learning';
export function progressOf(list) { const r = { new: 0, learning: 0, mastered: 0 }; list.forEach(t => r[statusOf(t.id)]++); return r; }

/** Терміни для тренування: 'all', 'core' (ключові), 'fav' (збережені) або id розділу. */
export const poolFor = cat => cat === 'all' ? TERMS : cat === 'core' ? CORE : cat === 'fav' ? TERMS.filter(t => favs.has(t.id)) : (byCat[cat] || []);
export const mistakesIn = cat => poolFor(cat).filter(t => srs[t.id]?.wrong > 0 && srs[t.id].checks < MASTERED);

/** n термінів для тренування: спершу ті, що чекають повторення, далі нові (ключові першими), далі решта. */
export function pickTerms(pool, n) {
  const byBox = (a, b) => boxOf(a.id) - boxOf(b.id);
  const due = shuffle(pool.filter(t => isDue(t.id))).sort(byBox);
  const fresh = shuffle(pool.filter(t => !srs[t.id])).sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0));
  const later = shuffle(pool.filter(t => srs[t.id] && !isDue(t.id))).sort(byBox);
  return [...due, ...fresh, ...later].slice(0, n);
}
