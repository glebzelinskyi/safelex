// Спільне для режимів тренажера: верхня панель, порожній стан, результати, таймер.
import { esc, plural } from '../../core/util.js';
import { I } from '../../ui/icons.js';
import { onLeave } from '../../router.js';

/** Чи відкритий зараз режим m (щоб відкладені дії не спрацювали на іншому екрані). */
export const inTrainMode = m => location.hash.startsWith('#/train/' + m);

// Один таймер на весь тренажер (пари, спринт); зупиняється при переході на інший екран.
let ticker = null;
export const startTicker = (fn, ms = 1000) => { stopTicker(); ticker = setInterval(fn, ms); };
export const stopTicker = () => { clearInterval(ticker); ticker = null; };
export const tickerRunning = () => ticker !== null;
onLeave(stopTicker);

export const trainBar = (title, pos, total, counter, exit = '#/train') => `
  <div class="topbar">
    <a class="icon-btn" href="${exit}" aria-label="Закрити">${I.close}</a>
    <div class="progress"><div style="width:${total ? Math.min(pos / total, 1) * 100 : 0}%"></div></div>
    <span class="counter">${counter ?? `${pos}/${total}`}</span>
  </div>
  <span class="mode-title">${title}</span>`;

export const emptyMode = (title, head, text) => `<div class="trainer">${trainBar(title, 0, 0, '')}
  <div class="empty-box"><span class="eb-ic">${I.check}</span><b>${head}</b><span>${text}</span></div>
  <a class="btn ghost" href="#/train">До режимів</a></div>`;

export const missList = list => list.length ? `
  <div class="miss">
    <span class="label">Варто повторити</span>
    ${list.map(t => `<a href="#/term/${t.id}"><b class="mono">${esc(t.en)}</b><span>${esc(t.ua)}</span></a>`).join('')}
  </div>` : '';

export const gainLine = (gained, learned) => gained || learned
  ? `<span class="res-gain"><i>${I.check}</i>+${gained} ${plural(gained, 'галочка', 'галочки', 'галочок')}${learned ? ` · ${learned} ${plural(learned, 'термін', 'терміни', 'термінів')} вивчено` : ''}</span>`
  : `<span class="res-gain muted">Нових галочок немає — сьогодні ці терміни вже зараховано</span>`;
