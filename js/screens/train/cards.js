// Флеш-картки: згадати переклад, перевернути, «Знаю» / «Ще вчу» (кнопкою або свайпом).
// «Ще вчу» повертає картку в кінець колоди один раз.
import { esc, plural } from '../../core/util.js';
import { CARDS_LEN } from '../../config.js';
import { catTitle, toneOf } from '../../data.js';
import { grade, poolFor, pickTerms } from '../../learn/srs.js';
import { logAnswer } from '../../learn/activity.js';
import { I } from '../../ui/icons.js';
import { app, vibrate } from '../../ui/dom.js';
import { onAction } from '../../ui/events.js';
import { trainBar, emptyMode, gainLine, inTrainMode } from './shared.js';

const cd = { cat: 'all', deck: [], i: 0, flipped: false, known: 0, again: 0, gained: 0, learned: 0, busy: false, requeued: new Set() };

export function startCards(cat) {
  Object.assign(cd, { cat, deck: pickTerms(poolFor(cat), CARDS_LEN), i: 0, flipped: false, known: 0, again: 0, gained: 0, learned: 0, busy: false, requeued: new Set() });
  drawCards();
}

function rateCard(knows) {
  const t = cd.deck[cd.i];
  const repeat = !knows && cd.requeued.has(t.id);
  const g = repeat ? (logAnswer(false), { gain: 0, mastered: false }) : grade(t.id, knows);
  if (g.gain > 0) cd.gained++;
  if (g.mastered) cd.learned++;
  if (knows) cd.known++;
  else {
    cd.again++;
    if (!cd.requeued.has(t.id)) { cd.requeued.add(t.id); cd.deck.push(t); }
  }
  cd.i++; cd.flipped = false;
  if (cd.i >= cd.deck.length) drawCards(); else nextCard();
}

const FLY_MS = 380;
const longestWord = str => Math.max(0, ...String(str).split(/[\s\-–—/]+/).map(w => w.length));
const enCls = str => str.length > 28 || longestWord(str) > 14 ? 'long' : '';
const uaCls = str => str.length > 60 || longestWord(str) > 18 ? 'xl' : str.length > 30 || longestWord(str) > 13 ? 'mid' : '';
// Обидві сторони картки — одним розміром шрифту, щоб картка не «стрибала» під час перевертання.
const SIZE_RANK = { '': 0, long: 1, mid: 1, xl: 2 }, SIZE_CLS = ['', 'mid', 'xl'];
const pairCls = (en, ua) => SIZE_CLS[Math.max(SIZE_RANK[enCls(en)], SIZE_RANK[uaCls(ua)])];

function deckHtml(mode) {
  const t = cd.deck[cd.i], behind = cd.deck.slice(cd.i + 1, cd.i + 3);
  const ua = t.uaShort || t.ua, big = pairCls(t.en, ua);
  const exLong = Math.max((t.exEn || '').length, (t.exUa || '').length) > 90 ? 'long' : '';
  const back = cls => `<div class="deck-back ${cls}"><i class="db-emb"></i><i class="db-cap">ДСНС · SafeLex</i></div>`;
  return `${behind.map((n, k) => back(`d${k + 1}`)).reverse().join('')}${mode === 'next' ? back('d0') : ''}
    <button class="flash ${toneOf(t.cat)} ${mode === 'next' ? 'reveal' : 'enter'}" data-action="flip" aria-label="Перевернути картку">
      <div class="flash-inner">
        <div class="flash-face flash-front">
          <span class="flash-cat">${esc(catTitle(t.cat))}</span>
          <span class="big ${big}">${esc(t.en)}</span>
          ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
          ${t.full ? `<span class="small">${esc(t.full)}</span>` : ''}
          ${t.exEn ? `<span class="flash-ex ${exLong}">“${esc(t.exEn)}”</span>` : ''}
          <span class="tap">Торкніться, щоб перевернути</span>
        </div>
        <div class="flash-face flash-back">
          <span class="flash-cat">Переклад</span>
          <span class="big ${big}">${esc(ua)}</span>
          ${(t.senses || []).length > 1 ? `<span class="small">${esc(t.senses.slice(1).join('; '))}</span>` : ''}
          ${t.exUa ? `<span class="flash-ex ${exLong}">«${esc(t.exUa)}»</span>` : ''}
          <span class="tap">Торкніться, щоб повернути</span>
        </div>
      </div>
      <span class="stamp s-yes">Знаю</span><span class="stamp s-no">Ще вчу</span>
    </button>`;
}

