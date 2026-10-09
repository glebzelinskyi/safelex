// Скидання прогресу навчання. Збережені терміни, історія пошуку й нещодавні залишаються.
import { store } from '../core/store.js';
import { resetSrs } from './srs.js';
import { resetActivity } from './activity.js';
import { resetStreak } from './streak.js';

export const PROGRESS_KEYS = ['safelex:srs', 'safelex:days', 'safelex:best', 'safelex:ranksSeen', 'safelex:dailyScore',
  'safelex:matchBest', 'safelex:sprintBest', 'safelex:log'];

export function resetProgress() {
  PROGRESS_KEYS.forEach(k => store.remove(k));
  resetSrs(); resetStreak(); resetActivity();
}
