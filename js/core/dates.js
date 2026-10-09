import { pad } from './util.js';

export const DAY = 864e5;

/** Дата у вигляді '2026-10-09' за місцевим часом. */
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Ключ дня: dayKey() — сьогодні, dayKey(1) — учора. */
export function dayKey(daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return ymd(d);
}

export const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

export const dayLabel = k => {
  const t = keyToDate(k).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
