// «Пари»: з'єднати терміни з перекладами на час, кілька раундів.
import { esc, plural, shuffle, fmtTime } from '../../core/util.js';
import { store } from '../../core/store.js';
import { MATCH_ROUNDS, MATCH_PAIRS } from '../../config.js';
import { catTitle } from '../../data.js';
import { grade, poolFor, pickTerms } from '../../learn/srs.js';
import { sense } from '../../learn/questions.js';
import { I } from '../../ui/icons.js';
import { app, vibrate } from '../../ui/dom.js';
import { onClick } from '../../ui/events.js';
import { trainBar, emptyMode, missList, inTrainMode, startTicker, stopTicker } from './shared.js';

const mt = { cat: 'all', rounds: [], r: 0, left: [], right: [], sel: null, matched: new Set(), bad: new Set(), mistakes: 0, start: 0, time: 0, over: false, record: false, busy: false };

export function startMatch(cat) {
  stopTicker();
  // Короткі переклади (до 45 символів) вміщаються в плитку; однакові за змістом — лише один раз.
  const seen = new Set(), all = poolFor(cat), shortOnes = all.filter(t => (t.uaShort || t.ua).length <= 45);
  const terms = pickTerms(shortOnes.length >= MATCH_PAIRS * 2 ? shortOnes : all, MATCH_ROUNDS * MATCH_PAIRS * 2)
    .filter(t => { const k = sense(t.uaShort || t.ua); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, MATCH_ROUNDS * MATCH_PAIRS);
  const rounds = [];
  for (let i = 0; i < terms.length; i += MATCH_PAIRS) rounds.push(terms.slice(i, i + MATCH_PAIRS));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) rounds[rounds.length - 2].push(...rounds.pop());
  Object.assign(mt, { cat, rounds, r: 0, sel: null, bad: new Set(), mistakes: 0, start: Date.now(), time: 0, over: false, record: false, busy: false });
  if (terms.length >= 2) { setRound(); startTicker(tickMatch); }
  drawMatch();
}

function setRound() {
  const round = mt.rounds[mt.r];
  mt.left = shuffle(round); mt.right = shuffle(round); mt.matched = new Set(); mt.sel = null;
}

function tickMatch() {
  const el = document.querySelector('.counter');
  if (el && !mt.over) el.textContent = fmtTime(Math.floor((Date.now() - mt.start) / 1000));
}

const tileEl = (side, id) => document.querySelector(`.tile[data-mt="${side}"][data-id="${CSS.escape(id)}"]`);

function updateMatchHud() {
  const done = mt.rounds.slice(0, mt.r).reduce((n, r) => n + r.length, 0) + mt.matched.size;
  const total = mt.rounds.reduce((n, r) => n + r.length, 0);
  const bar = document.querySelector('.trainer .progress div'), miss = document.querySelector('.mt-miss');
  if (bar) bar.style.transform = `scaleX(${done / total})`;
  if (miss) { miss.lastChild.textContent = mt.mistakes; miss.classList.toggle('has', mt.mistakes > 0); }
}

function matchTap(side, id) {
  if (mt.over || mt.busy || mt.matched.has(id)) return;
  const el = tileEl(side, id);
  if (!el) return;
  if (!mt.sel || mt.sel.side === side) {
    const same = mt.sel && mt.sel.id === id;
    if (mt.sel) tileEl(mt.sel.side, mt.sel.id)?.classList.remove('sel');
    mt.sel = same ? null : { side, id };
    if (!same) el.classList.add('sel');
    return;
  }
  const other = tileEl(mt.sel.side, mt.sel.id), pair = [el, other].filter(Boolean);
  pair.forEach(t => t.classList.remove('sel'));
  if (mt.sel.id === id) {
    mt.matched.add(id); mt.sel = null; vibrate(20);
    grade(id, !mt.bad.has(id));
    pair.forEach(t => { t.classList.add('ok'); t.disabled = true; });
    updateMatchHud();
    if (mt.matched.size === mt.rounds[mt.r].length) {
      mt.busy = true;
      const last = mt.r + 1 >= mt.rounds.length;
      setTimeout(() => { if (inTrainMode('match')) document.querySelector('.match')?.classList.add('leaving'); }, 380);
      setTimeout(() => {
        mt.busy = false;
        if (!inTrainMode('match')) return;
        mt.r++;
        if (last) finishMatch(); else setRound();
        drawMatch();
      }, 680);
    }
  } else {
    mt.mistakes++; vibrate([40, 60, 40]);
    mt.bad.add(mt.sel.id); mt.bad.add(id); mt.sel = null;
    pair.forEach(t => t.classList.add('bad'));
    updateMatchHud();
    setTimeout(() => pair.forEach(t => t.classList.remove('bad')), 420);
  }
}

function finishMatch() {
  stopTicker();
  mt.over = true; mt.time = Math.max(1, Math.round((Date.now() - mt.start) / 1000));
  const best = store.get('safelex:matchBest', 0);
  if (!best || mt.time < best) { mt.record = !!best; store.set('safelex:matchBest', mt.time); }
}

function drawMatch() {
  const title = `Пари · ${catTitle(mt.cat)}`;
  if (!mt.rounds.length || mt.rounds[0].length < 2) { app.innerHTML = emptyMode('Пари', 'Замало термінів', 'Для гри в пари потрібно щонайменше 2 терміни.'); return; }
  if (mt.over) {
    const best = store.get('safelex:matchBest', 0);
    app.innerHTML = `<div class="trainer">${trainBar(title, 1, 1, fmtTime(mt.time))}
      <div class="result-screen">
        <span class="score">${fmtTime(mt.time)}</span>
        <span class="msg">${mt.record ? 'Новий рекорд!' : `Рекорд: ${fmtTime(best)}`} · ${mt.mistakes ? `${mt.mistakes} ${plural(mt.mistakes, 'помилка', 'помилки', 'помилок')}` : 'без жодної помилки'}</span>
      </div>
      ${missList(mt.rounds.flat().filter(t => mt.bad.has(t.id)))}
      <button class="btn" data-action="restart">Ще раз</button>
      <a class="btn ghost" href="#/train">Інший режим</a></div>`;
    return;
  }
  const done = mt.rounds.slice(0, mt.r).reduce((n, r) => n + r.length, 0);
  const total = mt.rounds.reduce((n, r) => n + r.length, 0);
  app.innerHTML = `<div class="trainer">${trainBar(title, done, total, fmtTime(Math.floor((Date.now() - mt.start) / 1000)))}
    <div class="match-head">
      <span class="rounds">${mt.rounds.map((_, i) => `<i class="${i < mt.r ? 'done' : i === mt.r ? 'cur' : ''}"></i>`).join('')}<b>Раунд ${mt.r + 1} з ${mt.rounds.length}</b></span>
      <span class="mt-miss ${mt.mistakes ? 'has' : ''}">${I.x}<span>${mt.mistakes}</span></span>
    </div>
    <div class="match entering">
      ${mt.left.map((l, i) => {
        const r = mt.right[i];
        return `<button class="tile en" style="--i:${i}" data-mt="l" data-id="${l.id}">${esc(l.en)}</button>` +
          `<button class="tile" style="--i:${i}" data-mt="r" data-id="${r.id}">${esc(r.uaShort || r.ua)}</button>`;
      }).join('')}
    </div>
    <span class="meta dark match-hint">Торкніться терміна, а потім його перекладу</span></div>`;
  setTimeout(() => document.querySelector('.match.entering')?.classList.remove('entering'), 700);
}

onClick('mt', (side, el) => matchTap(side, el.dataset.id));
