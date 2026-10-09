import { app, reducedMotion } from './ui/dom.js';
import { closeOverlays } from './ui/sheet.js';

export const STOP = Symbol('stop');

const routes = new Map();
let fallback = () => 'home';
const leaveHooks = [], restoreHooks = [];

export function addRoute(names, handler) { for (const n of [].concat(names)) routes.set(n, handler); }
export function setFallback(handler) { fallback = handler; }
export const onLeave = fn => { leaveHooks.push(fn); };
export const onRestoreScroll = fn => { restoreHooks.push(fn); };

if (history.state?.d == null) history.replaceState({ d: 0 }, '');
let navDepth = history.state.d, navDir = 'forward', restoreY = null;
const scrollAt = {};
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('hashchange', () => {
  scrollAt[navDepth] = window.scrollY;
  const from = navDepth;
  if (history.state?.d == null) history.replaceState({ d: navDepth + 1 }, '');
  navDepth = history.state.d;
  restoreY = navDepth < from ? scrollAt[navDepth] ?? null : null;
  navDir = navDepth < from ? 'back' : 'forward';
});

export function goBack() {
  if (navDepth > 0) history.back(); else location.hash = '#/';
}

let enterTimer = 0;

export function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');
  leaveHooks.forEach(f => f());
  closeOverlays();
  document.body.classList.remove('dark', 'kb');
  if (app.style.transform) {
    app.classList.add('swiping'); app.classList.remove('swipe-out');
    app.style.transform = app.style.opacity = '';
    requestAnimationFrame(() => app.classList.remove('swiping'));
  }

  const tab = (routes.get(parts[0] ?? '') || fallback)(parts, params);
  if (tab === STOP) return;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));

  const y = restoreY; restoreY = null;
  if (y) {
    restoreHooks.forEach(f => f(y));
    window.scrollTo(0, y);
    app.classList.remove('enter');
    return;
  }
  window.scrollTo(0, 0);
  app.classList.remove('enter');
  if (document.getElementById('splash')) return;
  void app.offsetWidth; app.classList.add('enter');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => app.classList.remove('enter'), 700);
}

const TABS = ['', '#', '#/', '#/guide', '#/train', '#/me'];
const hashOf = u => { const i = u.indexOf('#'); return i < 0 ? '' : u.slice(i); };

export function startRouter() {
  window.addEventListener('hashchange', e => {
    if (!document.startViewTransition || reducedMotion() || app.style.transform || document.hidden) return route();
    const html = document.documentElement;
    html.dataset.nav = TABS.includes(hashOf(e.oldURL)) && TABS.includes(hashOf(e.newURL)) ? 'tab' : navDir;
    html.classList.add('vt');
    const vt = document.startViewTransition(route);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).finally(() => {
      clearTimeout(enterTimer);
      app.classList.remove('enter');
      html.classList.remove('vt');
    });
  });
  route();
}
