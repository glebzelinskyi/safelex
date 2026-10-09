import { store } from '../core/store.js';
import { I } from './icons.js';
import { onAction } from './events.js';

let installEvent = null;
const ua = navigator.userAgent;
export const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => {
  installEvent = null; store.set('safelex:hideInstall', true);
  document.querySelector('.install-card')?.remove();
});

export function installCard() {
  if (isStandalone() || store.get('safelex:hideInstall', false)) return '';
  let text = '', btn = '';
  if (installEvent || isAndroid) { text = 'Додайте SafeLex на екран телефона — працюватиме як звичайний застосунок, навіть без інтернету.'; btn = `<button class="btn" data-action="install">Встановити</button>`; }
  else if (isIOS) text = 'Щоб встановити на iPhone: натисніть «Поділитися» внизу Safari, потім «На екран „Додому“».';
  else return '';
  return `
    <div class="install-card">
      <div class="logo">SL</div>
      <div class="body"><b>Встановіть на телефон</b><span>${text}</span>${btn}</div>
      <button class="x" data-action="hide-install" aria-label="Сховати">${I.x}</button>
    </div>`;
}

export function initInstall(afterPrompt) {
  if (isStandalone()) document.documentElement.classList.add('standalone');
  onAction('install', () => {
    if (installEvent) { installEvent.prompt(); installEvent.userChoice.finally(() => { installEvent = null; afterPrompt(); }); }
    else alert('Щоб встановити: відкрийте меню ⋮ у Chrome і виберіть «Додати на головний екран» або «Встановити».');
  });
  onAction('hide-install', el => { store.set('safelex:hideInstall', true); el.closest('.install-card')?.remove(); });
}
