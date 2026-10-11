// Оновлює tests/term-ids.json — список id усіх термінів (npm run ids).
// За цим списком тест tests/unit/ids.test.js стежить, щоб id наявних термінів не змінювалися:
// на id тримаються прогрес і збережені терміни користувачів.
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('..', import.meta.url);
const ctx = {}; ctx.window = ctx;
runInNewContext(readFileSync(new URL('data/terms.js', root), 'utf8'), ctx);
const ids = ctx.TERMS.map(t => t.id).sort();
writeFileSync(new URL('tests/term-ids.json', root), JSON.stringify(ids, null, 0).replace(/,/g, ',\n') + '\n');
console.log(`SafeLex: записано ${ids.length} id у tests/term-ids.json`);
