import { esc, plural, nDays, sample, hashStr } from '../core/util.js';
import { dayKey } from '../core/dates.js';
import { store } from '../core/store.js';
import { DAILY_LEN, MAX_RESULTS } from '../config.js';
import { TERMS, CORE, termById, catById, short, toneOf } from '../data.js';
import { favs, recent, qHist, rememberQuery, clearRecent, clearQueries } from '../user.js';
import { RANKS, rankOf, nextRank } from '../learn/ranks.js';
import { streak, bestStreak, doneToday } from '../learn/streak.js';
import { smartSearch } from '../search/index.js';
import { wordsOf } from '../search/text.js';
import { highlight, exSnippet } from '../search/highlight.js';
import { I } from '../ui/icons.js';
import { app } from '../ui/dom.js';
import { onClick, onAction } from '../ui/events.js';
import { badge } from '../ui/badge.js';
import { installCard } from '../ui/install.js';

const TRY_Q = ['arson', 'горіння', 'fire alarm', 'breathing apparatus', 'вогнегасник', 'first aid', 'задимлення', 'false alarm'];

let lastQuery = '';
let searchCat = 'all';

export function renderHome({ query, focus = false } = {}) {
  if (query != null) lastQuery = query;
  app.innerHTML = `
    <header class="hero">
      <div class="brand">
        <div class="logo">SL</div>
        <div class="grow">
          <div class="brand-name">Safe<span>Lex</span></div>
          <div class="brand-sub">Англо-український словник рятувальника</div>
        </div>
        <a href="#/about" aria-label="Про застосунок"><img class="hdr-emblem" src="icons/emblem.png" alt="Герб ДСНС"></a>
      </div>
      <label class="searchbox">
        ${I.search}
        <input id="q" type="search" value="${esc(lastQuery)}" placeholder="arson, fire alarm, горіння…" aria-label="Пошук терміна" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="clear" data-action="clear" aria-label="Очистити" ${lastQuery ? '' : 'hidden'}>${I.x}</button>
      </label>
      <div class="chips scroll" id="qchips"></div>
    </header>
    <section class="section" id="homeBody"></section>`;
  const input = document.getElementById('q');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { rememberQuery(input.value); input.blur(); } });
  let typing = 0;
  input.addEventListener('input', () => { lastQuery = input.value; clearTimeout(typing); typing = setTimeout(drawHome, lastQuery.trim() ? 70 : 0); });
  document.getElementById('homeBody').addEventListener('click', e => { if (e.target.closest('a.result, .best a')) rememberQuery(lastQuery); });
  drawHome();
  if (focus) input.focus();
}

const tryChips = () => `<span class="qc-label">Спробуйте</span>${TRY_Q.map(h => `<button class="chip qc" data-q="${esc(h)}">${esc(h)}</button>`).join('')}`;

