import { store } from '../core/store.js';
import { isRecord, num, hashStr } from '../core/util.js';
import { DAY, dayKey } from '../core/dates.js';
import { MASTERED, REVIEW_DAYS } from '../config.js';
import { termById } from '../data.js';
import { RANKS } from './ranks.js';
import { sanitizeSrs } from './srs.js';
import { sanitizeLog, LOG_DAYS } from './activity.js';

const BACKUP_VERSION = 1;
export const MAX_BACKUP_CHARS = 2e6;
const REMIND_DAYS = 30, LATER_DAYS = 30, MIN_DAYS = 7;

const KEYS = ['srs', 'days', 'restoredDays', 'best', 'ranksSeen', 'matchBest', 'sprintBest', 'log', 'favs'];
const EMPTY = { srs: {}, days: [], restoredDays: [], best: 0, ranksSeen: [], matchBest: 0, sprintBest: 0, log: {}, favs: [] };
const DATE = /^\d{4}-\d\d-\d\d$/;
const ANY_DAY = '9999-99-99';

export class BackupError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const whole = v => Math.max(0, Math.round(num(v)));
const uniq = arr => [...new Set(arr)];

export function cleanProgress(raw, lastDay = ANY_DAY, now = Infinity) {
  const d = isRecord(raw) ? raw : {};
  const isDay = k => typeof k === 'string' && DATE.test(k) && k <= lastDay;
  const list = v => Array.isArray(v) ? v : [];

  const picked = {};
  if (isRecord(d.srs)) for (const id of Object.keys(d.srs).sort()) {
    const s = d.srs[id];
    if (termById[id] && isRecord(s)) picked[id] = { ...s };
  }
  sanitizeSrs(picked);
  const srs = {}, dueMax = now + REVIEW_DAYS[MASTERED] * DAY;
  for (const id in picked) {
    const s = picked[id];
    srs[id] = { checks: s.checks, day: isDay(s.day) ? s.day : '', due: Math.max(0, Math.min(s.due, dueMax)), wrong: whole(s.wrong) };
    if ('fixed' in s) srs[id].fixed = Math.min(srs[id].wrong, whole(s.fixed));
  }

  const rawLog = {};
  if (isRecord(d.log)) for (const k of Object.keys(d.log).sort()) if (isDay(k) && isRecord(d.log[k])) rawLog[k] = { ...d.log[k] };
  sanitizeLog(rawLog);
  const log = {};
  for (const k of Object.keys(rawLog).filter(k => rawLog[k].a >= 1).slice(-LOG_DAYS)) {
    const a = whole(rawLog[k].a);
    log[k] = { a, r: Math.min(a, whole(rawLog[k].r)) };
  }

  return {
    srs,
    days: uniq(list(d.days).filter(isDay)).sort(),
    restoredDays: uniq(list(d.restoredDays).filter(isDay)).sort(),
    best: whole(d.best),
    ranksSeen: uniq(list(d.ranksSeen).filter(n => n > 0 && RANKS.some(r => r.days === n))).sort((a, b) => a - b),
    matchBest: Math.max(0, num(d.matchBest)),
    sprintBest: whole(d.sprintBest),
    log,
    favs: uniq(list(d.favs).filter(id => typeof id === 'string' && termById[id])).sort()
  };
}

export const readProgress = () => cleanProgress(Object.fromEntries(KEYS.map(k => [k, store.get('safelex:' + k, EMPTY[k])])));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const backupName = () => `safelex-progress-${dayKey()}.txt`;
export const buildBackup = () => JSON.stringify({ app: 'safelex', v: BACKUP_VERSION, saved: dayKey(), data: readProgress() });

export function parseBackup(text, now = Date.now()) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) throw new BackupError('format');
  let file;
  try { file = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new BackupError('format'); }
  if (!isRecord(file) || file.app !== 'safelex' || !isRecord(file.data) || !Number.isFinite(file.v)) throw new BackupError('format');
  if (file.v > BACKUP_VERSION) throw new BackupError('version');
  const data = cleanProgress(file.data, dayKey(-1), now);
  data.best = Math.min(data.best, data.days.length + data.restoredDays.length);
  return data;
}

