import { shuffle, nDays, nTerms } from '../core/util.js';
import { DAY, dayKey } from '../core/dates.js';
import { store } from '../core/store.js';
import { MASTERED } from '../config.js';
import { TERMS } from '../data.js';
import { RANKS } from '../learn/ranks.js';

const DEMO_STREAK = 456, DEMO_MASTERED = 1298, DEMO_LEARNING = 402;

export function seedDemo() {
  if (!confirm(`Демо-режим: серія ${nDays(DEMO_STREAK)} і ${nTerms(DEMO_MASTERED)} вивчено.\nПоточний прогрес на цьому пристрої буде замінено. Продовжити?`)) {
    location.replace('#/'); return;
  }
  const days = Array.from({ length: DEMO_STREAK }, (_, i) => dayKey(i + 1));
  const ids = shuffle(TERMS.map(t => t.id)), demo = {};
  ids.slice(0, DEMO_MASTERED).forEach(id => { demo[id] = { checks: MASTERED, day: dayKey(3), due: Date.now() + 5 * DAY, wrong: 0 }; });
  ids.slice(DEMO_MASTERED, DEMO_MASTERED + DEMO_LEARNING).forEach((id, i) => { demo[id] = { checks: 1 + i % 2, day: dayKey(1), due: Date.now() + (i % 3) * DAY, wrong: i % 4 ? 0 : 1 }; });
  const log = {};
  for (let i = 1; i <= 60; i++) { const a = 15 + (i * 7) % 40; log[dayKey(i)] = { a, r: Math.round(a * .82) }; }
  store.set('safelex:days', days);
  store.set('safelex:best', DEMO_STREAK);
  store.set('safelex:srs', demo);
  store.set('safelex:log', log);
  store.set('safelex:ranksSeen', RANKS.filter(r => r.days && r.days <= DEMO_STREAK).map(r => r.days));
  location.replace('#/');
  location.reload();
}