function drawHome() {
  const body = document.getElementById('homeBody'), chips = document.getElementById('qchips');
  if (!body) return;
  const q = lastQuery.trim();
  document.querySelector('.searchbox .clear')?.toggleAttribute('hidden', !lastQuery);
  if (!q) {
    chips.innerHTML = qHist.length
      ? `<span class="qc-label">Ви шукали</span>${qHist.map(h => `<button class="chip qc" data-q="${esc(h)}">${esc(h)}</button>`).join('')}<button class="chip qc-x" data-action="qhist-clear" aria-label="Очистити історію">${I.x}</button>`
      : tryChips();
    chips.removeAttribute('hidden');
    body.innerHTML = installCard() + dailyCard() + termOfDayCard() + recentBlock(); return;
  }
  const all = smartSearch(q);
  const counts = {};
  all.list.forEach(r => { counts[r.t.cat] = (counts[r.t.cat] || 0) + 1; });
  if (searchCat !== 'all' && !counts[searchCat]) searchCat = 'all';
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  chips.innerHTML = cats.length
    ? `<button class="chip ${searchCat === 'all' ? 'active' : ''}" data-cat="all">Усі <em>${all.list.length}</em></button>` +
      (cats.length > 1 ? cats.map(c => `<button class="chip ${searchCat === c ? 'active' : ''}" data-cat="${c}">${esc(short(catById[c]))} <em>${counts[c]}</em></button>`).join('') : '')
    : tryChips();
  chips.removeAttribute('hidden');
  const res = searchCat === 'all' ? all.list : all.list.filter(r => r.t.cat === searchCat);
  const marks = all.marks;
  if (!res.length) {
    body.innerHTML = `<div class="empty-box sr-empty"><span class="eb-ic">${I.search}</span><b>Нічого не знайдено</b>
      <span>Перевірте написання або спробуйте шукати іншою мовою — пошук розуміє і англійські, і українські слова.</span></div>`;
    return;
  }
  const top = res[0], best = !top.fuzzy && !top.ex && top.score >= 100 ? top.t : null;
  const rest = best ? res.slice(1) : res;
  const fuzzyOnly = res.every(r => r.fuzzy || r.ex);
  const notes = [
    all.layout ? `<div class="sr-note">${I.search}<span>Схоже, була інша розкладка — показано для «<b>${esc(all.layout)}</b>»</span></div>` : '',
    fuzzyOnly && res.some(r => r.fuzzy) ? `<div class="sr-note">${I.search}<span>Точних збігів немає. Можливо, ви мали на увазі <button class="link-sm" data-q="${esc(top.t.en)}">${esc(top.t.en)}</button>?</span></div>` : ''
  ].join('');
  const exWords = marks.concat(wordsOf(q));
  const row = r => `
    <a class="result ${toneOf(r.t.cat)}" href="#/term/${r.t.id}">
      <span class="top"><span class="en">${highlight(r.t.en, marks)}</span><span class="tag">${esc(short(catById[r.t.cat]))}</span></span>
      ${r.t.full ? `<span class="full">${highlight(r.t.full, marks)}</span>` : ''}
      <span class="ua">${highlight(r.t.ua, marks)}</span>
      ${r.ex ? `<span class="sr-ex">знайдено в прикладі: «${highlight(exSnippet(r.t, exWords), exWords)}»</span>` : ''}
    </a>`;
  const more = res.length - (best ? 1 : 0);
  body.innerHTML = notes + (best ? bestCard(best, marks) : '') +
    (rest.length ? `<span class="meta">${best ? 'Ще ' : ''}${more} ${plural(more, 'результат', 'результати', 'результатів')}${rest.length > MAX_RESULTS ? ` · показано перші ${MAX_RESULTS}` : ''}</span>` : '') +
    rest.slice(0, MAX_RESULTS).map(row).join('');
}

const favBtn = (t, cls = 'pill') => {
  const on = favs.has(t.id);
  return `<button class="${cls} ${on ? 'on' : ''}" data-action="fav" data-id="${t.id}" aria-pressed="${on}">${I.star}<span>${on ? 'Збережено' : 'Зберегти'}</span></button>`;
};

function bestCard(t, marks) {
  return `
    <div class="best ${toneOf(t.cat)}">
      <span class="best-k">Точний збіг · ${esc(short(catById[t.cat]))}</span>
      <a class="best-en" href="#/term/${t.id}">${highlight(t.en, marks)}</a>
      ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
      ${t.full ? `<span class="best-full">${esc(t.full)}</span>` : ''}
      <span class="best-ua">${esc(t.ua)}</span>
      ${t.exEn ? `<span class="best-ex">“${esc(t.exEn)}”</span>` : ''}
      <span class="best-act">
        <a class="pill" href="#/term/${t.id}">Детальніше</a>
        ${favBtn(t)}
      </span>
    </div>`;
}

