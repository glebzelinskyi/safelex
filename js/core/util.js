export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = n => String(n).padStart(2, '0');
export const fmtTime = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;

export const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const num = v => Number.isFinite(v) ? v : 0;

export const lookup = entries => Object.assign(Object.create(null), Object.fromEntries(entries));

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function sample(arr, k, skip) {
  const out = [], used = new Set();
  if (!arr.length) return out;
  for (let tries = 0; out.length < k && tries < Math.max(k * 30, arr.length * 2); tries++) {
    const i = Math.floor(Math.random() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    if (!skip || !skip(arr[i])) out.push(arr[i]);
  }
  return out;
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const nDays = n => `${n}\u00A0${plural(n, 'день', 'дні', 'днів')}`;
export const nTerms = n => `${n}\u00A0${plural(n, 'термін', 'терміни', 'термінів')}`;
export const nAnswers = n => `${n}\u00A0${plural(n, 'відповідь', 'відповіді', 'відповідей')}`;

export function typos(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export const hashStr = str => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