function drawCards() {
  const title = `Картки · ${catTitle(cd.cat)}`;
  if (!cd.deck.length) { app.innerHTML = emptyMode('Картки', 'Термінів немає', 'У цьому розділі поки немає термінів — оберіть інший.'); return; }
  const total = cd.deck.length;
  if (cd.i >= total) {
    app.innerHTML = `<div class="trainer">${trainBar(title, total, total)}
      <div class="result-screen">
        <span class="score">${cd.known}</span>
        <span class="msg">${plural(cd.known, 'картку', 'картки', 'карток')} ви вже знаєте${cd.again ? ` · ще вчите: ${cd.again}` : ''}</span>
        ${gainLine(cd.gained, cd.learned)}
      </div>
      <button class="btn" data-action="restart">Нова колода</button>
      <a class="btn ghost" href="#/train">Інший режим</a></div>`;
    return;
  }
  app.innerHTML = `<div class="trainer">${trainBar(title, cd.i, total, `${cd.i + 1}/${total}`)}
    <div class="deck" id="deck">${deckHtml('first')}</div>
    <div class="card-tally"><span class="no" id="cNo">Ще вчу · ${cd.again}</span><span class="hint">← свайп →</span><span class="yes" id="cYes">Знаю · ${cd.known}</span></div>
    <div class="row-btns">
      <button class="btn no" data-action="card-no">Ще вчу</button>
      <button class="btn yes" data-action="card-yes">Знаю</button>
    </div></div>`;
}

/** Наступна картка без перемальовування всього екрана — щоб анімація колоди була плавною. */
function nextCard() {
  const deck = document.getElementById('deck');
  if (!deck) return drawCards();
  const total = cd.deck.length;
  const burst = deck.querySelector('.burst');
  const was = deck.offsetHeight;
  deck.classList.remove('advance', 'dragging'); deck.classList.add('settled');
  deck.style.height = ''; deck.style.removeProperty('--p');
  deck.innerHTML = deckHtml('next');
  if (burst) deck.appendChild(burst);
  const now = deck.offsetHeight;
  if (Math.abs(now - was) > 2) {
    deck.style.height = was + 'px'; void deck.offsetHeight;
    deck.style.height = now + 'px';
    clearTimeout(deck._h); deck._h = setTimeout(() => { deck.style.height = ''; }, 360);
  }
  const bar = document.querySelector('.trainer .progress div'), counter = document.querySelector('.trainer .counter');
  if (bar) bar.style.transform = `scaleX(${cd.i / total})`;
  if (counter) counter.textContent = `${cd.i + 1}/${total}`;
  const tally = (id, text) => {
    const el = document.getElementById(id);
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  };
  tally('cNo', `Ще вчу · ${cd.again}`);
  tally('cYes', `Знаю · ${cd.known}`);
}