function dailyCard() {
  const done = doneToday(), days = streak(), best = bestStreak(), res = store.get('safelex:dailyScore', {});
  const next = nextRank(best), prev = rankOf(best);
  const base = done ? days : days + 1;
  const week = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const n = base + i, r = RANKS.find(r => r.days === n && r.days > best);
    const inner = i === 0 && done ? I.flame : r ? badge(r, true) : `<b class="len${String(n).length}">${n}</b>`;
    return `<span class="wd ${i === 0 ? 'today' : ''} ${i === 0 && done ? 'on' : ''} ${r ? 'rk' : ''}" ${r ? `title="День ${n}: звання «${esc(r.title)}»"` : ''}><i>${inner}</i>${i === 0 ? 'Сьогодні' : ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]}</span>`;
  }).join('');
  const from = prev ? prev.days : 0;
  return `
    <a class="daily ${done ? 'done' : ''}" href="#/train/daily">
      <span class="daily-top">
        <span class="fire ${days ? 'lit' : ''}">${I.flame}<b class="len${String(days).length}">${days}</b><small>${plural(days, 'день', 'дні', 'днів')}</small></span>
        <span class="daily-txt">
          <span class="k">${days ? 'Серія' : 'Серія ще не почалася'}</span>
          <span class="t">${done ? 'Сьогодні виконано' : 'Завдання дня'}</span>
          <span class="s">${done && res.date === dayKey() ? `Результат ${res.score} з ${res.total} · наступне — завтра` : `${DAILY_LEN} питань з усієї бази`}</span>
        </span>
        <span class="go">${done ? I.check : I.chev}</span>
      </span>
      <span class="week">${week}</span>
      ${next ? `
        <span class="next-rank">
          <span class="nr-main">
            <span class="nr-bar"><span style="width:${Math.max(0, Math.round((days - from) / (next.days - from) * 100))}%"></span></span>
            <span class="nr-txt">${esc(prev.title)} → <b>${esc(next.title)}</b> · ще ${nDays(next.days - days)}</span>
          </span>
          <span class="nr-pg">${badge(next, true)}</span>
        </span>` : `<span class="nr-txt">Найвище звання — «Генерал»</span>`}
    </a>`;
}

let todTerm = null, todShown = false;
const todPool = () => CORE.length ? CORE : TERMS;
const termOfToday = () => todTerm || todPool()[hashStr(dayKey()) % todPool().length];

function termOfDayCard() {
  if (!TERMS.length) return '';
  const t = termOfToday();
  return `
    <div class="tod ${toneOf(t.cat)}">
      <div class="tod-head">
        <span class="label">${todTerm ? 'Випадковий термін' : 'Термін дня'}</span>
        <button class="tod-more" data-action="tod-next">${I.dice}Ще один</button>
      </div>
      <div class="tod-body">
        <span class="tod-en">${esc(t.en)}</span>
        ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
        ${t.full ? `<span class="tod-full">${esc(t.full)}</span>` : ''}
        ${t.exEn ? `<span class="tod-ex">“${esc(t.exEn)}”</span>` : ''}
        <button class="tod-ua ${todShown ? 'shown' : ''}" data-action="tod-reveal" aria-expanded="${todShown}">
          <span class="tu-text">${esc(t.uaShort || t.ua)}</span>
          <span class="tu-cover">${I.eye}Спершу згадайте самі — торкніться, щоб побачити переклад</span>
        </button>
      </div>
      <div class="tod-actions">
        <a class="pill" href="#/term/${t.id}">Детальніше</a>
        ${favBtn(t)}
      </div>
    </div>`;
}

function recentBlock() {
  if (!recent.length) return '';
  return `
    <div class="section-head"><h2>Нещодавні</h2><button class="link-sm" data-action="recent-clear">Очистити</button></div>
    <div class="recent">${recent.slice(0, 5).map(id => `<a class="${toneOf(termById[id].cat)}" href="#/term/${id}"><b>${esc(termById[id].en)}</b><span>${esc(termById[id].ua)}</span></a>`).join('')}</div>`;
}

onClick('cat', v => { searchCat = v; drawHome(); });
onClick('q', v => { lastQuery = v; const i = document.getElementById('q'); if (i) i.value = v; drawHome(); });
onAction('clear', () => { const i = document.getElementById('q'); i.value = ''; lastQuery = ''; drawHome(); i.focus(); });
onAction('qhist-clear', () => { clearQueries(); drawHome(); });
onAction('recent-clear', () => { clearRecent(); drawHome(); });
onAction('tod-reveal', el => { todShown = !todShown; el.classList.toggle('shown', todShown); el.setAttribute('aria-expanded', todShown); });
onAction('tod-next', () => {
  const cur = termOfToday();
  todShown = false;
  todTerm = TERMS.length > 1 ? sample(todPool().length > 1 ? todPool() : TERMS, 1, t => t === cur)[0] || cur : cur;
  const box = document.querySelector('.tod');
  if (box) { box.outerHTML = termOfDayCard(); document.querySelector('.tod').classList.add('swap'); }
});
