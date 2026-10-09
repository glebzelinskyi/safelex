import { typos } from '../core/util.js';
import { normS, wordsOf, isCyr, stem, swapLayout } from './text.js';

const allowTypos = n => n >= 8 ? 2 : n >= 5 ? 1 : 0;

function tokenScore(tk, st, x, marks) {
  let best = 0, hit = '';
  const tryWords = (words, exact, prefix) => {
    for (const w of words) {
      if (w === tk) { if (exact > best) { best = exact; hit = w; } }
      else if (w.startsWith(tk)) { if (prefix > best) { best = prefix; hit = tk; } }
      else if (st !== tk && w.startsWith(st) && 6 > best) { best = 6; hit = st; }
    }
  };
  tryWords(x.enW, 12, 9);
  tryWords(x.uaW, 11, 8);
  if (best) { marks.add(hit); return { s: best }; }
  if (tk.length >= 3 && (x.en.some(e => e.includes(tk)) || x.ua.includes(tk) || x.full.includes(tk))) { marks.add(tk); return { s: 5 }; }
  const k = allowTypos(tk.length);
  if (k) for (const w of isCyr(tk) ? x.uaW : x.enW) {
    if (w[0] !== tk[0] || w.length < tk.length - k) continue;
    if (typos(w, tk) <= k || (w.length > tk.length && typos(w.slice(0, tk.length), tk) <= k)) { marks.add(w); return { s: 3, fuzzy: true }; }
  }
  if (tk.length >= 3 && (x.ex.includes(tk) || (st.length >= 4 && x.ex.includes(st)))) return { s: 1, ex: true };
  return null;
}

export function createSearchEngine(terms, { isRecent = () => false } = {}) {
  let idx = null;
  function index() {
    if (idx) return idx;
    idx = new Map();
    for (const t of terms) {
      const en = [...new Set([t.en, ...(t.forms || []), ...(t.syn || [])].map(normS))];
      idx.set(t, {
        en, full: normS(t.full), ua: normS(t.ua), sense: normS(t.uaShort), senseW: wordsOf(t.uaShort), headW: wordsOf(t.en)[0] || '',
        enW: [...new Set(en.flatMap(wordsOf).concat(wordsOf(t.full)))],
        uaW: [...new Set(wordsOf(t.ua))],
        ex: normS(`${t.exEn || ''} ${t.exUa || ''}`)
      });
    }
    return idx;
  }

  function rankTerms(q, pool) {
    const ix = index(), tokens = wordsOf(q), nq = normS(q).trim();
    if (!tokens.length) return { list: [], marks: [] };
    const stems = tokens.map(stem), marks = new Set(), out = [];
    for (const t of pool) {
      const x = ix.get(t);
      if (!x) continue;
      let sum = 0, fuzzy = false, ex = true;
      const m = new Set();
      for (let i = 0; i < tokens.length; i++) {
        const r = tokenScore(tokens[i], stems[i], x, m);
        if (!r) { sum = -1; break; }
        sum += r.s; fuzzy ||= !!r.fuzzy; ex &&= !!r.ex;
        if (!r.fuzzy && !r.ex) {
          if (x.headW.startsWith(tokens[i]) || x.senseW[0]?.startsWith(stems[i])) sum += 6;
          else if (x.senseW.some(w => w.startsWith(stems[i]))) sum += 3;
        }
      }
      if (sum < 0) continue;
      if (x.en.includes(nq) || x.full === nq || x.sense === nq) sum += 100;
      else if (x.en.some(e => e.startsWith(nq)) || x.sense.startsWith(nq)) sum += 40;
      else if (x.en.some(e => e.includes(nq)) || x.ua.includes(nq)) sum += 15;
      if (t.core) sum += 3;
      if (isRecent(t.id)) sum += 2;
      sum -= t.en.length * .04;
      out.push({ t, score: sum, fuzzy: fuzzy && sum < 100, ex });
      m.forEach(w => marks.add(w));
    }
    out.sort((a, b) => b.score - a.score || a.t.en.localeCompare(b.t.en));
    return { list: out, marks: [...marks] };
  }

  function searchRaw(q, pool) {
    const main = rankTerms(q, pool);
    const good = main.list.filter(r => !r.fuzzy && !r.ex).length;
    if (good < 2) {
      const alt = swapLayout(normS(q));
      if (alt) {
        const sw = rankTerms(alt, pool), swGood = sw.list.filter(r => !r.fuzzy && !r.ex).length;
        if (swGood > good) return { ...sw, layout: alt };
      }
    }
    return main;
  }

  let memo = { key: '', pool: null, res: null };
  function search(q, pool = terms) {
    q = q.trim();
    if (memo.key === q && memo.pool === pool) return memo.res;
    const res = searchRaw(q, pool);
    memo = { key: q, pool, res };
    return res;
  }

  return { search, index };
}
