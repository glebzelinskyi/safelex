import { esc } from '../core/util.js';
import { AUTHORS } from '../config.js';
import { I } from './icons.js';

export const authorsList = () => AUTHORS.map(a => `<span class="author"><b>${esc(a.name)}</b>${a.role ? `<span>${esc(a.role)}</span>` : ''}</span>`).join('');

export const devCard = () => `
  <a class="dev-card" href="#/about">
    <span class="dev-top">
      <img class="dev-crest" src="icons/ldubzhd-logo-white.png" alt="Герб ЛДУ БЖД">
      <span class="body">
        <span class="k">Розробка</span>
        <span class="s">Львівський державний університет безпеки життєдіяльності</span>
      </span>${I.chev}
    </span>
    <span class="authors">${authorsList()}</span>
  </a>`;
