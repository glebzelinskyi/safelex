// Тест, «Помилки» й завдання дня: питання з варіантами або з введенням відповіді.
// Помилку тест повертає ще раз через 3 питання (без впливу на галочки).
import { esc, plural, shuffle, nDays } from '../../core/util.js';
import { QUIZ_LEN, MASTERED } from '../../config.js';
import { catTitle } from '../../data.js';
import { grade, poolFor, mistakesIn, pickTerms } from '../../learn/srs.js';
import { makeQuestion, typedRight, dailyTerms } from '../../learn/questions.js';
import { RANKS, rankOf, nextRank } from '../../learn/ranks.js';
import { streak, bestStreak, finishDaily } from '../../learn/streak.js';
import { I } from '../../ui/icons.js';
import { app, vibrate } from '../../ui/dom.js';
import { onClick, onAction } from '../../ui/events.js';
import { badge } from '../../ui/badge.js';
import { celebrate } from '../../ui/ranks.js';
import { checksHtml } from '../../ui/learn.js';
import { trainBar, emptyMode, missList, gainLine, inTrainMode } from './shared.js';

const QUIZ_TITLE = { quiz: 'Тест', mistakes: 'Робота над помилками', daily: 'Завдання дня' };
const tr = { mode: 'quiz', cat: 'all', qs: [], base: 0, i: 0, score: 0, ans: null, done: false, missed: [], rank: null, gained: 0, learned: 0 };

export function startQuiz(mode, cat) {
  Object.assign(tr, { mode, cat, i: 0, score: 0, ans: null, done: false, missed: [], rank: null, gained: 0, learned: 0 });
  if (mode === 'daily') tr.qs = dailyTerms().map(t => makeQuestion(t, null, true));
  else if (mode === 'mistakes') tr.qs = shuffle(mistakesIn(cat)).slice(0, QUIZ_LEN).map(t => makeQuestion(t, 'en2ua'));
  else tr.qs = pickTerms(poolFor(cat), QUIZ_LEN).map(t => makeQuestion(t));
  tr.base = tr.qs.length;
  drawQuiz();
}

function answer(right, extra) {
  const q = tr.qs[tr.i];
  app.classList.remove('enter');
  tr.ans = Object.assign({ right }, extra);
  vibrate(right ? 25 : [40, 60, 40]);
  if (!q.retry) {
    tr.ans.g = grade(q.t.id, right);
    if (tr.ans.g.gain > 0) tr.gained++;
    if (tr.ans.g.mastered) tr.learned++;
    if (right) tr.score++;
    else {
      tr.missed.push(q.t);
      tr.qs.splice(Math.min(tr.i + 3, tr.qs.length), 0, Object.assign(makeQuestion(q.t, q.kind === 'en2ua' ? 'ua2en' : 'en2ua'), { retry: true }));
    }
  }
  drawQuiz();
  document.querySelector('[data-action="next"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function nextQuestion() {
  tr.ans = null;
  if (++tr.i >= tr.qs.length) {
    tr.done = true; tr.i = tr.qs.length - 1;
    if (tr.mode === 'daily') tr.rank = finishDaily(tr.score, tr.base);
  }
  drawQuiz();
  window.scrollTo(0, 0);
  if (tr.done && tr.rank) setTimeout(() => { if (inTrainMode('daily')) celebrate(tr.rank); }, 350);
}

function submitTyped(giveUp) {
  const typed = giveUp ? '' : (document.getElementById('ans')?.value || '');
  if (!giveUp && !typed.trim()) return;
  answer(typedRight(typed, tr.qs[tr.i].t), { typed });
}

function drawQuiz() {
  const title = QUIZ_TITLE[tr.mode] + (tr.mode === 'daily' ? '' : ` · ${catTitle(tr.cat)}`);
  const exit = tr.mode === 'daily' ? '#/' : '#/train';
  if (!tr.qs.length) {
    app.innerHTML = tr.mode === 'mistakes'
      ? emptyMode(QUIZ_TITLE[tr.mode], 'Помилок поки немає', 'Сюди потраплять терміни, у яких ви помилитеся в тесті, картках, парах чи спринті.')
      : emptyMode(QUIZ_TITLE[tr.mode], 'Термінів немає', 'У цьому розділі поки немає термінів — оберіть інший.');
    return;
  }
  const total = tr.qs.length, pos = tr.done ? total : tr.i + (tr.ans ? 1 : 0);
  app.innerHTML = `<div class="trainer ${tr.ans || tr.done ? '' : 'q-in'}">${trainBar(title, pos, total, null, exit)}${tr.done ? quizResult() : quizBody()}</div>`;
  const input = document.getElementById('ans');
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(false); } });
    input.focus({ preventScroll: true });
  }
}

