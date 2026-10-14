import { esc } from '../core/util.js';
import { I } from './icons.js';

export const app = document.getElementById('app');

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

export function toast(title, text) {
  document.querySelector('.note-toast')?.remove();
  const t = document.createElement('button');
  t.className = 'note-toast';
  t.innerHTML = `<i class="nt-ic">${I.check}</i><span class="nt-body"><b>${esc(title)}</b><small>${esc(text)}</small></span>`;
  t.addEventListener('click', () => t.remove());
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 7000);
}
