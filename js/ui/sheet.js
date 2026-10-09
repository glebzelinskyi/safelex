// Нижня шторка: закривається кнопкою, Escape, натисканням поза нею або свайпом униз.
import { vibrate } from './dom.js';

export function openSheet(html, cls = '') {
  document.querySelector('.sheet-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><i class="sheet-grip"></i><div class="sheet-body">${html}</div></div>`;
  const sh = wrap.firstElementChild;
  const close = () => {
    if (wrap.classList.contains('out')) return;
    wrap.classList.add('out'); sh.style.transform = '';
    document.documentElement.classList.remove('sheet-open');
    setTimeout(() => wrap.remove(), 260);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-action="sheet-close"]')) close(); });
  wrap.addEventListener('touchmove', e => { if (e.target === wrap) e.preventDefault(); }, { passive: false });
  document.documentElement.classList.add('sheet-open');
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) { e.preventDefault(); sh.classList.add('drag'); sh.style.transform = `translateY(${dy}px)`; }
  }, { passive: false });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return;
    y0 = null; sh.classList.remove('drag');
    if (dy > 90) close(); else sh.style.transform = '';
  });
  document.body.appendChild(wrap);
  vibrate(10);
  return { wrap, sheet: sh, close };
}

/** Прибирає шторку й святковий екран — під час переходу на інший екран. */
export function closeOverlays() {
  document.querySelector('.celebrate')?.remove();
  document.querySelector('.sheet-wrap')?.remove();
  document.documentElement.classList.remove('sheet-open');
}