function progressNote(g, right) {
  return g.mastered ? 'Термін вивчено'
    : g.gain > 0 ? `+1 галочка · ще ${MASTERED - g.checks} ${plural(MASTERED - g.checks, 'день', 'дні', 'днів')}`
    : g.gain < 0 ? '−1 галочка'
    : right ? (g.checks >= MASTERED ? 'Вже вивчено' : 'Сьогодні вже зараховано — приходьте завтра') : 'Галочок поки немає';
}

function quizBody() {
  const q = tr.qs[tr.i], a = tr.ans, t = q.t;
  let answers;
  if (q.kind === 'type') {
    answers = a
      ? `<div class="typed ${a.right ? 'ok' : 'bad'}">${esc(a.typed) || '—'}</div>`
      : `<input id="ans" class="type-input" type="text" placeholder="Ваша відповідь" aria-label="Відповідь англійською" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
         <div class="row-btns">
           <button class="btn ghost" data-action="giveup">Не знаю</button>
           <button class="btn" data-action="check">Перевірити</button>
         </div>`;
  } else {
    answers = `<div class="options">${q.options.map((o, n) => {
      const cls = !a ? '' : o.id === t.id ? 'ok' : o.id === a.picked ? 'bad' : 'dim';
      return `<button class="opt ${cls}" data-pick="${o.id}" ${a ? 'disabled' : ''}><span class="key">${n + 1}</span><span class="txt">${esc(o[q.key])}</span></button>`;
    }).join('')}</div>`;
  }
  return `
    <div class="q-card ${q.kind === 'context' ? 'ctx' : ''}">
      <span class="label">${q.retry ? 'Ще раз · ' : ''}${q.label}</span>
      <span class="q">${esc(q.ask)}</span>
      ${q.hint ? `<span class="hint">${esc(q.hint)}</span>` : ''}
    </div>
    ${answers}
    ${a ? `
      <div class="feedback ${a.right ? 'ok' : 'bad'}">
        <b>${a.right ? 'Правильно!' : 'Запам’ятайте:'}</b>
        <span><b class="mono">${esc(t.en)}</b> — ${esc(t.ua)}${t.full && q.kind !== 'en2ua' ? ` · ${esc(t.full)}` : ''}</span>
        ${!a.right && t.exEn ? `<span class="fb-ex">“${esc(t.exEn)}”</span>` : ''}
        ${a.g ? `<span class="fb-progress">${checksHtml(a.g.checks)}<span>${progressNote(a.g, a.right)}</span></span>` : ''}
      </div>
      <button class="btn" data-action="next">${tr.i + 1 < tr.qs.length ? 'Далі' : 'Результат'}</button>` : ''}`;
}

/** Смужка до наступного звання на екрані результату завдання дня. */
function rankProgress(days) {
  const best = bestStreak(), next = nextRank(best), cur = rankOf(best);
  if (!next) return `<div class="res-rank top">${badge(cur, true, false, true)}<span class="rr-body"><span class="k">Найвище звання</span><b>${esc(cur.title)}</b></span></div>`;
  const span = next.days - cur.days, pct = d => Math.round(Math.min(1, Math.max(0, (d - cur.days) / span)) * 100);
  const fresh = !!tr.rank;
  return `
    <button class="res-rank" data-rank="${RANKS.indexOf(next)}">
      <span class="rr-pg">${badge(next, true)}</span>
      <span class="rr-body">
        <span class="k">Наступне звання</span>
        <b>${esc(next.title)}</b>
        <span class="rr-bar"><i style="--from:0%;--to:${fresh ? 2 : pct(days)}%;${fresh ? '' : `--from:${pct(days - 1)}%`}"></i></span>
        <span class="rr-txt">${fresh ? `<em>«${esc(cur.title)}» — ваше!</em>` : '<em>+1 день</em>'} · ще ${nDays(next.days - days)} поспіль</span>
      </span>
    </button>`;
}

function quizResult() {
  const pct = tr.base ? tr.score / tr.base : 0;
  const daily = tr.mode === 'daily', days = streak();
  const msg = daily ? 'Завдання дня виконано!'
    : pct >= 0.9 ? 'Майже без помилок.' : pct >= 0.6 ? 'Непогано. Помилки повторимо найближчим часом.' : 'Ці терміни варто повторити.';
  return `
    <div class="result-screen">
      <span class="score">${tr.score}/${tr.base}</span>
      <span class="msg">${msg}</span>
      ${daily ? `<span class="res-fire">${I.flame}${nDays(days)} поспіль</span>` : ''}
      ${gainLine(tr.gained, tr.learned)}
    </div>
    ${daily ? rankProgress(days) : ''}
    ${missList(tr.missed)}
    ${daily ? `<a class="btn" href="#/">Готово</a>` : `
      <button class="btn" data-action="restart">Ще раз</button>
      <a class="btn ghost" href="#/train">Інший режим</a>`}`;
}

onClick('pick', v => { if (!tr.ans && tr.qs[tr.i]) answer(v === tr.qs[tr.i].t.id, { picked: v }); });
onAction('next', nextQuestion);
onAction('check', () => submitTyped(false));
onAction('giveup', () => submitTyped(true));
