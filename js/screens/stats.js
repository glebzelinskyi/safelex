// Статистика: відповіді й точність, активність за 14 днів, календар практики,
// терміни на повторення, прогрес за розділами, найскладніші терміни, рекорди.
import { esc, plural, fmtTime, nAnswers } from '../core/util.js';
import { dayKey, keyToDate, dayLabel, ymd } from '../core/dates.js';
import { store } from '../core/store.js';
import { TERMS, CATEGORIES, termById, byCat, short } from '../data.js';
import { srs, boxOf, progressOf } from '../learn/srs.js';
import { actLog } from '../learn/activity.js';
import { doneDays, bestStreak } from '../learn/streak.js';
import { I } from '../ui/icons.js';
import { app } from '../ui/dom.js';
import { onClick, onAction } from '../ui/events.js';

const STATS_DAYS = 14;
const MONTH_NAMES = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const pct = (r, a) => a ? Math.round(r / a * 100) : 0;

let hmOffset = 0; // скільки місяців тому показує календар
let hmSel = '';   // вибраний у календарі день

function dayText(k) {
  const d = actLog[k];
  const when = k === dayKey() ? 'Сьогодні' : dayLabel(k);
  if (!d || !d.a) return `<b>${esc(when)}</b> · ${doneDays.has(k) ? 'завдання дня виконано' : 'без практики'}`;
  return `<b>${esc(when)}</b> · ${nAnswers(d.a)} · ${pct(d.r, d.a)}% правильних${doneDays.has(k) ? ' · завдання дня ✓' : ''}`;
}

const heatLevel = k => { const a = actLog[k]?.a || 0; return a >= 50 ? 4 : a >= 25 ? 3 : a >= 10 ? 2 : a > 0 || doneDays.has(k) ? 1 : 0; };
const practiced = k => !!(actLog[k]?.a) || doneDays.has(k);

