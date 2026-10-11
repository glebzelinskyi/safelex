import * as storage from './core/store.js';
import { dayKey } from './core/dates.js';
import { srs } from './learn/srs.js';
import { app } from './ui/dom.js';
import { onAction } from './ui/events.js';
import { initInstall, isIOS, isStandalone } from './ui/install.js';
import { initSwipeBack } from './ui/gestures.js';
import { hideSplash } from './ui/splash.js';
import './ui/fav.js';
import { warmSearch } from './search/index.js';
import { addRoute, setFallback, startRouter, route, goBack, STOP } from './router.js';
import { renderHome } from './screens/home.js';
import { renderGuide, renderCategory } from './screens/guide.js';
import { renderTerm } from './screens/term.js';
import { renderAbout } from './screens/about.js';
import { renderMe } from './screens/me.js';
import { renderStats } from './screens/stats.js';
import { seedDemo } from './screens/demo.js';
import { renderTrainHub, runMode } from './screens/train/index.js';

addRoute(['', 'search'], (parts, params) => {
  renderHome({ query: params.has('q') ? params.get('q') : null, focus: parts[0] === 'search' });
  return 'home';
});
addRoute('term', ([, id]) => { renderTerm(id); return null; });
addRoute('guide', ([, id]) => { id ? renderCategory(id) : renderGuide(); return 'guide'; });
addRoute('train', ([, mode], params) => {
  mode ||= params.get('mode');
  if (mode) { document.body.classList.add('dark'); runMode(mode, params.get('cat')); }
  else renderTrainHub(params.get('cat'));
  return 'train';
});
addRoute(['me', 'fav'], () => { renderMe(); return 'me'; });
addRoute('stats', () => { renderStats(); return 'me'; });
addRoute('about', () => { renderAbout(); return null; });
addRoute('demo', () => { seedDemo(); return STOP; });
setFallback(() => { renderHome(); return 'home'; });

function start() {
  onAction('back', goBack);
  initInstall(route);
  if (isIOS && isStandalone()) initSwipeBack(goBack);

  window.addEventListener('scroll', () => document.documentElement.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
  document.addEventListener('focusin', e => { if (e.target.matches('input:not([type=checkbox])')) document.body.classList.add('kb'); });
  document.addEventListener('focusout', () => document.body.classList.remove('kb'));

  document.querySelector('.tabbar').addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || a.getAttribute('href') !== (location.hash || '#/')) return;
    e.preventDefault();
    if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (a.dataset.tab === 'home') document.getElementById('q')?.focus();
  });

  storage.onSaveFail?.(showSaveToast);
  window.addEventListener('hashchange', keepProgress);
  window.addEventListener('appinstalled', () => { askedToKeep = false; keepProgress(); });
  document.addEventListener('visibilitychange', newDay);
  window.addEventListener('pageshow', newDay);
  startRouter();
  hideSplash().then(() => { warmSearch(); registerServiceWorker(); keepProgress(); });
}

let shownDay = dayKey();
function newDay() {
  if (document.visibilityState !== 'visible' || shownDay === dayKey()) return;
  shownDay = dayKey();
  if (!location.hash.startsWith('#/train/')) route();
}

let saveWarned = false;
function showSaveToast() {
  if (saveWarned) return;
  saveWarned = true;
  const t = document.createElement('button');
  t.className = 'update-toast save-toast';
  t.innerHTML = '<b>Прогрес не зберігається</b><span>Браузер не дає записати дані: вийдіть із приватного режиму або звільніть місце на пристрої. Торкніться, щоб закрити.</span>';
  t.addEventListener('click', () => { if (t.classList.contains('open')) t.remove(); else t.classList.add('open'); });
  document.body.appendChild(t);
  setTimeout(() => { if (!t.classList.contains('open')) t.remove(); }, 8000);
}

let askedToKeep = false;
async function keepProgress() {
  if (askedToKeep || !Object.keys(srs).length) return;
  askedToKeep = true;
  try { if (!await navigator.storage.persisted()) await navigator.storage.persist(); } catch {}
}

function showUpdateToast() {
  if (document.querySelector('.update-toast')) return;
  const t = document.createElement('button');
  t.className = 'update-toast';
  t.innerHTML = '<b>Є оновлення</b><span>Натисніть, щоб застосувати</span>';
  t.addEventListener('click', () => location.reload());
  document.body.appendChild(t);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateToast(); });
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'update') showUpdateToast(); });
  const register = () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg?.update().catch(() => {});
    });
  }).catch(() => {});
  document.readyState === 'complete' ? register() : window.addEventListener('load', register);
}

if (window.top !== window.self) {
  document.body.innerHTML = `<a href="${location.href.replace(/"/g, '%22')}" target="_top" style="display:block;padding:40px 16px;text-align:center;color:#fff">Відкрити SafeLex на офіційному сайті</a>`;
} else if (app) start();