/** Картка відлітає праворуч («Знаю») або ліворуч («Ще вчу»); поки летить, нові натискання ігноруються. */
function flyCard(knows) {
  if (cd.busy) return;
  const card = document.querySelector('.deck .flash');
  const deck = document.getElementById('deck');
  cd.busy = true;
  drag = null;
  if (card) {
    if (!card.style.getPropertyValue('--dx')) {
      const x = new DOMMatrix(getComputedStyle(card).transform).e;
      if (Math.abs(x) > 2) { card.style.setProperty('--dx', x + 'px'); card.style.setProperty('--rot', x / 18 + 'deg'); }
    }
    card.classList.remove('enter', 'reveal', 'lift', 'dragging');
    card.style.transform = '';
    card.classList.toggle('from-rest', !card.style.getPropertyValue('--dx'));
    card.classList.add(knows ? 'fly-yes' : 'fly-no');
  }
  vibrate(knows ? 20 : [30, 40, 30]);
  if (deck) {
    deck.classList.remove('dragging');
    deck.classList.add('advance');
    const b = document.createElement('span');
    b.className = 'burst ' + (knows ? 'yes' : 'no');
    b.innerHTML = knows ? I.check : I.redo;
    deck.appendChild(b);
    setTimeout(() => b.remove(), 700);
  }
  setTimeout(() => { cd.busy = false; if (inTrainMode('cards')) rateCard(knows); }, card ? FLY_MS : 0);
}

// Свайп картки пальцем або мишею.
const SWIPE_DIST = 90, FLICK_DIST = 40, FLICK_SPEED = .5;
let drag = null, dragMoved = false, dragFrame = 0;
const resetDrag = card => {
  card.style.transform = ''; ['--yes', '--no', '--dx', '--rot'].forEach(v => card.style.removeProperty(v));
  const deck = card.closest('.deck');
  if (deck) { deck.classList.remove('dragging'); deck.style.removeProperty('--p'); }
};
function paintDrag() {
  dragFrame = 0;
  if (!drag || !dragMoved) return;
  const { card, dx } = drag, rot = dx / 18;
  card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  card.style.setProperty('--dx', dx + 'px'); card.style.setProperty('--rot', rot + 'deg');
  card.style.setProperty('--yes', Math.max(0, Math.min(1, dx / SWIPE_DIST)));
  card.style.setProperty('--no', Math.max(0, Math.min(1, -dx / SWIPE_DIST)));
  card.parentElement.style.setProperty('--p', Math.min(1, Math.abs(dx) / (SWIPE_DIST * 1.6)));
}
document.addEventListener('pointerdown', e => {
  const card = e.target.closest('.deck .flash');
  if (!card || cd.busy || (e.button && e.pointerType === 'mouse')) return;
  drag = { card, x: e.clientX, y: e.clientY, dx: 0, t: e.timeStamp, v: 0 }; dragMoved = false;
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!dragMoved) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    dragMoved = true;
    drag.card.classList.remove('enter', 'reveal', 'lift'); drag.card.classList.add('dragging');
    drag.card.parentElement.classList.add('dragging');
  }
  const dt = e.timeStamp - drag.t;
  if (dt > 0) drag.v = drag.v * .5 + (dx - drag.dx) / dt * .5;
  drag.dx = dx; drag.t = e.timeStamp;
  if (!dragFrame) dragFrame = requestAnimationFrame(paintDrag);
});
const endDrag = () => {
  if (!drag) return;
  const { card, dx, v } = drag; drag = null;
  if (dragFrame) { cancelAnimationFrame(dragFrame); dragFrame = 0; }
  card.classList.remove('dragging');
  const flick = Math.abs(dx) > FLICK_DIST && Math.abs(v) > FLICK_SPEED && Math.sign(v) === Math.sign(dx);
  if (Math.abs(dx) > SWIPE_DIST || flick) {
    card.style.setProperty('--dx', dx + 'px'); card.style.setProperty('--rot', dx / 18 + 'deg');
    flyCard(dx > 0);
  } else resetDrag(card);
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

onAction('flip', el => {
  if (dragMoved) { dragMoved = false; return; } // після свайпу «клік» не перевертає картку
  if (cd.busy) return;
  cd.flipped = !cd.flipped;
  el.classList.remove('enter', 'reveal', 'lift'); void el.offsetWidth;
  el.classList.toggle('flipped', cd.flipped); el.classList.add('lift');
  const deck = el.closest('.deck'); deck?.classList.add('flipping'); clearTimeout(deck?._f); if (deck) deck._f = setTimeout(() => deck.classList.remove('flipping'), 650);
});
onAction('card-yes', () => flyCard(true));
onAction('card-no', () => flyCard(false));
