import { app, vibrate } from './dom.js';

export function initSwipeBack(goBack) {
  let on = false, sx = 0, sy = 0, dx = 0, t0 = 0;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    on = e.touches.length === 1 && t.clientX < 24 && !document.body.classList.contains('dark') && !!app.querySelector('[data-action="back"]');
    if (on) { sx = t.clientX; sy = t.clientY; dx = 0; t0 = performance.now(); }
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!on) return;
    const t = e.touches[0];
    dx = Math.max(0, t.clientX - sx);
    if (dx < 10 && Math.abs(t.clientY - sy) > 10) { on = false; app.style.transform = app.style.opacity = ''; return; }
    e.preventDefault();
    app.classList.add('swiping');
    app.style.transform = `translateX(${dx}px)`;
    app.style.opacity = 1 - dx / innerWidth * .5;
  }, { passive: false });
  const endSwipe = () => {
    if (!on) return;
    on = false;
    app.classList.remove('swiping');
    const fast = dx > 40 && dx / (performance.now() - t0) > .5;
    if (dx > innerWidth / 3 || fast) { app.classList.add('swipe-out'); vibrate(10); setTimeout(goBack, 160); }
    else app.style.transform = app.style.opacity = '';
  };
  document.addEventListener('touchend', endSwipe);
  document.addEventListener('touchcancel', endSwipe);
}
