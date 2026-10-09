import { sample, shuffle, typos } from '../core/util.js';
import { DAILY_LEN } from '../config.js';
import { TERMS, CORE, byCat } from '../data.js';
import { srs, boxOf, isDue } from './srs.js';

export const sense = s => String(s).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-zа-яіїєґ0-9]+/gi, ' ').trim();

export function distractors(t, key, n = 3) {
  const seen = [sense(t[key])], loose = key !== 'en';
  const skip = o => {
    if (!o[key]) return true;
    const s = sense(o[key]);
    if (!s || seen.some(x => x === s || (loose && (x.includes(s) || s.includes(x))))) return true;
    seen.push(s); return false;
  };
  const out = sample(byCat[t.cat] || [], n, skip);
  if (out.length < n) out.push(...sample(TERMS, n - out.length, skip));
  return out;
}

export function blankOut(t) {
  const ex = t.exEn || '', low = ex.toLowerCase();
  for (const f of (t.forms || [t.en]).slice().sort((a, b) => b.length - a.length)) {
    const fl = f.toLowerCase();
    let i = low.indexOf(fl);
    while (i > 0 && /[a-z]/i.test(ex[i - 1])) i = low.indexOf(fl, i + 1);
    if (i < 0) continue;
    let j = i + f.length;
    while (/[a-z]/i.test(ex[j] || '')) j++;
    return ex.slice(0, i) + '_____' + ex.slice(j);
  }
  return '';
}

export function makeQuestion(t, kind, mixed) {
  if (!kind) {
    const box = boxOf(t.id);
    const kinds = mixed
      ? ['en2ua', 'ua2en', ...(box >= 1 ? ['type'] : []), ...(blankOut(t) ? ['context'] : []), ...(t.full ? ['abbr'] : [])]
      : box === 0 ? ['en2ua'] : box === 1 ? ['en2ua', 'ua2en'] : ['ua2en', 'type'];
    kind = kinds[Math.floor(Math.random() * kinds.length)];
  }
  const q = { t, kind };
  if (kind === 'type') return Object.assign(q, { label: 'Напишіть англійською', ask: t.ua, hint: `Починається з «${(t.en.match(/[a-z0-9]/i) || [t.en[0]])[0]}»` });
  if (kind === 'context') Object.assign(q, { label: 'Заповніть пропуск', ask: blankOut(t), hint: t.exUa, key: 'en' });
  else if (kind === 'abbr') Object.assign(q, { label: 'Що означає абревіатура?', ask: t.en, hint: '', key: 'full' });
  else if (kind === 'ua2en') Object.assign(q, { label: 'Як це англійською?', ask: t.ua, hint: '', key: 'en' });
  else Object.assign(q, { label: 'Оберіть переклад', ask: t.en, hint: t.full, key: 'uaShort' });
  q.options = shuffle([t, ...distractors(t, q.key)]);
  if (q.options.length < 2 && kind !== 'en2ua') return makeQuestion(t, 'en2ua');
  return q;
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function typedRight(input, t) {
  const a = norm(input);
  if (!a) return false;
  if (t.full && a === norm(t.full)) return true;
  return [...(t.forms || [t.en]), ...(t.syn || [])].some(f => { const b = norm(f); return a === b || (b.length > 4 && typos(a, b) <= 1); });
}

export function dailyTerms() {
  const picked = new Set(shuffle(TERMS.filter(t => isDue(t.id))).slice(0, 5));
  sample(CORE.length ? CORE : TERMS, 3, t => !!srs[t.id] || picked.has(t)).forEach(t => picked.add(t));
  sample(TERMS, DAILY_LEN - picked.size, t => picked.has(t)).forEach(t => picked.add(t));
  return shuffle([...picked]);
}
