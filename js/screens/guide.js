// Довідник: розділи за темами, список термінів розділу з фільтром і алфавітом.
import { esc, plural, pad, nTerms } from '../core/util.js';
import { GUIDE_CHUNK } from '../config.js';
import { TERMS, CATEGORIES, MARCH_STEPS, catById, byCat, toneOf } from '../data.js';
import { favs } from '../user.js';
import { progressOf, poolFor } from '../learn/srs.js';
import { smartSearch } from '../search/index.js';
import { highlight } from '../search/highlight.js';
import { I } from '../ui/icons.js';
import { app, countUp } from '../ui/dom.js';
import { onClick } from '../ui/events.js';
import { devCard } from '../ui/authors.js';
import { onLeave, onRestoreScroll } from '../router.js';

const GROUPS = [
  { title: 'Служба та зв’язок', ids: ['service', 'alarm'] },
  { title: 'Вогонь і гасіння', ids: ['combustion', 'extinguishing', 'heat', 'forest'] },
  { title: 'Техніка та вода', ids: ['vehicles', 'water', 'aviation'] },
  { title: 'Люди й будівлі', ids: ['rescue', 'buildings'] },
  { title: 'Небезпечні речовини', ids: ['chemistry', 'explosives'] },
  { title: 'Загальна лексика', ids: ['technical'] }
];

/** Розділи, згруповані за GROUPS; ті, що не потрапили в жодну групу, — в «Інше». */
function guideGroups() {
  const used = new Set(), out = GROUPS.map(g => ({ title: g.title, cats: g.ids.map(id => catById[id]).filter(c => c && !used.has(c.id) && used.add(c.id)) }));
  const rest = CATEGORIES.filter(c => !used.has(c.id));
  if (rest.length) out.push({ title: 'Інше', cats: rest });
  return out.filter(g => g.cats.length);
}

/** Три терміни-приклади для картки розділу: ключові, абревіатури, короткі. */
const previewTerms = list => list.slice().sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0) || (b.full ? 1 : 0) - (a.full ? 1 : 0) || a.en.length - b.en.length).slice(0, 3);

export function renderGuide() {
  const p = progressOf(TERMS), n = TERMS.length || 1;
  let no = 0;
  app.innerHTML = `
    <header class="hero">
      <h1>Довідник</h1>
      <p class="lead">${nTerms(TERMS.length)} у ${CATEGORIES.length} розділах</p>
      <div class="g-prog">
        <div class="stack"><span class="s-mastered" style="width:${p.mastered / n * 100}%"></span><span class="s-learning" style="width:${p.learning / n * 100}%"></span></div>
        <span>Вивчено <b>${p.mastered}</b> · вчу <b>${p.learning}</b></span>
      </div>
    </header>
    <section class="section">
      <a class="az-row" href="#/guide/all">
        <span class="az-mark">A–Я</span>
        <span class="body"><b>Усі терміни</b><span>Алфавітний список з фільтром</span></span>${I.chev}
      </a>
      ${guideGroups().map(g => {
        const total = g.cats.reduce((k, c) => k + (byCat[c.id] || []).length, 0);
        return `
        <div class="section-head"><h2>${esc(g.title)}</h2><span class="meta">${nTerms(total)}</span></div>
        <div class="topics">
          ${g.cats.map(c => {
            const list = byCat[c.id] || [], pc = progressOf(list), k = list.length || 1;
            return `
            <a class="topic" href="#/guide/${c.id}" style="--i:${no++}">
              <span class="tp-no" style="--p:${Math.round((pc.mastered + pc.learning * 0.5) / k * 100)}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="tn-t" cx="22" cy="22" r="20"/><circle class="tn-v" cx="22" cy="22" r="20" pathLength="100"/></svg><b>${pad(no)}</b></span>
              <span class="tp-body">
                <span class="tp-title">${esc(c.title)}</span>
                ${c.en ? `<span class="tp-en">${esc(c.en)}</span>` : ''}
                <span class="tp-peek">напр.: ${previewTerms(list).map(t => esc(t.en)).join(', ')}</span>
              </span>
              <span class="tp-count"><em data-count="${list.length}">${list.length}</em><small>${pc.mastered ? `вивч. ${pc.mastered}` : plural(list.length, 'термін', 'терміни', 'термінів')}</small></span>
            </a>`;
          }).join('')}
        </div>`;
      }).join('')}
      ${devCard()}
    </section>`;
  countUp(app);
}

