import { store } from '../core/store.js';
import { dayKey } from '../core/dates.js';
import { RANKS } from './ranks.js';

export const doneDays = new Set(store.get('safelex:days', []).filter(k => typeof k === 'string'));

export const doneToday = () => doneDays.has(dayKey());

export function streak() {
  let n = 0;
  for (let i = doneToday() ? 0 : 1; doneDays.has(dayKey(i)); i++) n++;
  return n;
}
export const bestStreak = () => Math.max(store.get('safelex:best', 0), streak());

export function finishDaily(score, total) {
  doneDays.add(dayKey());
  store.set('safelex:days', [...doneDays].sort().slice(-400));
  store.set('safelex:dailyScore', { date: dayKey(), score, total });
  const s = streak(), prevBest = store.get('safelex:best', 0);
  store.set('safelex:best', Math.max(prevBest, s));
  const seen = new Set(store.get('safelex:ranksSeen', []).filter(Number.isFinite));
  const r = RANKS.find(r => r.days === s);
  if (!r || seen.has(r.days) || r.days <= prevBest) return null;
  seen.add(r.days); store.set('safelex:ranksSeen', [...seen]);
  return r;
}

export function rankDate(need) {
  const left = need - streak();
  if (left <= 0) return null;
  const d = new Date(); d.setDate(d.getDate() + (doneToday() ? left : left - 1));
  const opts = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('uk-UA', opts);
}

export function resetStreak() { doneDays.clear(); }
