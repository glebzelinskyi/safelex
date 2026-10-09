import { esc, fmtTime, nTerms } from '../../core/util.js';
import { store } from '../../core/store.js';
import { QUIZ_LEN, CARDS_LEN, MATCH_ROUNDS, SPRINT_SEC } from '../../config.js';
import { CATEGORIES, CORE, catById, short } from '../../data.js';
import { favs } from '../../user.js';
import { poolFor, mistakesIn } from '../../learn/srs.js';
import { I } from '../../ui/icons.js';
import { app } from '../../ui/dom.js';
import { onClick } from '../../ui/events.js';

let trainCat = store.get('safelex:trainCat', 'all');
export const currentTrainCat = () => trainCat;

const usable = cat => cat === 'all' || (cat === 'fav' ? favs.size >= 2 : cat === 'core' ? CORE.length > 0 : !!catById[cat]);

const MODES = [
  { id: 'quiz', title: 'Тест', desc: `${QUIZ_LEN} питань. Складність росте разом із вашими знаннями`, icon: I.target },
  { id: 'cards', title: 'Картки', desc: 'Згадайте переклад, переверніть картку й чесно оцініть себе', icon: I.cards, meta: () => `${CARDS_LEN} карток` },
  { id: 'match', title: 'Пари', desc: 'З’єднайте терміни з перекладами якнайшвидше', icon: I.link, meta: () => { const b = store.get('safelex:matchBest', 0); return b ? `рекорд ${fmtTime(b)}` : `${MATCH_ROUNDS} раунди`; } },
  { id: 'sprint', title: 'Спринт', desc: `${SPRINT_SEC} секунд: переклад правильний чи ні?`, icon: I.bolt, meta: () => { const b = store.get('safelex:sprintBest', 0); return b ? `рекорд ${b}` : `${SPRINT_SEC} с`; } },
  { id: 'mistakes', title: 'Помилки', desc: 'Терміни, у яких ви помилялися', icon: I.redo, meta: cat => nTerms(mistakesIn(cat).length) }
];

export function renderTrainHub(cat) {
  if (cat) trainCat = cat;
  if (!usable(trainCat)) trainCat = 'all';
  store.set('safelex:trainCat', trainCat);
  const pool = poolFor(trainCat), mist = mistakesIn(trainCat).length;
  const cats = [['all', 'Усі розділи'], ...(CORE.length ? [['core', `Ключові · ${CORE.length}`]] : []), ...(favs.size >= 2 ? [['fav', `Збережені · ${favs.size}`]] : []), ...CATEGORIES.map(c => [c.id, short(c)])];
  const tile = (m, big) => {
    const off = m.id === 'mistakes' && !mist;
    return `<a class="mode m-${m.id} ${big ? 'big' : ''} ${off ? 'off' : ''}" ${off ? 'aria-disabled="true"' : `href="#/train/${m.id}?cat=${trainCat}"`}>
      <span class="mode-ic">${m.icon}</span>
      <span class="mode-body"><b>${m.title}</b><span>${off ? 'Поки що помилок немає' : m.desc}</span></span>
      ${off || !m.meta ? '' : `<span class="mode-meta">${m.meta(trainCat)}</span>`}
    </a>`;
  };
  app.innerHTML = `
    <header class="hero" style="gap:14px">
      <h1>Тренажер</h1>
      <p class="lead">Оберіть розділ і режим · ${nTerms(pool.length)}</p>
      <div class="chips scroll">${cats.map(([id, l]) => `<button class="chip ${trainCat === id ? 'active' : ''}" data-tcat="${id}">${esc(l)}</button>`).join('')}</div>
    </header>
    <section class="section">
      ${tile(MODES[0], true)}
      <div class="modes">${MODES.slice(1).map(m => tile(m)).join('')}</div>
    </section>`;
}

onClick('tcat', v => renderTrainHub(v));
