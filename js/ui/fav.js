import { toggleFav } from '../user.js';
import { vibrate } from './dom.js';
import { onAction } from './events.js';

onAction('fav', el => {
  const on = toggleFav(el.dataset.id);
  el.classList.toggle('on', on); el.setAttribute('aria-pressed', on);
  el.setAttribute('aria-label', on ? 'Прибрати зі збережених' : 'Зберегти');
  const label = el.querySelector('span'); if (label) label.textContent = on ? 'Збережено' : 'Зберегти';
  vibrate(15);
});
