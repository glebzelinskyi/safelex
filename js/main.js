// Точка входу SafeLex. Підключається в index.html після data/terms.js:
//   <script type="module" src="js/main.js"></script>
//
// Будова коду (кожен шар використовує лише шари вище за списком):
//   config.js              — налаштування (кількість питань, автори…)
//   core/                  — чисті функції: текст, дати, сховище, підготовка бази
//   data.js, user.js       — база термінів і особисті списки користувача
//   learn/, search/        — навчання (галочки, серія, звання, питання) і пошук
//   ui/                    — спільні елементи інтерфейсу
//   screens/               — екрани; кожен сам реєструє реакції на свої кнопки
//   router.js, main.js     — навігація й таблиця маршрутів
import { app } from './ui/dom.js';
import { onAction } from './ui/events.js';
import { initInstall, isIOS, isStandalone } from './ui/install.js';
import { initSwipeBack } from './ui/gestures.js';
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

// ── Маршрути ───────────────────────────────────────────────────────────
// Кожен повертає вкладку нижнього меню, яку підсвітити.
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
  // Поки відкрита клавіатура, нижнє меню ховається (клас kb).
  document.addEventListener('focusin', e => { if (e.target.matches('input:not([type=checkbox])')) document.body.classList.add('kb'); });
  document.addEventListener('focusout', () => document.body.classList.remove('kb'));

  // Повторне натискання на активну вкладку — нагору, а на «Пошук» — ще й до рядка пошуку.
  document.querySelector('.tabbar').addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || a.getAttribute('href') !== (location.hash || '#/')) return;
    e.preventDefault();
    if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (a.dataset.tab === 'home') document.getElementById('q')?.focus();
  });

  warmSearch();
  startRouter();
  hideSplash();
  registerServiceWorker();
}

// Заставка — лише при першому запуску (boot.js ставить клас returning ще до малювання сторінки).
function hideSplash() {
  const splash = document.getElementById('splash');
  try { localStorage.setItem('safelex:launched', '1'); } catch {}
  if (document.documentElement.classList.contains('returning')) splash.remove();
  else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }, 700);
}

function showUpdateToast() {
  if (document.querySelector('.update-toast')) return;
  const t = document.createElement('button');
  t.className = 'update-toast';
  t.innerHTML = '<b>Є оновлення</b><span>Натисніть, щоб застосувати</span>';
  t.addEventListener('click', () => location.reload());
  document.body.appendChild(t);
}

// Робота без інтернету (sw.js). Новий sw.js не перезавантажує сторінку сам — лише показує плашку.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateToast(); });
  const register = () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  }).catch(() => {});
  // Модулі виконуються після розбору сторінки, тож load міг уже статися.
  document.readyState === 'complete' ? register() : window.addEventListener('load', register);
}

// У чужому iframe застосунок не запускається — лише посилання на оригінал.
if (window.top !== window.self) {
  document.body.innerHTML = `<a href="${location.href.replace(/"/g, '%22')}" target="_top" style="display:block;padding:40px 16px;text-align:center;color:#fff">Відкрити SafeLex на офіційному сайті</a>`;
} else if (app) start();
