// Запуск режиму тренажера за адресою #/train/<режим>?cat=<розділ> і клавіатура на комп'ютері.
import { catById } from '../../data.js';
import { onAction } from '../../ui/events.js';
import { route } from '../../router.js';
import { currentTrainCat } from './hub.js';
import { startQuiz } from './quiz.js';
import { startCards } from './cards.js';
import { startMatch } from './match.js';
import { startSprint } from './sprint.js';

export { renderTrainHub } from './hub.js';

export function runMode(mode, cat) {
  cat = cat || currentTrainCat();
  if (!['all', 'core', 'fav'].includes(cat) && !catById[cat]) cat = 'all';
  if (mode === 'daily') return startQuiz('daily', 'all');
  if (mode === 'quiz' || mode === 'mistakes') return startQuiz(mode, cat);
  if (mode === 'cards') return startCards(cat);
  if (mode === 'match') return startMatch(cat);
  if (mode === 'sprint') return startSprint(cat);
  location.hash = '#/train';
}

// «Ще раз» / «Нова колода» — почати поточний режим заново.
onAction('restart', () => route());

// 1–4 — варіант відповіді, Enter — далі, ← → — «Ні/Так» у спринті й «Ще вчу/Знаю» в картках, пробіл — перевернути картку.
document.addEventListener('keydown', e => {
  if (!location.hash.startsWith('#/train/') || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const btn = /^[1-4]$/.test(e.key) ? document.querySelector(`.opt:nth-child(${e.key}):not(:disabled)`)
    : e.key === 'Enter' ? document.querySelector('[data-action="next"],[data-action="sprint-go"]')
    : e.key === 'ArrowRight' ? document.querySelector('[data-sprint="1"],[data-action="card-yes"]')
    : e.key === 'ArrowLeft' ? document.querySelector('[data-sprint="0"],[data-action="card-no"]')
    : e.key === ' ' ? document.querySelector('.flash') : null;
  if (btn) { e.preventDefault(); btn.click(); }
});
