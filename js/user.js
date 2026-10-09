// Особисті списки користувача: збережені терміни, нещодавно переглянуті, історія пошуку.
import { store } from './core/store.js';
import { termById } from './data.js';

export const favs = new Set(store.get('safelex:favs', []).filter(id => termById[id]));

/** Додає або прибирає термін зі збережених. Повертає новий стан. */
export function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  store.set('safelex:favs', [...favs]);
  return favs.has(id);
}

export const recent = store.get('safelex:recent', []).filter(id => termById[id]);

export function rememberTerm(id) {
  const i = recent.indexOf(id);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(id); recent.length = Math.min(recent.length, 10);
  store.set('safelex:recent', recent);
}
export function clearRecent() { recent.length = 0; store.set('safelex:recent', []); }

export const qHist = store.get('safelex:qhist', []).filter(q => typeof q === 'string' && q.trim()).slice(0, 8);

export function rememberQuery(q) {
  q = q.trim();
  if (q.length < 2) return;
  const i = qHist.findIndex(x => x.toLowerCase() === q.toLowerCase());
  if (i >= 0) qHist.splice(i, 1);
  qHist.unshift(q); qHist.length = Math.min(qHist.length, 8);
  store.set('safelex:qhist', qHist);
}
export function clearQueries() { qHist.length = 0; store.set('safelex:qhist', []); }
