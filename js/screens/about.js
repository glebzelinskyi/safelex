import { esc, nTerms } from '../core/util.js';
import { VERSION } from '../config.js';
import { TERMS, CATEGORIES, CORE, SOURCES, MARCH_STEPS } from '../data.js';
import { I } from '../ui/icons.js';
import { app } from '../ui/dom.js';
import { authorsList } from '../ui/authors.js';

export function renderAbout() {
  app.innerHTML = `
    <header class="hero" style="gap:16px">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
        <span class="crumb">Про застосунок</span>
      </div>
      <div class="about-logos">
        <img class="emb" src="icons/emblem.png" alt="Герб ДСНС України">
        <span class="sep"></span>
        <img class="ld" src="icons/ldubzhd-logo-white.png" alt="Львівський державний університет безпеки життєдіяльності">
      </div>
      <div class="about-title">
        <div class="brand-name" style="font-size:26px">Safe<span>Lex</span></div>
        <p class="lead" style="margin:0">Англо-український словник пожежно-рятувальної термінології</p>
      </div>
    </header>
    <section class="section" style="gap:14px">
      <div class="card">
        <span class="label">Про проєкт</span>
        <p>Автономний цифровий словник для фахівців ДСНС України та курсантів: швидкий пошук термінів, довідник за напрямами роботи й тренажер для підготовки до заліків з професійної англійської мови. Працює без інтернету.</p>
      </div>
      <div class="card">
        <span class="label">Що всередині</span>
        <ul class="feat">
          <li>${nTerms(TERMS.length)} у ${CATEGORIES.length} розділах</li>
          <li>Живий пошук англійською та українською</li>
          ${CORE.length ? `<li>${nTerms(CORE.length)} позначено як ключові — тренажер дає їх першими</li>` : ''}
          ${MARCH_STEPS.length ? '<li>Алгоритм MARCH</li>' : ''}
          <li>Завдання дня, серія днів і звання</li>
          <li>Тренажер: тест, картки, пари, спринт, робота над помилками</li>
        </ul>
      </div>
      ${Object.keys(SOURCES).length ? `
      <div class="card">
        <span class="label">Джерела</span>
        ${Object.values(SOURCES).map(s => `<p><b>${esc(s.title)}</b>${s.note ? ` — ${esc(s.note)}` : ''}</p>`).join('')}
      </div>` : ''}
      <div class="card">
        <span class="label">Розробники</span>
        <span class="authors">${authorsList()}</span>
      </div>
      <div class="card about-uni">
        <img src="icons/ldubzhd-logo-white.png" alt="Львівський державний університет безпеки життєдіяльності">
        <span class="about-dep">Кафедра іноземних мов та перекладознавства</span>
      </div>
      <p class="meta" style="text-align:center">Версія ${VERSION} · ${new Date().getFullYear()}</p>
      <p class="meta" style="text-align:center">© 2026 Зелінський Г. С., Пальчевська О. С. Усі права захищено.<br>Копіювання, зміна й поширення застосунку без письмового дозволу авторів заборонені.</p>
    </section>`;
}
