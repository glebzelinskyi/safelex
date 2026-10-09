// Заставка під час відкриття. Перший запуск — повна (зі смужкою завантаження), далі — лише плитка SL.
// Навмисно проста: поки застосунок вантажиться, вона нерухома, а коли головний екран уже
// намальований — розчиняється однією анімацією прозорості. Під нею в цей час нічого не рухається
// (див. launching у router.js і countUp у dom.js), тож на телефоні це плавно.
import { reducedMotion } from './dom.js';

const FIRST_HOLD = 800, RETURNING_HOLD = 150, FADE_MS = 340;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Ховає заставку. Promise виконується, коли її вже немає — тоді можна робити фонову роботу. */
export async function hideSplash() {
  const splash = document.getElementById('splash');
  try { localStorage.setItem('safelex:launched', '1'); } catch {}
  if (!splash) return;
  const returning = document.documentElement.classList.contains('returning');
  if (reducedMotion() && returning) { splash.remove(); return; }
  await nextFrame(); // головний екран уже намальований під заставкою
  splash.classList.add('ready');
  await wait(returning ? RETURNING_HOLD : FIRST_HOLD);
  splash.classList.add('hide');
  await wait(FADE_MS);
  splash.remove();
}
