// id термінів мають бути сталими: на них тримаються прогрес і збережені терміни на телефонах користувачів.
// id утворюється з англійського слова, тож змінюється разом з `en` (або коли вище у файлі з'являється термін-тезка).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';
import { TERMS } from '../../js/data.js';

const known = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/term-ids.json'), 'utf8'));

test('id наявних термінів не зникли й не змінилися', () => {
  const now = new Set(TERMS.map(t => t.id));
  const lost = known.filter(id => !now.has(id));
  expect(lost, 'Ці id зникли. Якщо ви виправили `en` терміна — допишіть йому старий id (`id: "..."`), щоб прогрес не загубився. ' +
    'Якщо термін видалено навмисно — запустіть `npm run ids`').toEqual([]);
});

test('нові терміни внесено до списку id', () => {
  const was = new Set(known);
  const added = TERMS.map(t => t.id).filter(id => !was.has(id));
  expect(added, 'Нові терміни ще не в tests/term-ids.json — запустіть `npm run ids`').toEqual([]);
});
