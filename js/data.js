import { createDb } from './core/db.js';

export const { CATEGORIES, TERMS, SOURCES, MARCH_STEPS, catById, termById, byCat, CORE } = createDb(globalThis);

export const srcTitle = t => SOURCES[t.src]?.title || '';
export const short = c => c.short || c.title.split(' · ')[0];
export const toneOf = cat => 'tone-' + Math.max(0, CATEGORIES.findIndex(c => c.id === cat)) % 6;
export const catTitle = cat => cat === 'all' ? 'Усі розділи' : cat === 'core' ? 'Ключові' : cat === 'fav' ? 'Збережені' : short(catById[cat]);
