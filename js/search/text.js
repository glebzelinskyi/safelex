export const normS = s => String(s ?? '').toLowerCase().replace(/́/g, '').replace(/[’ʼ`´‘]/g, "'").replace(/ё/g, 'е');

const WORD_RE = /[a-z0-9а-яіїєґ']+/g;
export const wordsOf = s => (normS(s).match(WORD_RE) || []).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);

export const isCyr = w => /[а-яіїєґ]/.test(w);

const UA_END = /(ями|ами|ові|еві|ого|ому|ими|ої|ою|ею|ям|ам|ах|ях|ів|їв|ом|ем|ий|ій|ей|а|я|у|ю|і|ї|и|е|о|ь)$/;

export function stem(w) {
  const s = isCyr(w) ? w.replace(UA_END, '') : w.length > 4 ? w.replace(/(ies|ing|es|ed|s)$/, '') : w;
  return s.length >= 3 ? s : w;
}

const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", UA_KEYS = "йцукенгшщзхїфівапролджєячсмитьбю'";
const toUA = {}, toEN = {};
[...EN_KEYS].forEach((c, i) => { toUA[c] = UA_KEYS[i]; toEN[UA_KEYS[i]] = c; });
Object.assign(toEN, { 'ы': 's', 'э': "'", 'ъ': ']', 'ё': '`' });

export const swapLayout = q => /[a-z]/.test(q) && !isCyr(q) ? [...q].map(c => toUA[c] ?? c).join('')
  : isCyr(q) && !/[a-z]/.test(q) ? [...q].map(c => toEN[c] ?? c).join('') : '';
