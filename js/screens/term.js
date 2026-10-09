// Картка терміна.
import { esc } from '../core/util.js';
import { termById, catById, short, toneOf, srcTitle } from '../data.js';
import { favs, rememberTerm } from '../user.js';
import { I } from '../ui/icons.js';
import { app } from '../ui/dom.js';
import { learnBadge } from '../ui/learn.js';

export function renderTerm(id) {
  const t = termById[id];
  if (!t) {
    app.innerHTML = `
      <header class="hero"><div class="topbar"><button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button></div></header>
      <div class="empty"><b>Термін не знайдено</b>Можливо, його перейменували в базі. <a href="#/">На головну</a></div>`;
    return;
  }
  const cat = catById[t.cat];
  const related = (t.related || []).map(r => termById[r]).filter(Boolean);
  const isFav = favs.has(t.id);
  rememberTerm(t.id);
  app.innerHTML = `
    <header class="hero term-head tinted ${toneOf(t.cat)}">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
        <span class="grow" style="display:flex;justify-content:center"><a class="cat-badge" href="#/guide/${t.cat}">${esc(short(cat))}</a></span>
        <button class="icon-btn ${isFav ? 'on' : ''}" data-action="fav" data-id="${t.id}" aria-label="${isFav ? 'Прибрати зі збережених' : 'Зберегти'}" aria-pressed="${isFav}">${I.star}</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="abbr ${t.en.length > 36 ? 'xlong' : t.en.length > 16 ? 'long' : ''}">${esc(t.en)}</span>
        ${t.core ? `<span class="core-tag">${I.star}Ключовий термін</span>` : ''}
        ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
        ${t.full ? `<span class="full">${esc(t.full)}</span>` : ''}
      </div>
    </header>
    <section class="section" style="gap:14px">
      ${learnBadge(t.id)}
      <div class="card">
        <span class="label">Переклад</span>
        ${(t.senses || []).length > 1
          ? `<ol class="senses">${t.senses.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
          : `<span class="ua-big">${esc(t.ua)}</span>`}
        ${t.syn?.length ? `<p>Інше написання: <b>${t.syn.map(esc).join(', ')}</b></p>` : ''}
        ${t.note ? `<p>${esc(t.note)}</p>` : ''}
        ${srcTitle(t) ? `<span class="src-note">Джерело: ${esc(srcTitle(t))}</span>` : ''}
      </div>
      ${t.exEn ? `
      <div class="card">
        <span class="label">У контексті</span>
        <p class="ex-en">“${esc(t.exEn)}”</p>
        ${t.exUa ? `<p>«${esc(t.exUa)}»</p>` : ''}
      </div>` : ''}
      ${related.length ? `
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="label">Пов’язані терміни</span>
        <div class="rel">${related.map(r => `<a href="#/term/${r.id}">${esc(r.en)}</a>`).join('')}</div>
      </div>` : ''}
      <a class="btn" href="#/train?cat=${t.cat}">${I.target}Тренувати цей розділ</a>
    </section>`;
}
