// Unit-тести працюють у jsdom (є localStorage і window). База термінів завантажується так само,
// як у браузері: data/terms.js виконується як звичайний скрипт і створює глобальні TOPICS / TERMS / SOURCES.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach } from 'vitest';

const code = readFileSync(resolve(process.cwd(), 'data/terms.js'), 'utf8');
(0, eval)(code);

beforeEach(() => localStorage.clear());
