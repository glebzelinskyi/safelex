// Погони звань у SVG — за зразками постанови КМУ № 81. Індекс у PG відповідає RANKS.
import { esc } from '../core/util.js';
import { RANKS } from '../learn/ranks.js';

const f1 = n => n.toFixed(2);

function star8(cx, cy, R) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = Math.PI / 8 * i - Math.PI / 2, k = i % 4 === 0 ? R : i % 2 === 0 ? R * .92 : R * .5;
    return `${f1(cx + k * Math.cos(a))},${f1(cy + k * Math.sin(a))}`;
  }).join(' ');
  const t = `${f1(cx)},${f1(cy - R)}`, b = `${f1(cx)},${f1(cy + R)}`, l = `${f1(cx - R)},${f1(cy)}`, r = `${f1(cx + R)},${f1(cy)}`, c = `${f1(cx)},${f1(cy)}`;
  return `<polygon class="pg-g" points="${pts}"/><polygon class="pg-g" points="${t} ${r} ${b} ${l}"/>` +
    `<polygon class="pg-l" points="${c} ${t} ${l}"/><polygon class="pg-d" points="${c} ${b} ${r}"/>`;
}

function star3(cx, cy, R) {
  const pt = (deg, k) => `${f1(cx + k * Math.cos(deg * Math.PI / 180))},${f1(cy + k * Math.sin(deg * Math.PI / 180))}`;
  const c = `${f1(cx)},${f1(cy)}`, v = R * .3;
  return `<polygon class="pg-g" points="${pt(-90, R)} ${pt(-30, v)} ${pt(30, R)} ${pt(90, v)} ${pt(150, R)} ${pt(210, v)}"/>` +
    [-90, 30, 150].map(d => `<polygon class="pg-l" points="${c} ${pt(d, R)} ${pt(d - 60, v)}"/>`).join('');
}

const bar = '<rect class="pg-g" x="5" y="54.5" width="30" height="4.2" rx=".6"/><line class="pg-tw" x1="5.4" y1="56.6" x2="34.6" y2="56.6"/>';
const leaf = (x, y, len, deg) => {
  const a = deg * Math.PI / 180, tx = x + len * Math.cos(a), ty = y + len * Math.sin(a);
  const mx = (x + tx) / 2, my = (y + ty) / 2, w = len * .3, px = -Math.sin(a) * w, py = Math.cos(a) * w;
  return `M${f1(x)},${f1(y)} Q${f1(mx + px)},${f1(my + py)} ${f1(tx)},${f1(ty)} Q${f1(mx - px)},${f1(my - py)} ${f1(x)},${f1(y)}Z`;
};
const wing = [[-.8, -.2, 8.2, 196], [-4, -1.6, 7.6, 216], [-7.2, -3.8, 6.4, 236], [-9.6, -6.6, 5, 256]];
const leaves = [1, -1].map(k => `<g transform="translate(20 59) scale(${k} 1)">
    <path class="pg-g" d="${wing.map(w => leaf(...w)).join(' ')}"/>
    <path class="pg-l" d="${leaf(...wing[1])} ${leaf(...wing[3])}"/></g>`).join('') + '<circle class="pg-g" cx="20" cy="59.4" r="1.3"/>';
const genEmblem = `<circle class="pg-g" cx="20" cy="54" r="7.2"/><circle class="pg-wr" cx="20" cy="54" r="6.3"/>
    <circle class="pg-bl" cx="20" cy="54" r="4.9"/>
    <path class="pg-tz" d="M20,50.3 V57.9 M17,51.2 V55.6 Q17,57.6 18.9,57.6 H21.1 Q23,57.6 23,55.6 V51.2 M18.4,54.6 H21.6"/>`;
const stars = (n, y0, kind = star8, R = 5.2, gap = 11) => Array.from({ length: n }, (_, i) => kind(20, y0 - i * gap, R)).join('');

const PG = [
  '<text class="pg-g pg-k" x="20" y="59" text-anchor="middle">К</text>',
  '',
  stars(1, 47, star3, 5.8),
  bar + stars(1, 47, star3, 5.8),
  bar + stars(2, 46, star3, 5.8, 11),
  stars(1, 52), stars(2, 52), stars(3, 52), stars(4, 52),
  leaves + stars(1, 47), leaves + stars(2, 47), leaves + stars(3, 47),
  genEmblem + stars(1, 41), genEmblem + stars(2, 41), genEmblem + stars(3, 41),
  genEmblem + star8(20, 36, 7.6)
];

let uid = 0;
/**
 * Погон звання r. got — отримано (кольоровий) чи ні (приглушений); big — великий розмір;
 * shine — відблиск, що пробігає по погону.
 */
export function badge(r, got, big, shine) {
  const i = RANKS.indexOf(r), gen = r.title.startsWith('Генерал');
  const shape = gen ? '<path d="M5,63 V11 L12,3.5 H28 L35,11 V63 Z"/>' : '<rect x="5" y="3" width="30" height="60" rx="2"/>';
  const field = gen
    ? '<path class="pg-f pg-gen" d="M5,63 V11 L12,3.5 H28 L35,11 V63 Z"/><circle class="pg-g" cx="20" cy="10" r="2.6"/><circle class="pg-l" cx="19.3" cy="9.3" r="1"/>'
    : '<rect class="pg-f" x="5" y="3" width="30" height="60" rx="2"/>';
  const id = shine && got ? 'pg' + (++uid) : '';
  const glint = id ? `<defs><clipPath id="${id}c">${shape}</clipPath><linearGradient id="${id}g" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g clip-path="url(#${id}c)"><rect class="pg-glint" x="-16" y="-10" width="12" height="90" fill="url(#${id}g)" transform="skewX(-18)"/></g>` : '';
  return `<span class="pogon ${got ? 'got' : 'locked'} ${big ? 'big' : ''}" title="${esc(r.title)}">
    <svg viewBox="0 0 40 66" aria-hidden="true">${field}${PG[i] || ''}${glint}</svg></span>`;
}
