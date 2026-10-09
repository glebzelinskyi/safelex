// Заставка під час відкриття. Перший запуск — повна (~1 с, поки «вантажиться база»),
// далі — лише плитка SL на мить. В обох випадках плитка наприкінці перелітає
// в логотип у шапці головного екрана, а сам застосунок уже намальований під нею.
import { app, reducedMotion } from './dom.js';

const FIRST_MS = 1250, RETURNING_MS = 380, FLY_MS = 560;

export function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const returning = document.documentElement.classList.contains('returning');
  try { localStorage.setItem('safelex:launched', '1'); } catch {}
  if (reducedMotion()) {
    if (returning) splash.remove();
    else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 300); }, 700);
    return;
  }
  setTimeout(() => leave(splash), returning ? RETURNING_MS : FIRST_MS);
}

function leave(splash) {
  const tile = splash.querySelector('.logo-xl');
  // Шапка не повинна «під'їжджати» анімацією появи — інакше плитка прилетить не туди.
  app.querySelector('.hero')?.getAnimations?.({ subtree: true }).forEach(a => a.finish());
  const target = app.querySelector('.brand .logo');
  splash.classList.add('leaving');
  if (!tile?.animate) { setTimeout(() => splash.remove(), 350); return; }

  if (target && window.scrollY < 10) {
    const a = tile.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    target.style.visibility = 'hidden';
    tile.getAnimations().forEach(an => an.finish());
    const fly = tile.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width})` }],
      { duration: FLY_MS, easing: 'cubic-bezier(.55, 0, .15, 1)', fill: 'forwards' });
    fly.finished.catch(() => {}).finally(() => { target.style.visibility = ''; splash.remove(); });
  } else {
    // Застосунок відкрито не на головній (ярлик «Тренажер», посилання) — плитка просто тане.
    tile.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.86)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).finally(() => splash.remove());
  }
}
