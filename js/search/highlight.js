import { esc } from '../core/util.js';
import { normS } from './text.js';

/** Безпечний HTML тексту, де знайдені слова (на початку слова) обгорнуті в <mark>. */
export function highlight(text, marks) {
  text = String(text ?? '');
  if (!marks || !marks.length) return esc(text);
  const list = [...new Set(marks)].filter(Boolean).sort((a, b) => b.length - a.length)
    .map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’ʼ]"));
  if (!list.length) return esc(text);
  const re = new RegExp(`(^|[^a-zа-яіїєґ0-9])(${list.join('|')})`, 'giu');
  let out = '', last = 0, m;
  const low = text.replace(/\u0301/g, ' ').replace(/ё/gi, 'е');
  while ((m = re.exec(low))) {
    const start = m.index + m[1].length, end = start + m[2].length;
    out += esc(text.slice(last, start)) + '<mark>' + esc(text.slice(start, end)) + '</mark>';
    last = end;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out + esc(text.slice(last));
}

/** Уривок прикладу навколо знайденого слова (до ~70 символів). */
export function exSnippet(t, words) {
  const src = t.exEn && words.some(w => normS(t.exEn).includes(w)) ? t.exEn : t.exUa || t.exEn || '';
  const low = normS(src), w = words.find(w => w.length >= 3 && low.includes(w)) || '';
  const i = w ? low.indexOf(w) : 0;
  if (src.length <= 70) return src;
  const a = Math.max(0, i - 30), b = Math.min(src.length, i + 40);
  return (a ? '…' : '') + src.slice(a, b) + (b < src.length ? '…' : '');
}