function heatmap() {
  const today = dayKey(), now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - hmOffset, 1);
  const y = first.getFullYear(), m = first.getMonth();
  const len = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  let cells = '<i class="hm-cell blank"></i>'.repeat(lead), inMonth = 0;
  for (let d = 1; d <= len; d++) {
    const k = ymd(new Date(y, m, d));
    if (k > today) { cells += `<span class="hm-cell future">${d}</span>`; continue; }
    const a = actLog[k]?.a || 0, done = doneDays.has(k);
    if (practiced(k)) inMonth++;
    const tip = `${dayLabel(k)}: ${a ? nAnswers(a) : 'без відповідей'}${done ? ', завдання дня виконано' : ''}`;
    cells += `<button class="hm-cell l${heatLevel(k)} ${done ? 'done' : ''} ${k === today ? 'today' : ''} ${k === hmSel ? 'sel' : ''}" data-day="${k}" title="${esc(tip)}" aria-label="${esc(tip)}">${d}</button>`;
  }
  const elapsed = hmOffset ? len : now.getDate();
  return `<div class="hm-nav">
      <button class="icon-btn" data-action="hm-prev" aria-label="Попередній місяць" ${hmOffset >= 12 ? 'disabled' : ''}>${I.back}</button>
      <span class="hm-title"><b>${MONTH_NAMES[m]} ${y}</b><small>Днів практики: ${inMonth} з ${elapsed}</small></span>
      <button class="icon-btn" data-action="hm-next" aria-label="Наступний місяць" ${hmOffset <= 0 ? 'disabled' : ''}>${I.chev}</button>
    </div>
    <div class="hm-week" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span class="${i > 4 ? 'we' : ''}">${w}</span>`).join('')}</div>
    <div class="hm">${cells}</div>`;
}

function drawHeatmap(step) {
  hmOffset = Math.min(12, Math.max(0, hmOffset + step));
  const box = document.getElementById('hmBox');
  if (box) box.innerHTML = heatmap();
}

export function renderStats() {
  hmOffset = 0; hmSel = '';
  const keys = Object.keys(actLog);
  const total = keys.reduce((n, k) => n + actLog[k].a, 0), right = keys.reduce((n, k) => n + actLog[k].r, 0);
  const active = new Set([...keys.filter(k => actLog[k].a), ...doneDays]).size;
  const p = progressOf(TERMS);
  const today = dayKey();

  const last = Array.from({ length: STATS_DAYS }, (_, i) => dayKey(STATS_DAYS - 1 - i));
  const max = Math.max(1, ...last.map(k => actLog[k]?.a || 0));
  const bars = last.map(k => {
    const a = actLog[k]?.a || 0, d = keyToDate(k);
    return `<button class="ab ${k === today ? 'sel today' : ''} ${a ? '' : 'zero'}" data-day="${k}" aria-label="${esc(dayLabel(k))}: ${nAnswers(a)}">
      <span class="ab-col"><i style="height:${a ? Math.max(4, a / max * 100) : 0}%"></i></span>
      <span class="ab-d">${d.getDate()}</span>
    </button>`;
  }).join('');
  const week = last.reduce((n, k) => n + (actLog[k]?.a || 0), 0);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const endOf = n => { const d = new Date(now); d.setDate(d.getDate() + n + 1); return d.getTime(); };
  const dueIn = n => Object.keys(srs).filter(id => termById[id] && srs[id].due < endOf(n)).length;
  const dueToday = dueIn(0), dueTomorrow = dueIn(1) - dueToday, dueWeek = dueIn(6);

  const hard = Object.keys(srs).filter(id => termById[id] && srs[id].wrong > 0)
    .sort((a, b) => srs[b].wrong - srs[a].wrong || boxOf(a) - boxOf(b)).slice(0, 5).map(id => termById[id]);

  const matchBest = store.get('safelex:matchBest', 0), sprintBest = store.get('safelex:sprintBest', 0);
  const best = bestStreak();

  app.innerHTML = `
    <header class="hero" style="gap:14px">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
        <span class="crumb">Моє</span>
      </div>
      <h1>Статистика</h1>
      <div class="st-tiles">
        <span><b>${total}</b>${plural(total, 'відповідь', 'відповіді', 'відповідей')}</span>
        <span><b>${total ? `<em>${pct(right, total)}</em>%` : '—'}</b>точність</span>
        <span><b>${active}</b>${plural(active, 'день', 'дні', 'днів')} практики</span>
        <span><b>${p.mastered}</b>вивчено з ${TERMS.length}</span>
      </div>
    </header>
    <section class="section" style="gap:14px">
      <div class="card">
        <div class="st-head"><span class="label">Активність</span><span class="meta">${nAnswers(week)} за ${STATS_DAYS} днів</span></div>
        <div class="abars ${week || last.some(k => actLog[k]?.a) ? '' : 'none'}">${bars}</div>
        ${last.some(k => actLog[k]?.a) ? '' : '<span class="ab-empty">Графік з’явиться після перших відповідей у тренажері</span>'}
        <span class="st-read" aria-live="polite">${dayText(today)}</span>
      </div>
      <div class="card">
        <div class="st-head"><span class="label">Календар практики</span></div>
        <div id="hmBox">${heatmap()}</div>
        <div class="hm-legend">
          <span class="hm-key"><i class="hm-cell l1 done"></i>завдання дня</span>
          <span class="hm-key">Менше <i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i> Більше</span>
        </div>
        <span class="st-read" aria-live="polite">Торкніться дня, щоб побачити деталі</span>
      </div>
      <div class="card">
        <span class="label">Повторення</span>
        <div class="st-due">
          <a href="#/train/quiz?cat=all"><b>${dueToday}</b>сьогодні</a>
          <span><b>${Math.max(0, dueTomorrow)}</b>завтра</span>
          <span><b>${dueWeek}</b>за 7 днів</span>
        </div>
        <span class="meta" style="padding:0">Тренажер сам підкидає ці терміни першими.</span>
      </div>
      <div class="card">
        <span class="label">За розділами</span>
        ${CATEGORIES.map(c => {
          const list = byCat[c.id] || [], pc = progressOf(list), n = list.length || 1;
          return `<a class="st-cat" href="#/guide/${c.id}">
            <span class="st-cat-top"><span>${esc(short(c))}</span><span class="mono">${pc.mastered}/${list.length}</span></span>
            <span class="stack"><span class="s-mastered" style="width:${pc.mastered / n * 100}%"></span><span class="s-learning" style="width:${pc.learning / n * 100}%"></span></span>
          </a>`;
        }).join('')}
        <div class="legend">
          <span><i class="s-mastered"></i>Вивчено</span>
          <span><i class="s-learning"></i>Вчу</span>
          <span><i class="s-new"></i>Нові</span>
        </div>
      </div>
      <div class="section-head"><h2>Найскладніші</h2>${hard.length ? `<a href="#/train/mistakes?cat=all">Тренувати</a>` : ''}</div>
      ${hard.length ? `<div class="list">${hard.map(t => `
        <a class="row" href="#/term/${t.id}">
          <span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>
          <span class="st-wrong">${srs[t.id].wrong} ${plural(srs[t.id].wrong, 'помилка', 'помилки', 'помилок')}</span>
        </a>`).join('')}</div>`
      : `<div class="empty"><b>Помилок ще немає</b>Тут з’являться терміни, у яких ви помиляєтеся найчастіше.</div>`}
      <div class="section-head"><h2>Рекорди</h2></div>
      <div class="st-due st-rec">
        <span><b>${best}</b>${plural(best, 'день', 'дні', 'днів')} серії</span>
        <span><b>${sprintBest || '—'}</b>спринт</span>
        <span><b>${matchBest ? fmtTime(matchBest) : '—'}</b>пари</span>
      </div>
    </section>`;
}

onClick('day', (k, el) => {
  const card = el.closest('.card');
  if (!card) return;
  if (card.querySelector('#hmBox')) hmSel = k;
  const out = card.querySelector('.st-read');
  if (out) out.innerHTML = dayText(k);
  card.querySelectorAll('[data-day]').forEach(b => b.classList.toggle('sel', b.dataset.day === k));
});
onAction('hm-prev', () => drawHeatmap(1));
onAction('hm-next', () => drawHeatmap(-1));
