// «Спринт»: 60 секунд — правильний переклад чи ні.
import { esc, plural } from '../../core/util.js';
import { store } from '../../core/store.js';
import { SPRINT_SEC } from '../../config.js';
import { catTitle } from '../../data.js';
import { poolFor, noteMistake } from '../../learn/srs.js';
import { logAnswer } from '../../learn/activity.js';
import { distractors } from '../../learn/questions.js';
import { I } from '../../ui/icons.js';
import { app, vibrate } from '../../ui/dom.js';
import { onClick, onAction } from '../../ui/events.js';
import { trainBar, emptyMode, missList, startTicker, stopTicker, tickerRunning } from './shared.js';

const sp = { cat: 'all', pool: [], started: false, over: false, left: SPRINT_SEC, score: 0, total: 0, pair: null, flash: '', missed: [], record: false };

export function startSprint(cat) {
  stopTicker();
  Object.assign(sp, { cat, pool: poolFor(cat), started: false, over: false, left: SPRINT_SEC, score: 0, total: 0, pair: null, flash: '', missed: [], record: false });
  drawSprint();
}

function goSprint() {
  Object.assign(sp, { started: true, over: false, left: SPRINT_SEC, score: 0, total: 0, flash: '', missed: [], record: false, pair: null });
  nextPair(); drawSprint();
  startTicker(() => {
    if (--sp.left <= 0) {
      stopTicker(); sp.over = true;
      const best = store.get('safelex:sprintBest', 0);
      if (sp.score > best) { sp.record = best > 0; store.set('safelex:sprintBest', sp.score); }
      drawSprint(); return;
    }
    const c = document.querySelector('.counter'), bar = document.querySelector('.trainer .progress div');
    if (c) c.textContent = sp.left + ' с';
    if (bar) bar.style.width = (SPRINT_SEC - sp.left) / SPRINT_SEC * 100 + '%';
  });
}

/** Наступна пара: з імовірністю 50% — з чужим перекладом. Той самий термін двічі поспіль не трапляється. */
function nextPair() {
  const prev = sp.pair?.t;
  let t;
  do t = sp.pool[Math.floor(Math.random() * sp.pool.length)]; while (t === prev && sp.pool.length > 1);
  const fake = Math.random() < 0.5 ? distractors(t, 'uaShort', 1)[0] : null;
  sp.pair = { t, ua: (fake || t).uaShort || (fake || t).ua, truth: !fake };
}

function sprintAnswer(saysTrue) {
  const p = sp.pair, right = saysTrue === p.truth;
  app.classList.remove('enter');
  sp.total++;
  if (right) { sp.score++; vibrate(15); logAnswer(true); }
  else { vibrate([40, 60, 40]); noteMistake(p.t.id); if (!sp.missed.includes(p.t)) sp.missed.push(p.t); }
  sp.flash = right ? 'ok' : 'bad';
  nextPair(); drawSprint();
}

function drawSprint() {
  const title = `Спринт · ${catTitle(sp.cat)}`, best = store.get('safelex:sprintBest', 0);
  if (sp.pool.length < 2) { app.innerHTML = emptyMode('Спринт', 'Замало термінів', 'Для спринту потрібно щонайменше 2 терміни.'); return; }
  let body;
  if (!sp.started) body = `
    <div class="q-card">
      <span class="label">${SPRINT_SEC} секунд</span>
      <span class="q">Правильно чи ні?</span>
      <span class="hint">Бачите термін і переклад — вирішуйте якомога швидше, чи переклад правильний.</span>
    </div>
    <ul class="sp-rules">
      <li><span class="sp-k yes">Так</span>переклад правильний <kbd>→</kbd></li>
      <li><span class="sp-k no">Ні</span>переклад хибний <kbd>←</kbd></li>
      <li><span class="sp-k">${I.redo}</span>помилки потрапляють у режим «Помилки»</li>
      ${best ? `<li><span class="sp-k">${I.bolt}</span>ваш рекорд — ${best} ${plural(best, 'правильна відповідь', 'правильні відповіді', 'правильних відповідей')}</li>` : ''}
    </ul>
    <button class="btn" data-action="sprint-go">Старт</button>`;
  else if (sp.over) body = `
    <div class="result-screen">
      <span class="score">${sp.score}</span>
      <span class="msg">${sp.record ? 'Новий рекорд!' : `правильних із ${sp.total} · рекорд ${Math.max(best, sp.score)}`}</span>
    </div>
    ${missList(sp.missed)}
    <button class="btn" data-action="sprint-go">Ще раз</button>
    <a class="btn ghost" href="#/train">Інший режим</a>`;
  else body = `
    <div class="q-card sp-card ${sp.flash}">
      <span class="label">Це правильний переклад?</span>
      <span class="q">${esc(sp.pair.t.en)}</span>
      <span class="sp-ua">${esc(sp.pair.ua)}</span>
    </div>
    <div class="row-btns">
      <button class="btn no" data-sprint="0">Ні</button>
      <button class="btn yes" data-sprint="1">Так</button>
    </div>
    <span class="sp-score">Рахунок: <b>${sp.score}</b></span>`;
  app.innerHTML = `<div class="trainer">${trainBar(title, sp.started ? SPRINT_SEC - sp.left : 0, SPRINT_SEC, `${sp.left} с`)}${body}</div>`;
}

onAction('sprint-go', goSprint);
onClick('sprint', v => { if (tickerRunning() && !sp.over) sprintAnswer(v === '1'); });
