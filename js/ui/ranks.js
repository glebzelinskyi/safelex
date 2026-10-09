// Звання в інтерфейсі: шторка з описом звання, блок «Ваше звання», святковий екран.
import { esc, nDays } from '../core/util.js';
import { RANKS, RANK_INS, rankGroup, rankOf, nextRank } from '../learn/ranks.js';
import { streak, bestStreak, doneToday, rankDate } from '../learn/streak.js';
import { I } from './icons.js';
import { vibrate } from './dom.js';
import { onClick, onAction } from './events.js';
import { openSheet } from './sheet.js';
import { badge } from './badge.js';

function rankSheetHtml(i) {
  const r = RANKS[i], best = bestStreak(), days = streak(), cur = rankOf(best);
  const got = best >= r.days, isCur = r === cur, isNext = r === nextRank(best);
  const status = isCur ? '<span class="rs-chip cur">Ваше звання</span>' : got ? `<span class="rs-chip got">${I.check}Отримано</span>`
    : isNext ? '<span class="rs-chip nx">Наступне</span>' : '<span class="rs-chip">Ще попереду</span>';
  const prevDays = RANKS[i - 1]?.days ?? 0, left = Math.max(0, r.days - days);
  const pct = got ? 100 : Math.round(Math.min(1, Math.max(0, (days - prevDays) / (r.days - prevDays || 1))) * 100);
  const when = got ? '' : rankDate(r.days);
  return `
    <div class="rs-top">
      <button class="icon-btn rs-nav" data-rank="${i - 1}" ${i ? '' : 'disabled'} aria-label="Попереднє звання">${I.back}</button>
      <span class="rs-pg ${got ? 'got' : ''}"><i class="rs-glow"></i>${badge(r, got, true, got)}</span>
      <button class="icon-btn rs-nav" data-rank="${i + 1}" ${i < RANKS.length - 1 ? '' : 'disabled'} aria-label="Наступне звання">${I.next}</button>
    </div>
    ${status}
    <span class="rs-group">${rankGroup(i)}</span>
    <h2 class="rs-title">${esc(r.title)}</h2>
    <p class="rs-ins">${RANK_INS[i]}</p>
    ${got ? `<p class="rs-text">${esc(r.text)}</p>` : `
      <div class="rs-prog">
        <div class="rs-prog-top"><span>Серія зараз: <b>${nDays(days)}</b></span><span>потрібно ${r.days}</span></div>
        <div class="rs-bar"><i style="width:${pct}%"></i></div>
        <span class="rs-left">Ще <b>${nDays(left)}</b> поспіль${when ? ` · це <b>${when}</b>, якщо не пропускати` : ''}</span>
      </div>`}
    ${doneToday() ? `<span class="rs-done">${I.check}Завдання дня сьогодні виконано — наступне завтра</span>`
      : `<a class="btn" href="#/train/daily">${I.flame}Виконати завдання дня</a>`}
    <span class="rs-dots">${RANKS.map((x, k) => `<i class="${k === i ? 'on' : ''} ${best >= x.days ? 'got' : ''}"></i>`).join('')}</span>`;
}

/** Відкриває шторку звання i або гортає вже відкриту. */
export function openRank(i) {
  i = Math.max(0, Math.min(RANKS.length - 1, i));
  const open = document.querySelector('.sheet.rank-sheet .sheet-body');
  if (open) {
    open.innerHTML = rankSheetHtml(i); open.classList.remove('swap'); void open.offsetWidth; open.classList.add('swap');
    vibrate(8); return;
  }
  openSheet(rankSheetHtml(i), 'rank-sheet');
}
onClick('rank', (v, el) => { if (!el.disabled) openRank(+v); });

/** Кнопка «Ваше звання» вгорі екрана «Моє». */
export function rankHero(rank, best, days) {
  const i = RANKS.indexOf(rank), next = nextRank(best);
  const from = rank.days, pct = next ? Math.round(Math.min(1, Math.max(0, (days - from) / (next.days - from))) * 100) : 100;
  return `
    <button class="rank-hero" data-rank="${i}" aria-label="Ваше звання: ${esc(rank.title)}">
      <span class="rh-pg">${badge(rank, true, true, true)}</span>
      <span class="rh-body">
        <span class="k">Ваше звання · ${i + 1} з ${RANKS.length}</span>
        <b>${esc(rank.title)}</b>
        ${next ? `
          <span class="rh-bar"><i style="width:${pct}%"></i></span>
          <span class="rh-next">до звання «${esc(next.title)}» — ще <b>${nDays(Math.max(0, next.days - days))}</b> поспіль</span>`
        : '<span class="rh-next">Найвище звання служби цивільного захисту</span>'}
      </span>
      ${next ? `<span class="rh-nx">${badge(next, true)}<small>далі</small></span>` : ''}
    </button>`;
}

/** Святковий екран з конфеті, коли присвоєно нове звання. */
export function celebrate(r) {
  const colors = ['#FFC53D', '#D4570F', '#F28A45', '#7FD49B', '#9DB4D8', '#fff'];
  const bits = Array.from({ length: 48 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(.7 + Math.random() * 0.7).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s;--r:${Math.floor(Math.random() * 360)}deg"></i>`).join('');
  const prev = RANKS[RANKS.indexOf(r) - 1], next = nextRank(r.days);
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `
    <div class="confetti">${bits}</div>
    <div class="cel-card" role="dialog" aria-label="Нове звання">
      <div class="cel-stage">
        <i class="cel-rays"></i>
        ${prev ? `<span class="cel-old">${badge(prev, true, true)}</span>` : ''}
        <span class="cel-new">${badge(r, true, true, true)}</span>
      </div>
      <span class="cel-k">Присвоєно звання</span>
      <h2>${esc(r.title)}</h2>
      <span class="cel-days">${I.flame}${nDays(r.days)} поспіль</span>
      <p>${esc(r.text)}</p>
      ${next ? `<span class="cel-next">Наступне — «${esc(next.title)}» за серію ${nDays(next.days)}</span>` : ''}
      <button class="btn" data-action="cel-close">Служу Україні!</button>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  const onKey = e => { if (e.key === 'Escape') el.remove(); if (!el.isConnected) document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
  el.querySelector('.btn').focus({ preventScroll: true });
  vibrate([30, 60, 30, 60, 120]);
}
onAction('cel-close', () => document.querySelector('.celebrate')?.remove());
