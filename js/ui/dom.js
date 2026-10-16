import { esc } from '../core/util.js';
import { I } from './icons.js';

export const app = document.getElementById('app');

// Адреси головних екранів — тих, що відкриваються вкладками внизу.
export const TAB_HASHES = ['', '#', '#/', '#/guide', '#/train', '#/me'];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let hapticLabel = null;
function iosHaptic() {
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    hapticLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    document.body.appendChild(hapticLabel);
  }
  const prev = document.activeElement, box = hapticLabel.firstChild;
  hapticLabel.click();
  if (document.activeElement === box) { box.blur(); if (prev && prev !== document.body) prev.focus?.({ preventScroll: true }); }
}
export const vibrate = p => { try { navigator.vibrate ? navigator.vibrate(p) : iosHaptic(); } catch {} };

// Постійна невидима область: читач екрана озвучує текст, що в ній з'являється.
let live = null;
function announce(text) {
  if (!live) {
    live = document.createElement('div');
    live.className = 'sr-live'; live.setAttribute('role', 'status');
    document.body.appendChild(live);
  }
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}

// kind: 'ok' — галочка, 'warn' — помилка (довше на екрані, бо текст треба встигнути прочитати).
export function toast(title, text, kind = 'ok') {
  document.querySelector('.note-toast')?.remove();
  const t = document.createElement('div');
  t.className = `note-toast ${kind}`;
  t.setAttribute('aria-hidden', 'true');
  t.innerHTML = `<i class="nt-ic">${kind === 'warn' ? I.x : I.check}</i><span class="nt-body"><b>${esc(title)}</b><small>${esc(text)}</small></span>`;
  t.addEventListener('click', () => t.remove());
  document.body.appendChild(t);
  announce(`${title}. ${text}`);
  setTimeout(() => t.remove(), kind === 'warn' ? 10000 : 7000);
}
