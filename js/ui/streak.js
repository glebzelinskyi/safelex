import { nDays } from '../core/util.js';
import { keyToDate } from '../core/dates.js';
import { restoreOffer, restoreStreak } from '../learn/streak.js';
import { I } from './icons.js';
import { onAction } from './events.js';
import { toast, vibrate, reducedMotion } from './dom.js';
import { celebrate } from './ranks.js';

// Показується лише тоді, коли серію щойно втрачено і її ще можна повернути.
export function streakBackCard() {
  const offer = restoreOffer();
  if (!offer) return '';
  return `
    <div class="streak-back">
      <span class="sb-top">
        <span class="sb-ic">${I.flame}<i></i></span>
        <span class="body">
          <b>Серію на ${nDays(offer.lost)} ще можна врятувати</b>
          <span>Учора пропущено. Раз на місяць один день можна повернути.</span>
        </span>
      </span>
      <button class="btn sb-go" data-action="streak-restore">${I.flame}Відновити серію</button>
    </div>`;
}

const afters = [];
export const onStreakRestored = fn => { afters.push(fn); };

// Спершу вогник розгорається, потім серія повертається — щоб натискання відчувалося.
onAction('streak-restore', el => {
  const card = el.closest('.streak-back');
  if (card && !card.classList.contains('relit') && !reducedMotion()) {
    card.classList.add('relit');
    vibrate(10);
    setTimeout(doRestore, 520);
  } else if (!card?.classList.contains('relit')) doRestore();
});

function doRestore() {
  const res = restoreStreak();
  // Пропозиція встигла зникнути (минула північ, відновили в іншій вкладці) — просто перемалювати екран.
  if (!res) { afters.forEach(f => f()); return; }
  vibrate([20, 40, 20]);
  afters.forEach(f => f());
  if (res.rank) celebrate(res.rank);
  else toast('Серію відновлено', `${nDays(res.streak)} поспіль. Відновлення за ${keyToDate(res.day).toLocaleDateString('uk-UA', { month: 'long' })} використано.`);
}
