// База термінів застосунку. data/terms.js підключається звичайним <script> перед модулями
// й кладе TOPICS / TERMS / SOURCES у глобальні змінні — тут вони перетворюються на зручні довідники.
import { createDb } from './core/db.js';

export const { CATEGORIES, TERMS, SOURCES, MARCH_STEPS, catById, termById, byCat, CORE } = createDb(globalThis);

export const srcTitle = t => SOURCES[t.src]?.title || '';
export const short = c => c.short || c.title.split(' · ')[0];
/** Колір розділу: tone-0 … tone-5 за порядком розділів. */
export const toneOf = cat => 'tone-' + Math.max(0, CATEGORIES.findIndex(c => c.id === cat)) % 6;
export const catTitle = cat => cat === 'all' ? 'Усі розділи' : cat === 'core' ? 'Ключові' : cat === 'fav' ? 'Збережені' : short(catById[cat]);
