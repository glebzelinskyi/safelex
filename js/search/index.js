// Пошук по базі застосунку. Індекс будується у вільну хвилину після запуску.
import { TERMS } from '../data.js';
import { recent } from '../user.js';
import { createSearchEngine } from './engine.js';

const engine = createSearchEngine(TERMS, { isRecent: id => recent.includes(id) });

export const smartSearch = engine.search;
export const warmSearch = () => (window.requestIdleCallback || (f => setTimeout(f, 1200)))(() => engine.index());
