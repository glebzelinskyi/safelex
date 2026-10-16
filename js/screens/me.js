import { esc, plural, nDays } from '../core/util.js';
import { TERMS } from '../data.js';
import { favs } from '../user.js';
import { RANKS, rankOf, nextRank } from '../learn/ranks.js';
import { streak, bestStreak, restoreOffer } from '../learn/streak.js';
import { progressOf } from '../learn/srs.js';
import { resetProgress } from '../learn/reset.js';
import { I } from '../ui/icons.js';
import { app, reducedMotion } from '../ui/dom.js';
import { onAction } from '../ui/events.js';
import { badge } from '../ui/badge.js';
import { rankHero } from '../ui/ranks.js';
import { learnHelp } from '../ui/learn.js';
import { backupLink } from '../ui/backup.js';
import { streakBackCard, onStreakRestored } from '../ui/streak.js';

const SAVED_CHUNK = 50;
let savedShown = 0;
function savedRows(saved, from) {
  savedShown = Math.min(saved.length, from + SAVED_CHUNK);
  return saved.slice(from, savedShown).map(t => `
    <a class="row" href="#/term/${t.id}">
      <span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>${I.chev}
    </a>`).join('');
}
// Що довший рекорд, то живіший вогонь: від сірого контуру до золотого полум'я з іскрами.
const FIRE_TIERS = [1, 7, 30, 100, 365];
const fireTier = best => FIRE_TIERS.filter(d => best >= d).length;
const EMBERS = [0, 0, 0, 6, 10, 16];
const embers = tier => Array.from({ length: EMBERS[tier] }, (_, i) =>
  `<i style="--x:${(i * 37 + 11) % 100}%;--d:${((i * .53) % 3).toFixed(2)}s;--t:${(2.4 + (i % 4) * .5).toFixed(1)}s;--s:${3 + i % 3}px"></i>`).join('');

const moreBtn = total => savedShown < total
  ? `<button class="link-btn" data-action="saved-more">Показати ще · ${total - savedShown}</button>` : '';

export function renderMe() {
  const days = streak(), best = bestStreak(), p = progressOf(TERMS), n = TERMS.length || 1;
  const saved = TERMS.filter(t => favs.has(t.id));
  const rank = rankOf(best);
  const learnedPct = Math.round(p.mastered / n * 100), tier = fireTier(best);
  app.innerHTML = `
    <header class="hero me-top">
      <div class="me-streak ${best ? '' : 'zero'} ${days ? 'live' : best ? 'cold' : ''} ft${tier}">
        ${EMBERS[tier] && days ? `<span class="ms-embers" aria-hidden="true">${embers(tier)}</span>` : ''}
        <span class="ms-mark" aria-hidden="true">${I.flame}</span>
        <span class="ms-v"><b data-to="${best}">${best}</b><span class="ms-unit">${plural(best, 'день', 'дні', 'днів')}<small>рекорд серії</small></span></span>
        <span class="ms-now">${!best ? 'Почніть із завдання дня'
          : days >= best ? 'Серія триває — це ваш рекорд'
          : days ? `Поточна серія — ${nDays(days)}`
          : restoreOffer() ? 'Серія на паузі — її ще можна врятувати' : 'Серію перервано — почніть нову із завдання дня'}</span>
      </div>
      ${streakBackCard()}
      ${rankHero(rank, best, days)}
    </header>
    <section class="section" style="gap:14px">
      <div class="card me-prog">
        <span class="mp-head"><span class="label">Прогрес вивчення</span><span class="mp-pct ${p.mastered ? '' : 'none'}">${learnedPct}%</span></span>
        <span class="mp-big"><b>${p.mastered}</b> з ${TERMS.length} термінів вивчено</span>
        <div class="stack"><span class="fill"><span class="s-mastered" style="width:${p.mastered / n * 100}%"></span><span class="s-learning" style="width:${p.learning / n * 100}%"></span></span></div>
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
      <div class="me-tools">
        <a class="stats-link" href="#/stats">
          <span class="sl-ic">${I.chart}</span>
          <span class="body"><b>Статистика</b><span>Активність і точність</span></span>
        </a>${backupLink()}
      </div>
      <div class="section-head"><h2>Звання</h2><span class="meta">${RANKS.filter(r => best >= r.days).length} з ${RANKS.length} · торкніться</span></div>
      <div class="ranks">${RANKS.map((r, i) => {
        const got = best >= r.days, cur = r === rank, nx = r === nextRank(best);
        return `<button class="rank ${cur ? 'cur' : ''} ${nx ? 'nx' : ''} ${got ? 'got' : ''}" style="--i:${i}" data-rank="${i}" aria-label="${esc(r.title)}">
          ${got && !cur ? `<i class="rk-ok">${I.check}</i>` : ''}${badge(r, got, false, cur)}
          <span class="rk-t">${esc(r.title)}</span>
          <span class="rk-d">${cur ? 'ви тут' : nx ? `ще ${nDays(r.days - days)}` : r.days ? nDays(r.days) : 'старт'}</span></button>`;
      }).join('')}</div>
      <div class="section-head"><h2>Збережені</h2>${saved.length >= 2 ? `<a href="#/train?cat=fav">Тренувати</a>` : ''}</div>
      ${saved.length ? `<div class="list" id="savedList">${savedRows(saved, 0)}</div>${moreBtn(saved.length)}`
      : `<div class="empty-box eb-fav"><span class="eb-ic">${I.star}</span><b>Поки що порожньо</b><span>Натисніть зірочку на картці терміна, щоб зберегти його сюди і вчити окремо.</span></div>`}
      <button class="link-btn" data-action="reset">Скинути прогрес навчання</button>
    </section>`;
  countUp(app.querySelector('.ms-v b'));
}

// Рекорд «набігає» від нуля — один короткий момент при відкритті екрана.
function countUp(el) {
  const to = +el?.dataset.to;
  if (!to || to < 3 || reducedMotion()) return;
  const t0 = performance.now(), dur = Math.min(900, 400 + to * 4);
  const step = now => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = Math.round(to * e);
    if (k < 1) requestAnimationFrame(step);
    else el.classList.add('landed');
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

onStreakRestored(() => { if (document.querySelector('.me-streak')) renderMe(); });

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
