// Журнал активності: скільки відповідей (a) і скільки правильних (r) було кожного дня.
import { store } from '../core/store.js';
import { isRecord, num } from '../core/util.js';
import { dayKey } from '../core/dates.js';

export const LOG_DAYS = 400;

/** Прибирає пошкоджені записи; r не може перевищувати a. Змінює об'єкт на місці. */
export function sanitizeLog(log) {
  for (const k in log) {
    const d = log[k];
    if (!isRecord(d)) delete log[k];
    else { d.a = Math.max(0, num(d.a)); d.r = Math.max(0, Math.min(d.a, num(d.r))); }
  }
  return log;
}

export const actLog = sanitizeLog(store.get('safelex:log', {}));

export function logAnswer(right) {
  const d = actLog[dayKey()] ||= { a: 0, r: 0 };
  d.a++; if (right) d.r++;
  const keys = Object.keys(actLog);
  if (keys.length > LOG_DAYS) keys.sort().slice(0, keys.length - LOG_DAYS).forEach(k => delete actLog[k]);
  store.set('safelex:log', actLog);
}

export function resetActivity() { for (const k in actLog) delete actLog[k]; }
