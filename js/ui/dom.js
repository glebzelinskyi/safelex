// Спільне для всіх екранів: контейнер сторінки, вібрація, анімація чисел.

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

/** Числа з атрибутом data-count «набігають» від 0 до свого значення. */
export function countUp(root) {
  if (reducedMotion()) return;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    if (!to) return;
    const dur = Math.min(900, 400 + to * 30), t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    el.textContent = 0;
    requestAnimationFrame(step);
  });
}
