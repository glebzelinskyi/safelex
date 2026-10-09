// Галочки вивчення терміна та пояснення, як рахується прогрес.
import { plural } from '../core/util.js';
import { dayKey } from '../core/dates.js';
import { MASTERED } from '../config.js';
import { srs, boxOf, statusOf } from '../learn/srs.js';
import { I } from './icons.js';

export const checksHtml = n => `<span class="checks">${Array.from({ length: MASTERED }, (_, i) => `<i class="${i < n ? 'on' : ''}">${i < n ? I.check : ''}</i>`).join('')}</span>`;

export const learnHelp = () => `
  <div class="how-rule">
    <b>Термін вивчено, коли ви правильно відповіли на нього в ${MASTERED} різні дні.</b>
    <span class="how-demo">${checksHtml(0)}<span>→</span>${checksHtml(1)}<span>→</span>${checksHtml(2)}<span>→</span>${checksHtml(3)}</span>
  </div>
  <ul class="how-list">
    <li><span class="how-ic ok">${I.check}</span><span>Правильна відповідь — <b>+1 галочка</b>, але не більше однієї на день.</span></li>
    <li><span class="how-ic bad">${I.x}</span><span>Помилка — <b>мінус одна галочка</b>.</span></li>
    <li><span class="how-ic">${I.redo}</span><span>Тренажер сам нагадає повторити: наступного дня, потім через 3 дні, потім через 10.</span></li>
  </ul>
  <p class="how-note"><b>Нові</b> — ще не траплялися вам. <b>Вчу</b> — є 0–2 галочки. <b>Вивчено</b> — усі ${MASTERED}.</p>`;

/** Статус вивчення на картці терміна з розгортним поясненням. */
export function learnBadge(id) {
  const st = statusOf(id), n = boxOf(id), left = MASTERED - n, today = srs[id]?.day === dayKey();
  const text = st === 'new' ? 'Новий термін — ще не тренували'
    : st === 'mastered' ? 'Вивчено'
    : `Ще ${left} ${plural(left, 'день', 'дні', 'днів')} правильних відповідей${today ? ' · сьогодні вже зараховано' : ''}`;
  return `
    <details class="learn ${st}">
      <summary>
        ${checksHtml(n)}
        <span class="lt">${text}</span><span class="q-mark">?</span>
      </summary>
      ${learnHelp()}
    </details>`;
}