// Список розділу: відсортований за алфавітом, домальовується шматками під час гортання.
const sortedCache = {};
const sortKey = t => t.en.replace(/^[^a-z0-9]+/i, '');
const sortedTerms = cat => sortedCache[cat] ||= poolFor(cat).slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'en', { sensitivity: 'base' }));
export const letterOf = t => { const c = (t.en.match(/[a-z0-9]/i) || ['#'])[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const gv = { cat: '', filter: '', letter: '', items: [], shown: 0, lastLetter: '', marks: [] };
let guideObs = null;
onLeave(() => guideObs?.disconnect());

export function renderCategory(id) {
  const all = id === 'all';
  const c = catById[id];
  if (!all && !c) return renderGuide();
  const terms = sortedTerms(id);
  const letters = [...new Set(terms.map(letterOf))];
  const isMarch = id === 'medical' && MARCH_STEPS.length > 0;
  if (gv.cat !== id) Object.assign(gv, { cat: id, filter: '', letter: '' });
  app.innerHTML = `
    <header class="hero tinted ${all ? '' : toneOf(id)}" style="gap:14px">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
        <span class="crumb">Довідник · ${nTerms(terms.length)}</span>
      </div>
      <h1>${all ? 'Усі терміни' : esc(c.title)}</h1>
      ${all ? '' : `<p class="lead">${esc(c.desc)}</p>`}
    </header>
    <div class="gbar ${all ? '' : toneOf(id)}" id="gbar">
      <label class="searchbox small">
        ${I.search}
        <input id="gq" type="search" value="${esc(gv.filter)}" placeholder="Фільтр у ${all ? 'довіднику' : 'розділі'}" aria-label="Фільтр" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">
      </label>
      ${letters.length > 1 ? `<div class="chips scroll letters">${letters.map(l => `<button class="chip ${gv.letter === l ? 'active' : ''}" data-letter="${l}">${l}</button>`).join('')}</div>` : ''}
    </div>
    <section class="section">
      ${isMarch ? `
        <div class="march-box" id="march">
          <div class="section-head"><h2>Алгоритм MARCH</h2></div>
          ${MARCH_STEPS.map(s => `
            <div class="step"><span class="letter c-${s.letter}">${s.letter}</span>
              <span class="body"><span class="en">${esc(s.en)}</span><span class="ua">${esc(s.ua)}</span></span></div>`).join('')}
        </div>` : ''}
      <span class="meta" id="gcount"></span>
      <div class="list" id="glist"></div>
      <div id="gmore" class="gmore"></div>
      <a class="btn train-cta" href="#/train?cat=${all ? 'all' : id}">${I.target}Тренувати ${all ? 'всі терміни' : 'цей розділ'}</a>
    </section>`;
  const input = document.getElementById('gq');
  input.addEventListener('input', () => { gv.filter = input.value; applyFilter(); toListTop(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  applyFilter();
  app.style.setProperty('--gbar', document.getElementById('gbar').offsetHeight + 'px');
}

/** Якщо список прокручено нижче початку — повертає до початку, щоб новий результат було видно. */
function toListTop() {
  const list = document.getElementById('glist'), bar = document.getElementById('gbar');
  if (!list || !bar) return;
  const y = list.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - parseFloat(getComputedStyle(bar).top) - 8;
  if (window.scrollY > y) window.scrollTo(0, y);
}

function applyFilter() {
  const q = gv.filter.trim();
  const base = sortedTerms(gv.cat).filter(t => !gv.letter || letterOf(t) === gv.letter);
  const found = q ? smartSearch(q, base) : null;
  gv.items = found ? found.list.map(r => r.t) : base;
  gv.marks = found ? found.marks : [];
  gv.shown = 0; gv.lastLetter = '';
  document.getElementById('glist').innerHTML = gv.items.length ? '' : `<div class="empty"><b>Нічого не знайдено</b>Змініть фільтр або оберіть іншу літеру.</div>`;
  document.getElementById('gcount').innerHTML = found?.layout ? `Знайдено: ${gv.items.length} · показано для «<b>${esc(found.layout)}</b>» (інша розкладка)`
    : q || gv.letter ? `Знайдено: ${gv.items.length}` : 'Оберіть літеру або введіть слово';
  document.getElementById('march')?.toggleAttribute('hidden', !!(q || gv.letter));
  renderMore();
}

function renderMore() {
  const list = document.getElementById('glist'), more = document.getElementById('gmore');
  if (!list) return;
  const part = gv.items.slice(gv.shown, gv.shown + GUIDE_CHUNK);
  let html = '';
  for (const t of part) {
    const l = letterOf(t);
    if (l !== gv.lastLetter && !gv.filter.trim()) { html += `<div class="letter-h">${l}</div>`; gv.lastLetter = l; }
    html += `<a class="row" href="#/term/${t.id}"><span class="body"><span class="en">${highlight(t.en, gv.marks)}</span><span class="sub">${highlight(t.ua, gv.marks)}</span></span>${favs.has(t.id) ? `<span class="fav-dot">${I.star}</span>` : ''}${I.chev}</a>`;
  }
  list.insertAdjacentHTML('beforeend', html);
  gv.shown += part.length;
  guideObs?.disconnect();
  if (gv.shown < gv.items.length && 'IntersectionObserver' in window) {
    guideObs = new IntersectionObserver(es => { if (es[0].isIntersecting) renderMore(); }, { rootMargin: '600px' });
    guideObs.observe(more);
  } else if (gv.shown < gv.items.length) renderMore();
}

// Повернення «Назад» у довгий список: спершу домалювати рядки до місця, де користувач зупинився.
onRestoreScroll(y => {
  while (document.getElementById('glist') && gv.shown < gv.items.length && document.documentElement.scrollHeight < y + innerHeight) renderMore();
});

onClick('letter', v => {
  gv.letter = gv.letter === v ? '' : v;
  document.querySelectorAll('[data-letter]').forEach(b => b.classList.toggle('active', b.dataset.letter === gv.letter));
  applyFilter(); toListTop();
});
