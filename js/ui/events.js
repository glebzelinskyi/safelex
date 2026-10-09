// Один обробник натискань на весь документ. Екрани реєструють реакції на атрибути
// своїх кнопок: onClick('pick', …) спрацює для <button data-pick="…">,
// onAction('fav', …) — для <button data-action="fav">.
// Так кнопки працюють і після того, як екран перемальовано через innerHTML.

// Порядок перевірки, якщо в елемента кілька атрибутів.
const ATTRS = ['cat', 'q', 'pick', 'tcat', 'letter', 'mt', 'day', 'rank', 'sprint', 'action'];
const byAttr = new Map(), byAction = new Map();
const SELECTOR = ATTRS.map(a => `[data-${a}]`).join(',');

/** fn(value, el, event) для елементів з атрибутом data-<attr>. */
export function onClick(attr, fn) {
  if (!ATTRS.includes(attr) || attr === 'action') throw new Error(`Невідомий атрибут data-${attr}`);
  byAttr.set(attr, fn);
}

/** fn(el, event) для елементів з data-action="<name>". */
export function onAction(name, fn) {
  if (byAction.has(name)) throw new Error(`Дія «${name}» вже зареєстрована`);
  byAction.set(name, fn);
}

document.addEventListener('click', e => {
  const el = e.target.closest(SELECTOR);
  if (!el) return;
  for (const a of ATTRS) {
    const v = el.dataset[a];
    if (v === undefined || v === '') continue;
    if (a === 'action') byAction.get(v)?.(el, e);
    else byAttr.get(a)?.(v, el, e);
    return;
  }
});
