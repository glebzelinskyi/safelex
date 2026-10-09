// Заставка під час відкриття. Перший запуск — повна, далі — лише плитка SL на мить.
// Поки застосунок вантажиться (база термінів, перший екран), заставка нерухома:
// анімація в цей час ішла б ривками. Коли головний екран уже намальований, вмикаються
// світіння й смужка (.ready), а наприкінці плитка перелітає в логотип у шапці.
import { app, reducedMotion } from './dom.js';

const FIRST_HOLD = 950, RETURNING_HOLD = 220, FLY_MS = 560;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Ховає заставку. Promise виконується, коли її вже немає на екрані — тоді можна робити важку фонову роботу. */
export async function hideSplash() {
  const splash = document.getElementById('splash');
  try { localStorage.setItem('safelex:launched', '1'); } catch {}
  if (!splash) return;
  const returning = document.documentElement.classList.contains('returning');
  if (reducedMotion()) {
    if (!returning) { await wait(700); splash.classList.add('hide'); await wait(300); }
    splash.remove();
    return;
  }
  await nextFrame(); // головний екран уже на екрані, процесор вільний
  splash.classList.add('ready');
  await wait(returning ? RETURNING_HOLD : FIRST_HOLD);
  await leave(splash);
}

async function leave(splash) {
  const tile = splash.querySelector('.logo-xl');
  // Шапка не повинна «під'їжджати» анімацією появи — інакше плитка прилетить не туди.
  app.querySelector('.hero')?.getAnimations?.({ subtree: true }).forEach(a => a.finish());
  const target = app.querySelector('.brand .logo');
  splash.classList.add('leaving');
  if (!tile?.animate) { await wait(380); splash.remove(); return; }

  let anim;
  if (target && window.scrollY < 10) {
    const a = tile.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    target.style.visibility = 'hidden';
    anim = tile.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width})` }],
      { duration: FLY_MS, easing: 'cubic-bezier(.55, 0, .15, 1)', fill: 'forwards' });
    await anim.finished.catch(() => {});
    target.style.visibility = '';
  } else {
    // Застосунок відкрито не на головній (ярлик «Тренажер», посилання) — плитка просто тане.
    anim = tile.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.86)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
    await anim.finished.catch(() => {});
  }
  splash.remove();
}