function longestRun(days) {
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number), n = Math.round(Date.UTC(y, m - 1, d) / DAY);
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = n;
  }
  return best;
}

const better = (mine, theirs) => !mine ? theirs : !theirs ? mine
  : theirs.checks > mine.checks || (theirs.checks === mine.checks && theirs.day > mine.day) ? theirs : mine;

export function mergeProgress(mine, theirs) {
  const srs = {}, log = {};
  for (const id of new Set([...Object.keys(mine.srs), ...Object.keys(theirs.srs)])) srs[id] = better(mine.srs[id], theirs.srs[id]);
  for (const k of new Set([...Object.keys(mine.log), ...Object.keys(theirs.log)])) {
    const a = mine.log[k], b = theirs.log[k];
    log[k] = !a ? b : !b ? a : b.a > a.a ? b : a;
  }
  const days = uniq([...mine.days, ...theirs.days]).sort(), restoredDays = uniq([...mine.restoredDays, ...theirs.restoredDays]).sort();
  return cleanProgress({
    srs, log, days, restoredDays,
    best: Math.max(mine.best, theirs.best, longestRun(uniq([...days, ...restoredDays]).sort())),
    ranksSeen: [...mine.ranksSeen, ...theirs.ranksSeen],
    matchBest: mine.matchBest && theirs.matchBest ? Math.min(mine.matchBest, theirs.matchBest) : mine.matchBest || theirs.matchBest,
    sprintBest: Math.max(mine.sprintBest, theirs.sprintBest),
    favs: [...mine.favs, ...theirs.favs]
  });
}

export function restoreBackup(text, now = Date.now()) {
  const theirs = parseBackup(text, now), mine = readProgress(), merged = mergeProgress(mine, theirs);
  const summary = { days: merged.days.length, terms: Object.keys(merged.srs).length, favs: merged.favs.length };
  if (same(merged, mine)) return { changed: false, ...summary };
  const before = KEYS.map(k => store.get('safelex:' + k, EMPTY[k]));
  if (!KEYS.every(k => store.set('safelex:' + k, merged[k]))) {
    KEYS.forEach((k, i) => store.set('safelex:' + k, before[i]));
    throw new BackupError('write');
  }
  if (same(merged, theirs)) markBackedUp(now);
  return { changed: true, ...summary };
}

export const lastBackupAt = () => store.get('safelex:backupAt', 0);

function progressSig() {
  const p = Object.fromEntries(KEYS.map(k => [k, store.get('safelex:' + k, EMPTY[k])]));
  let h = 7;
  const add = v => { h = (h * 31 + (Number.isFinite(v) ? v % 1e9 : hashStr(String(v)))) >>> 0; };
  for (const id in p.srs) { const s = p.srs[id]; if (isRecord(s)) { add(id.length); add(s.checks); add(s.due); add(s.wrong); } }
  for (const k in p.log) add(p.log[k]?.a);
  p.days.forEach(add); p.restoredDays.forEach(add); p.favs.forEach(add);
  add(p.best); add(p.matchBest); add(p.sprintBest);
  return `${Object.keys(p.srs).length}:${p.days.length}:${p.favs.length}:${h}`;
}

export function markBackedUp(now = Date.now()) {
  store.set('safelex:backupAt', now);
  store.set('safelex:backupSig', progressSig());
}

export function snoozeBackup(now = Date.now()) { store.set('safelex:backupLater', now); }

const recently = (at, days, now) => at > 0 && at <= now && now - at < days * DAY;

export function backupDue(now = Date.now()) {
  if (store.get('safelex:days', []).length < MIN_DAYS && Object.keys(store.get('safelex:log', {})).length < MIN_DAYS) return false;
  if (recently(lastBackupAt(), REMIND_DAYS, now) || recently(store.get('safelex:backupLater', 0), LATER_DAYS, now)) return false;
  return progressSig() !== store.get('safelex:backupSig', '');
}
