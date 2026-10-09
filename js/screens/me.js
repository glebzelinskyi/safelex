// «Моє»: звання, серія, прогрес вивчення, збережені терміни.
import { esc, plural, nDays } from '../core/util.js';
import { TERMS } from '../data.js';
import { favs } from '../user.js';
import { RANKS, rankOf, nextRank } from '../learn/ranks.js';
import { streak, bestStreak, doneToday } from '../learn/streak.js';
import { progressOf } from '../learn/srs.js';
import { resetProgress } from '../learn/reset.js';
import { I } from '../ui/icons.js';
import { app, countUp } from '../ui/dom.js';
import { onAction } from '../ui/events.js';
import { badge } from '../ui/badge.js';
import { rankHero } from '../ui/ranks.js';
import { learnHelp } from '../ui/learn.js';

const streakLv = d => d >= 100 ? 4 : d >= 10 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : 0;
const masteredLv = f => f >= .6 ? 4 : f >= .3 ? 3 : f >= .1 ? 2 : f > 0 ? 1 : 0;

function streakHint(days, best) {
  if (!days) return 'почніть сьогодні';
  if (!doneToday()) return 'виконайте завдання сьогодні, щоб не перервати';
  if (days >= best) return best > 1 ? 'це ваш рекорд' : 'перший день';
  return `до рекорду ще ${nDays(best - days + 1)}`;
}

// Збережені показуються частинами: тисячі рядків одразу робили сторінку завдовжки в сотні тисяч пікселів,
// і на слабких телефонах перехід на «Моє» міг «застрягати».
const SAVED_CHUNK = 50;
let savedShown = 0;
function savedRows(saved, from) {
  savedShown = Math.min(saved.length, from + SAVED_CHUNK);
  return saved.slice(from, savedShown).map(t => `
    <a class="row" href="#/term/${t.id}">
      <span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>${I.chev}
    </a>`).join('');
}
const moreBtn = total => savedShown < total
  ? `<button class="link-btn" data-action="saved-more">Показати ще · ${total - savedShown}</button>` : '';

export function renderMe() {
  const days = streak(), best = bestStreak(), p = progressOf(TERMS), n = TERMS.length || 1;
  const saved = TERMS.filter(t => favs.has(t.id));
  const rank = rankOf(best);
  app.innerHTML = `
    <header class="hero">
      ${rankHero(rank, best, days)}
      <div class="me-stats">
        <span class="lv${streakLv(days)}"><b class="fl">${I.flame}<em data-count="${days}">${days}</em></b>${plural(days, 'день', 'дні', 'днів')} поспіль
          <small class="ms-hint">${streakHint(days, best)}</small></span>
        <span class="lv${streakLv(best)}"><b><em data-count="${best}">${best}</em></b>рекорд серії
          <small class="ms-hint">${!best ? 'ще попереду' : days >= best ? 'це ваш рекорд — тримайте!' : `поточна серія — ${nDays(days)}`}</small></span>
        <span class="lv${masteredLv(p.mastered / n)}"><b><em data-count="${p.mastered}">${p.mastered}</em></b>вивчено
          <small class="ms-hint">${Math.round(p.mastered / n * 100)}% бази · вчу ${p.learning}</small>
          <i class="ms-bar"><i style="width:${p.mastered / n * 100}%"></i></i></span>
      </div>
    </header>
    <section class="section" style="gap:14px">
      <a class="stats-link" href="#/stats">
        <span class="sl-ic">${I.chart}</span>
        <span class="body"><b>Статистика</b><span>Активність, точність, складні терміни</span></span>${I.chev}
      </a>
      <div class="card">
        <span class="label">Прогрес вивчення</span>
        <div class="stack"><span class="s-mastered" style="width:${p.mastered / n * 100}%"></span><span class="s-learning" style="width:${p.learning / n * 100}%"></span></div>
        <div class="legend">
          <span><i class="s-mastered"></i>Вивчено ${p.mastered}</span>
          <span><i class="s-learning"></i>Вчу ${p.learning}</span>
          <span><i class="s-new"></i>Нові ${p.new}</span>
        </div>
        <details class="how">
          <summary>Як рахують прогрес?</summary>
          ${learnHelp()}
        </details>
      </div>
      <div class="section-head"><h2>Звання</h2><span class="meta">${RANKS.filter(r => best >= r.days).length} з ${RANKS.length} · торкніться</span></div>
      <div class="ranks">${RANKS.map((r, i) => {
        const got = best >= r.days, cur = r === rank, nx = r === nextRank(best);
        return `<button class="rank ${cur ? 'cur' : ''} ${nx ? 'nx' : ''} ${got ? 'got' : ''}" style="--i:${i}" data-rank="${i}" aria-label="${esc(r.title)}">
          ${got && !cur ? `<i class="rk-ok">${I.check}</i>` : ''}${badge(r, got, false, cur)}
          <span class="rk-t">${esc(r.title)}</span>
          <span class="rk-d">${cur ? 'ви тут' : nx ? `ще ${nDays(r.days - best)}` : r.days ? nDays(r.days) : 'старт'}</span></button>`;
      }).join('')}</div>
      <div class="section-head"><h2>Збережені</h2>${saved.length >= 2 ? `<a href="#/train?cat=fav">Тренувати</a>` : ''}</div>
      ${saved.length ? `<div class="list" id="savedList">${savedRows(saved, 0)}</div>${moreBtn(saved.length)}`
      : `<div class="empty"><b>Поки що порожньо</b>Натисніть ☆ на картці терміна, щоб зберегти його сюди і вчити окремо.</div>`}
      <button class="link-btn" data-action="reset">Скинути прогрес навчання</button>
    </section>`;
  countUp(app);
}

onAction('saved-more', el => {
  const saved = TERMS.filter(t => favs.has(t.id));
  document.getElementById('savedList')?.insertAdjacentHTML('beforeend', savedRows(saved, savedShown));
  el.outerHTML = moreBtn(saved.length);
});

onAction('reset', () => {
  if (confirm('Скинути весь прогрес навчання, серію днів і рекорди? Збережені терміни залишаться.')) {
    resetProgress(); renderMe();
  }
});
