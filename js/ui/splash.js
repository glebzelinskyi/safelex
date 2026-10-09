import { reducedMotion } from './dom.js';

const FIRST_HOLD = 800, RETURNING_HOLD = 150, FADE_MS = 340;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function hideSplash() {
  const splash = document.getElementById('splash');
  try { localStorage.setItem('safelex:launched', '1'); } catch {}
  if (!splash) return;
  const returning = document.documentElement.classList.contains('returning');
  if (reducedMotion() && returning) { splash.remove(); return; }
  await nextFrame();
  await wait(returning ? RETURNING_HOLD : FIRST_HOLD);
  splash.classList.add('hide');
  await wait(FADE_MS);
  splash.remove();
}
