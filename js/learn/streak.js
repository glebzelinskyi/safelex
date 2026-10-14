import { store } from '../core/store.js';
import { dayKey } from '../core/dates.js';
import { RANKS } from './ranks.js';

export const RESTORE_MIN = 3;

export const doneDays = new Set(store.get('safelex:days', []).filter(k => typeof k === 'string'));
export const restoredDays = new Set(store.get('safelex:restoredDays', []).filter(k => typeof k === 'string'));

const counted = k => doneDays.has(k) || restoredDays.has(k);
const runFrom = i => { let n = 0; while (counted(dayKey(i + n))) n++; return n; };

export const doneToday = () => doneDays.has(dayKey());

export const streak = () => runFrom(doneToday() ? 0 : 1);
export const bestStreak = () => Math.max(store.get('safelex:best', 0), streak());

function recordStreak(prevBest) {
  const s = streak();
  store.set('safelex:best', Math.max(prevBest, s));
  const seen = new Set(store.get('safelex:ranksSeen', []).filter(Number.isFinite));
  const r = RANKS.filter(r => r.days > prevBest && r.days <= s && !seen.has(r.days)).pop();
  if (!r) return null;
  seen.add(r.days); store.set('safelex:ranksSeen', [...seen]);
  return r;
}

export function finishDaily(score, total) {
  doneDays.add(dayKey());
  store.set('safelex:days', [...doneDays].sort());
  store.set('safelex:dailyScore', { date: dayKey(), score, total });
  return recordStreak(store.get('safelex:best', 0));
}

const monthOf = k => k.slice(0, 7);
export const restoreUsedIn = k => [...restoredDays].sort().find(d => monthOf(d) === monthOf(k)) || null;

export function restoreOffer() {
  const day = dayKey(1);
  if (counted(day) || restoreUsedIn(day)) return null;
  const lost = runFrom(2);
  return lost >= RESTORE_MIN ? { day, lost } : null;
}

export function restoreStreak() {
  const offer = restoreOffer();
  if (!offer) return null;
  const prevBest = store.get('safelex:best', 0);
  restoredDays.add(offer.day);
  store.set('safelex:restoredDays', [...restoredDays].sort());
  return { day: offer.day, streak: streak(), rank: recordStreak(prevBest) };
}

export function rankDate(need) {
  const left = need - streak();
  if (left <= 0) return null;
  const d = new Date(); d.setDate(d.getDate() + (doneToday() ? left : left - 1));
  const opts = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('uk-UA', opts);
}

export function resetStreak() { doneDays.clear(); restoredDays.clear(); }
