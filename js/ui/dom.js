// Спільне для всіх екранів: контейнер сторінки, вібрація.

/** <main id="app"> — сюди кожен екран малює свій вміст. */
export const app = document.getElementById('app');

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// iPhone не має navigator.vibrate, але дає легкий відгук, коли перемикається <input switch>.
let hapticLabel = null;
function iosHaptic() {
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    hapticLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}
export const vibrate = p => { try { navigator.vibrate ? navigator.vibrate(p) : iosHaptic(); } catch {} };
