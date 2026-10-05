/* =====================================================================
   SafeLex — логіка додатка
   Вкладки: Пошук (#/) · Довідник (#/guide) · Тренажер (#/train) · Моє (#/me)
   Інші екрани: картка терміна (#/term/id), розділ довідника (#/guide/розділ),
   режим тренажера (#/train/режим?cat=розділ), про додаток (#/about).
   Терміни беруться з data/terms.js (див. «Підготовка бази» нижче).
   ===================================================================== */

/* ---------- Підготовка бази ----------
   data/terms.js може бути у двох форматах:
   • новий — масив TOPICS: теми з термінами всередині (поля en, ua, ex, syn, core, src);
   • старий — масиви CATEGORIES і TERMS (поля cat, exEn, exUa, tr, full, note, related) і MARCH_STEPS.
   Обидва зводяться до одного вигляду, з яким працює решта додатка. */
window.SAFELEX_DB = (function () {
  'use strict';

  // Усі варіанти написання терміна, як у словнику:
  // «foam(ing) agent» → foaming agent, foam agent; «flame [flaming] combustion» → flame combustion, flaming combustion
  function formsOf(en) {
    const out = new Set(), todo = [String(en)];
    while (todo.length && out.size < 24) {
      const s = todo.pop();
      const p = s.match(/\(([^()]*)\)/), b = s.match(/\[([^\[\]]*)\]/);
      if (p && (!b || p.index < b.index)) {
        const before = s.slice(0, p.index), after = s.slice(p.index + p[0].length);
        todo.push(before + after);
        if (!/^pl\s/.test(p[1])) todo.push(before + p[1] + after); // «(pl criteria)» — лише примітка
      } else if (b) {
        const before = s.slice(0, b.index).replace(/\s+$/, ''), after = s.slice(b.index + b[0].length);
        const head = before.replace(/\S+$/, '');                   // варіант у [ ] замінює попереднє слово
        todo.push(before + after);
        b[1].split(/\s*,\s*/).forEach(alt => todo.push(head + alt + after));
      } else out.add(s.replace(/\s+/g, ' ').trim());
    }
    return [...out].filter(Boolean);
  }

  let cats = [], terms = [], march = [], sources = {};
  if (typeof TOPICS !== 'undefined') {
    cats = TOPICS.map(tp => ({ id: tp.id, title: tp.ua, short: tp.short, en: tp.en, icon: tp.icon, desc: tp.desc }));
    terms = typeof TERMS !== 'undefined' ? TERMS : [];
    sources = typeof SOURCES !== 'undefined' ? SOURCES : {};
  } else if (typeof CATEGORIES !== 'undefined' && typeof TERMS !== 'undefined') {
    cats = CATEGORIES; terms = TERMS;
    if (typeof MARCH_STEPS !== 'undefined') march = MARCH_STEPS;
  }

  terms.forEach(t => {
    if (!t || !t.en || !t.ua) return; // такий термін відкине перевірка бази в app.js
    t.cat = t.cat || t.topic;
    if (Array.isArray(t.ex)) { t.exEn = t.ex[0] || ''; t.exUa = t.ex[1] || ''; }
    t.ua = String(t.ua).replace(/(^|[;,]\s*)pl\s+/g, '$1мн. ');  // словникове «pl» → «мн.»
    t.senses = t.ua.split(/\s*;\s*/).filter(Boolean);              // значення, розділені «;»
    t.uaShort = (t.senses[0] || t.ua).replace(/\.$/, '');          // перше значення — для тестів і пар
    t.forms = formsOf(t.en);
    t.find = [t.en, ...t.forms, ...(t.syn || [])].map(x => String(x).toLowerCase());
  });
  return { cats, terms, march, sources };
})();

(function () {
  'use strict';

  const { cats: CATEGORIES, terms: TERMS, march: MARCH_STEPS, sources: SOURCES } = window.SAFELEX_DB;
  const app = document.getElementById('app');
  const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

  // Перевірка бази: термін з помилкою (немає id/en/ua, id повторюється, невідомий розділ)
  // пропускається, щоб не зламати додаток. Який саме — видно в консолі (F12 → Console).
  (function checkTerms() {
    const ids = new Set();
    const valid = TERMS.filter(t => {
      const why = !t || !t.id ? 'немає id' : !t.en || !t.ua ? 'немає en або ua' : ids.has(t.id) ? `id «${t.id}» повторюється`
        : !catById[t.cat] ? `невідомий розділ «${t.cat}»` : '';
      if (why) { console.warn(`SafeLex: термін пропущено — ${why}:`, t); return false; }
      ids.add(t.id); return true;
    });
    TERMS.length = 0;
    valid.forEach(t => TERMS.push(t));
  })();
  const termById = Object.fromEntries(TERMS.map(t => [t.id, t]));
  const byCat = {};
  TERMS.forEach(t => (byCat[t.cat] ||= []).push(t));
  // Ключові (найуживаніші) терміни: тренажер дає їх першими, з них же «Термін дня»
  const CORE = TERMS.filter(t => t.core);
  const srcTitle = t => SOURCES[t.src]?.title || '';

  /* ---------- Збереження на пристрої ---------- */
  const store = {
    get(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch (e) { return def; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ігноруємо */ } }
  };
  const favs = new Set(store.get('safelex:favs', []).filter(id => termById[id]));
  const saveFavs = () => store.set('safelex:favs', [...favs]);

  /* ---------- Допоміжні функції ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pad = n => String(n).padStart(2, '0');
  const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* не всі телефони підтримують */ } };
  const short = c => c.short || c.title.split(' · ')[0];
  const fmtTime = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  const nDays = n => `${n} ${plural(n, 'день', 'дні', 'днів')}`;
  const nTerms = n => `${n} ${plural(n, 'термін', 'терміни', 'термінів')}`;

  // k випадкових елементів без перемішування всього масиву — швидко навіть для тисяч термінів
  function sample(arr, k, skip) {
    const out = [], used = new Set();
    for (let tries = 0; out.length < k && tries < Math.max(k * 30, arr.length * 2); tries++) {
      const i = Math.floor(Math.random() * arr.length);
      if (used.has(i)) continue;
      used.add(i);
      if (!skip || !skip(arr[i])) out.push(arr[i]);
    }
    return out;
  }

  const I = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" style="stroke-width:2.4"><path d="m15 6-6 6 6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" style="stroke-width:2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke-width:2.2"><path d="m9 6 6 6-6 6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
    x: '<svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 3c.5 3 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.2 1-3.8 2.2-4.8.1 1.8.9 3 2 3.3-.6-3.4.2-6.5.8-9z"/></svg>',
    check: '<svg viewBox="0 0 24 24" style="stroke-width:3"><path d="m5 12 5 5 9-10"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    cards: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    dice: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01" style="stroke-width:3"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  // «Назад» веде лише по екранах додатка: якщо його відкрили одразу на картці терміна
  // (за посиланням чи з ярлика), history.back() вивів би з додатка — тоді йдемо на головну
  // Глибина зберігається в самому записі історії, тож вона правильна і після кнопки «Назад» на Android
  let navDepth = history.state?.d || 0;
  window.addEventListener('hashchange', () => {
    if (history.state?.d == null) history.replaceState({ d: navDepth + 1 }, '');
    navDepth = history.state.d;
  });
  function goBack() {
    if (navDepth > 0) history.back(); else location.hash = '#/';
  }

  /* =================== НАВЧАННЯ =================== */
  // Одне просте правило: термін ВИВЧЕНО, коли ви правильно відповіли на нього в 3 різні дні.
  // За день зараховується одна галочка ✓ (скільки б разів ви не відповіли), помилка забирає одну ✓.
  // Тренажер сам підкидає терміни, які час повторити: наступного дня, потім через 3 дні, потім через 10.
  const DAY = 864e5;
  const MASTERED = 3;                     // стільки галочок (днів) потрібно, щоб термін став «Вивчено»
  const REVIEW_DAYS = [0, 1, 3, 10];      // через скільки днів повторити термін, що має 0, 1, 2, 3 галочки
  const QUIZ_LEN = 10;                    // питань у тесті
  const DAILY_LEN = 10;                   // питань у завданні дня
  const CARDS_LEN = 20;                   // карток в одній колоді
  const MATCH_ROUNDS = 3, MATCH_PAIRS = 5; // режим «Пари»
  const SPRINT_SEC = 60;                  // режим «Спринт»

  let srs = store.get('safelex:srs', {});
  // Перехід зі старої версії (там був «рівень» 0–5 замість галочок)
  for (const id in srs) {
    const b = srs[id].box || 0;
    if (srs[id].checks === undefined) srs[id].checks = b >= 4 ? MASTERED : b >= 2 ? 1 : 0; // вивчене лишається вивченим
  }

  // Зарахувати відповідь. Повертає, що змінилось: +1 / 0 (сьогодні вже зараховано) / −1 і чи термін щойно став вивченим
  function grade(id, right) {
    const s = srs[id] || { checks: 0, day: '', due: 0, wrong: 0 };
    const today = dayKey(), before = s.checks;
    if (right) {
      if (s.day !== today) { s.checks = Math.min(MASTERED, s.checks + 1); s.day = today; }
      s.due = Date.now() + REVIEW_DAYS[s.checks] * DAY;
    } else {
      s.checks = Math.max(0, s.checks - 1);
      s.wrong = (s.wrong || 0) + 1;
      s.due = Date.now();
    }
    delete s.box;
    srs[id] = s; store.set('safelex:srs', srs);
    logAnswer(right);
    return { gain: s.checks - before, checks: s.checks, mastered: before < MASTERED && s.checks >= MASTERED };
  }
  // Журнал для статистики: скільки відповідей і скільки правильних у кожен день
  const actLog = store.get('safelex:log', {});
  function logAnswer(right) {
    const d = actLog[dayKey()] ||= { a: 0, r: 0 };
    d.a++; if (right) d.r++;
    const keys = Object.keys(actLog);
    if (keys.length > 400) keys.sort().slice(0, keys.length - 400).forEach(k => delete actLog[k]);
    store.set('safelex:log', actLog);
  }
  const boxOf = id => srs[id]?.checks ?? 0;
  const isDue = id => !!srs[id] && srs[id].due <= Date.now();
  const statusOf = id => !srs[id] ? 'new' : srs[id].checks >= MASTERED ? 'mastered' : 'learning';
  const poolFor = cat => cat === 'all' ? TERMS : cat === 'core' ? CORE : cat === 'fav' ? TERMS.filter(t => favs.has(t.id)) : (byCat[cat] || []);
  const mistakesIn = cat => poolFor(cat).filter(t => srs[t.id]?.wrong > 0 && srs[t.id].checks < MASTERED);
  // Кожен розділ має свій колір (tone-0…5); нові розділи отримують колір автоматично
  const toneOf = cat => 'tone-' + Math.max(0, CATEGORIES.findIndex(c => c.id === cat)) % 6;
  const catTitle = cat => cat === 'all' ? 'Усі розділи' : cat === 'core' ? 'Ключові' : cat === 'fav' ? 'Збережені' : short(catById[cat]);
  function progressOf(list) { const r = { new: 0, learning: 0, mastered: 0 }; list.forEach(t => r[statusOf(t.id)]++); return r; }

  // Порядок термінів: спершу ті, які настав час повторити (найслабші першими), далі нові (ключові першими), далі решта
  function pickTerms(pool, n) {
    const byBox = (a, b) => boxOf(a.id) - boxOf(b.id);
    const due = shuffle(pool.filter(t => isDue(t.id))).sort(byBox);
    const fresh = shuffle(pool.filter(t => !srs[t.id])).sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0));
    const later = shuffle(pool.filter(t => srs[t.id] && !isDue(t.id))).sort(byBox);
    return [...due, ...fresh, ...later].slice(0, n);
  }

  // Суть перекладу без уточнень у дужках: «район виїзду (пожежної частини)» → «район виїзду»
  const sense = s => String(s).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-zа-яіїєґ0-9]+/gi, ' ').trim();

  // Неправильні варіанти: спершу з того самого розділу, щоб не вгадувалося «на око».
  // Переклади-синоніми («район виїзду» і «район виїзду пожежної частини») не беремо — інакше дві правильні відповіді.
  function distractors(t, key, n = 3) {
    const seen = [sense(t[key])], loose = key !== 'en';
    const skip = o => {
      if (!o[key]) return true;
      const s = sense(o[key]);
      if (!s || seen.some(x => x === s || (loose && (x.includes(s) || s.includes(x))))) return true;
      seen.push(s); return false;
    };
    const out = sample(byCat[t.cat] || [], n, skip);
    if (out.length < n) out.push(...sample(TERMS, n - out.length, skip));
    return out;
  }

  // Речення-приклад з пропуском замість терміна (шукаємо будь-який варіант написання, найдовший першим)
  function blankOut(t) {
    const ex = t.exEn || '', low = ex.toLowerCase();
    for (const f of (t.forms || [t.en]).slice().sort((a, b) => b.length - a.length)) {
      const fl = f.toLowerCase();
      let i = low.indexOf(fl);
      while (i > 0 && /[a-z]/i.test(ex[i - 1])) i = low.indexOf(fl, i + 1); // лише з початку слова
      if (i < 0) continue;
      let j = i + f.length;
      while (/[a-z]/i.test(ex[j] || '')) j++; // «booby trap» у реченні може бути «booby traps»
      return ex.slice(0, i) + '_____' + ex.slice(j);
    }
    return '';
  }

  // Звичайний тест ускладнюється разом зі знанням терміна: нове → обрати переклад,
  // знайоме → обрати англійський термін, добре знайоме → написати самому.
  // Завдання дня (mixed) — усі типи питань урозкид.
  function makeQuestion(t, kind, mixed) {
    if (!kind) {
      const box = boxOf(t.id);
      const kinds = mixed
        ? ['en2ua', 'ua2en', ...(box >= 1 ? ['type'] : []), ...(blankOut(t) ? ['context'] : []), ...(t.full ? ['abbr'] : [])]
        : box === 0 ? ['en2ua'] : box === 1 ? ['en2ua', 'ua2en'] : ['ua2en', 'type'];
      kind = kinds[Math.floor(Math.random() * kinds.length)];
    }
    const q = { t, kind };
    if (kind === 'type') return Object.assign(q, { label: 'Напишіть англійською', ask: t.ua, hint: `Починається на «${(t.en.match(/[a-z0-9]/i) || [t.en[0]])[0]}»` });
    if (kind === 'context') Object.assign(q, { label: 'Заповніть пропуск', ask: blankOut(t), hint: t.exUa, key: 'en' });
    else if (kind === 'abbr') Object.assign(q, { label: 'Що означає абревіатура?', ask: t.en, hint: '', key: 'full' });
    else if (kind === 'ua2en') Object.assign(q, { label: 'Як це англійською?', ask: t.ua, hint: '', key: 'en' });
    else Object.assign(q, { label: 'Оберіть переклад', ask: t.en, hint: t.full, key: 'uaShort' });
    q.options = shuffle([t, ...distractors(t, q.key)]);
    if (q.options.length < 2 && kind !== 'en2ua') return makeQuestion(t, 'en2ua'); // замало варіантів — просте питання
    return q;
  }

  // Написана відповідь: регістр і розділові знаки не важливі, одну одруківку в довгому слові прощаємо
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function typos(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  // Зараховується будь-який варіант написання: foam agent / foaming agent, behavior / behaviour
  function typedRight(input, t) {
    const a = norm(input);
    if (!a) return false;
    if (t.full && a === norm(t.full)) return true;
    return [...(t.forms || [t.en]), ...(t.syn || [])].some(f => { const b = norm(f); return a === b || (b.length > 4 && typos(a, b) <= 1); });
  }

  /* =================== СЕРІЯ ДНІВ І ЗВАННЯ =================== */
  // За серію днів із виконаним завданням дня присвоюються звання, як у службі
  // Перше звання дається одразу, далі — за серію 3, 10, 100, 200, 300… днів поспіль
  const RANKS = [
    { days: 0, title: 'Курсант', text: 'Початкове звання. Виконуйте завдання дня щодня — і воно зміниться.' },
    { days: 3, title: 'Рядовий', text: 'Три дні поспіль. Найважче — почати, і це вже позаду.' },
    { days: 10, title: 'Сержант', text: 'Десять днів без пропусків. Практика стає звичкою.' },
    { days: 100, title: 'Старший сержант', text: 'Сто днів поспіль. Таку серію тримають одиниці.' },
    { days: 200, title: 'Прапорщик', text: 'Двісті днів щоденної практики. Основна термінологія — у пам’яті.' },
    { days: 300, title: 'Лейтенант', text: 'Триста днів. Перше офіцерське звання.' },
    { days: 400, title: 'Старший лейтенант', text: 'Чотириста днів без пропусків.' },
    { days: 500, title: 'Капітан', text: 'П’ятсот днів. Ви можете навчати інших.' },
    { days: 600, title: 'Майор', text: 'Шістсот днів щоденної практики.' },
    { days: 700, title: 'Підполковник', text: 'Сімсот днів поспіль.' },
    { days: 800, title: 'Полковник', text: 'Вісімсот днів. Залишився один крок.' },
    { days: 900, title: 'Генерал', text: 'Дев’ятсот днів поспіль. Найвище звання в додатку.' }
  ];
  function dayKey(daysAgo = 0) {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const doneDays = new Set(store.get('safelex:days', []));
  const doneToday = () => doneDays.has(dayKey());
  // Серія: скільки днів поспіль виконано завдання (якщо сьогодні ще не пройдено — серія ще жива з учора)
  function streak() { let n = 0; for (let i = doneToday() ? 0 : 1; doneDays.has(dayKey(i)); i++) n++; return n; }
  const bestStreak = () => Math.max(store.get('safelex:best', 0), streak());
  const rankOf = days => RANKS.filter(r => days >= r.days).pop() || null;
  const nextRank = days => RANKS.find(r => r.days > days) || null;

  // Повертає звання, якщо щойно досягнуто нового
  function finishDaily(score, total) {
    doneDays.add(dayKey());
    store.set('safelex:days', [...doneDays].sort().slice(-400));
    store.set('safelex:dailyScore', { date: dayKey(), score, total });
    const s = streak();
    store.set('safelex:best', Math.max(store.get('safelex:best', 0), s));
    const seen = new Set(store.get('safelex:ranksSeen', []));
    const r = RANKS.find(r => r.days === s);
    if (!r || seen.has(r.days)) return null;
    seen.add(r.days); store.set('safelex:ranksSeen', [...seen]);
    return r;
  }

  // Суміш для завдання дня: до 5 термінів на повторення, до 3 нових, решта — випадкові з усієї бази
  function dailyTerms() {
    const picked = new Set(shuffle(TERMS.filter(t => isDue(t.id))).slice(0, 5));
    sample(CORE.length ? CORE : TERMS, 3, t => !!srs[t.id] || picked.has(t)).forEach(t => picked.add(t));
    sample(TERMS, DAILY_LEN - picked.size, t => picked.has(t)).forEach(t => picked.add(t));
    return shuffle([...picked]);
  }

  // Значок звання (кольоровий кружок із кількістю днів)
  // Значок звання — погон: на сержантських лички, на офіцерських зірочки, у старших офіцерів просвіти,
  // у генерала — зигзаг і велика зірка. Порядок — як у списку RANKS
  const starPts = (cx, cy, r) => Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 5 * i - Math.PI / 2, k = i % 2 ? r * .42 : r;
    return `${(cx + k * Math.cos(a)).toFixed(1)},${(cy + k * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const star = (cx, cy, r) => `<polygon class="pg-g" points="${starPts(cx, cy, r)}"/>`;
  const stripe = (y, h = 3) => `<rect class="pg-g" x="9" y="${y}" width="22" height="${h}" rx="1"/>`;
  const lines = '<rect class="pg-g" x="14.5" y="14" width="2" height="46"/><rect class="pg-g" x="23.5" y="14" width="2" height="46"/>';
  const PG = [
    '<text class="pg-g pg-k" x="20" y="44" text-anchor="middle">К</text>',      // Курсант
    '',                                                                        // Рядовий
    stripe(42) + stripe(47) + stripe(52),                                      // Сержант
    stripe(40, 14),                                                            // Старший сержант
    star(20, 32, 3.6) + star(20, 44, 3.6),                                     // Прапорщик
    star(14, 46, 3.8) + star(26, 46, 3.8),                                     // Лейтенант
    star(14, 46, 3.8) + star(26, 46, 3.8) + star(20, 35, 3.8),                 // Старший лейтенант
    star(14, 46, 3.8) + star(26, 46, 3.8) + star(20, 35, 3.8) + star(20, 25, 3.8), // Капітан
    lines + star(20, 38, 6.5),                                                 // Майор
    lines + star(20, 30, 5.5) + star(20, 46, 5.5),                             // Підполковник
    lines + star(20, 24, 5) + star(20, 37, 5) + star(20, 50, 5),               // Полковник
    '<path class="pg-z" d="M9,52 l3.7,-5 3.7,5 3.6,-5 3.7,5 3.7,-5 3.6,5"/>' + star(20, 33, 7.5) // Генерал
  ];
  const badge = (r, got, big) => {
    const i = RANKS.indexOf(r);
    return `<span class="pogon ${got ? 'got' : 'locked'} ${i >= 5 ? 'officer' : ''} ${big ? 'big' : ''}" title="${esc(r.title)}">
      <svg viewBox="0 0 40 66" aria-hidden="true"><path class="pg-b" d="M6,12 L20,3 L34,12 V60 a4,4 0 0 1 -4,4 H10 a4,4 0 0 1 -4,-4 Z"/>
      <circle class="pg-g" cx="20" cy="12" r="2.6"/>${PG[i] || ''}</svg></span>`;
  };

  // Святковий екран на нове звання
  function celebrate(r) {
    const colors = ['#FFC53D', '#D4570F', '#F28A45', '#7FD49B', '#9DB4D8', '#fff'];
    const bits = Array.from({ length: 40 }, (_, i) =>
      `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('');
    const el = document.createElement('div');
    el.className = 'celebrate';
    el.innerHTML = `
      <div class="confetti">${bits}</div>
      <div class="cel-card" role="dialog" aria-label="Нове звання">
        ${badge(r, true, true)}
        <span class="cel-days">${I.flame}${nDays(r.days)} поспіль!</span>
        <h2>Нове звання: ${esc(r.title)}</h2>
        <p>${esc(r.text)}</p>
        ${nextRank(r.days) ? `<span class="cel-next">Наступне — «${esc(nextRank(r.days).title)}» за ${nDays(nextRank(r.days).days)}</span>` : ''}
        <button class="btn" data-action="cel-close">Продовжити</button>
      </div>`;
    // Закривається кнопкою, торканням поза карткою або клавішею Esc
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    const onKey = e => { if (e.key === 'Escape') el.remove(); if (!el.isConnected) document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    el.querySelector('.btn').focus({ preventScroll: true });
    vibrate([30, 60, 30, 60, 120]);
  }

  /* ---------- Установка як додаток (кнопка «Встановити») ---------- */
  let installEvent = null;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isStandalone()) document.documentElement.classList.add('standalone');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvent = e;
    if (!location.hash || location.hash === '#/') drawHome();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null; store.set('safelex:hideInstall', true);
    document.querySelector('.install-card')?.remove();
  });

  // Картка «Встановіть на телефон» — показується, лише коли відкрито в браузері
  function installCard() {
    if (isStandalone() || store.get('safelex:hideInstall', false)) return '';
    let text = '', btn = '';
    if (installEvent) { text = 'Додайте SafeLex на екран телефона — працюватиме як звичайний застосунок, навіть без інтернету.'; btn = `<button class="btn" data-action="install">Встановити</button>`; }
    else if (isIOS) text = 'Щоб встановити на iPhone: натисніть «Поділитися» внизу Safari, потім «На екран „Додому“».';
    else if (isAndroid) text = 'Щоб встановити: меню ⋮ у Chrome → «Встановити додаток» або «Додати на головний екран».';
    else return '';
    return `
      <div class="install-card">
        <div class="logo">SL</div>
        <div class="body"><b>Встановіть на телефон</b><span>${text}</span>${btn}</div>
        <button class="x" data-action="hide-install" aria-label="Сховати">${I.x}</button>
      </div>`;
  }

  /* =================== ПОШУК (головна) =================== */
  const MAX_RESULTS = 50; // більше на екран не виводимо — щоб пошук не гальмував на великій базі
  let lastQuery = '';
  let searchCat = 'all';

  // Підсвічує збіг із пошуковим запитом
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  // Пошук: спочатку ті, що починаються з запиту, далі — що містять
  function search(q, cat) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const res = [];
    for (const t of TERMS) {
      if (cat !== 'all' && t.cat !== cat) continue;
      const en = t.find || [t.en.toLowerCase()], full = (t.full || '').toLowerCase(), ua = t.ua.toLowerCase();
      let score = -1;
      if (en.includes(q)) score = 0;
      else if (en.some(f => f.startsWith(q))) score = 1;
      else if (en.some(f => f.includes(q))) score = 2;
      else if (full.split(/[\s,/-]+/).some(w => w.startsWith(q))) score = 3;
      else if (ua.split(/[\s,/()«»-]+/).some(w => w.startsWith(q))) score = 4;
      else if (full.includes(q) || ua.includes(q)) score = 5;
      if (score >= 0) res.push({ t, score });
    }
    return res.sort((a, b) => a.score - b.score || a.t.en.localeCompare(b.t.en)).map(r => r.t);
  }

  function renderHome() {
    app.innerHTML = `
      <header class="hero">
        <div class="brand">
          <div class="logo">SL</div>
          <div class="grow">
            <div class="brand-name">Safe<span>Lex</span></div>
            <div class="brand-sub">Англо-український словник рятувальника</div>
          </div>
          <a href="#/about" aria-label="Про додаток"><img class="hdr-emblem" src="icons/emblem.png" alt="Герб ДСНС"></a>
        </div>
        <label class="searchbox">
          ${I.search}
          <input id="q" type="search" value="${esc(lastQuery)}" placeholder="hose, arson, рукав…" aria-label="Пошук терміна" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button class="clear" data-action="clear" aria-label="Очистити" ${lastQuery ? '' : 'hidden'}>${I.x}</button>
        </label>
        <div class="chips scroll" id="qchips"></div>
      </header>
      <section class="section" id="homeBody"></section>`;
    const input = document.getElementById('q');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); }); // ховає клавіатуру
    input.addEventListener('input', () => { lastQuery = input.value; drawHome(); });
    drawHome();
  }

  // Порожній запит → завдання дня; є запит → результати пошуку
  function drawHome() {
    const body = document.getElementById('homeBody'), chips = document.getElementById('qchips');
    if (!body) return;
    const q = lastQuery.trim();
    document.querySelector('.searchbox .clear')?.toggleAttribute('hidden', !lastQuery);
    chips.innerHTML = q
      ? `<button class="chip ${searchCat === 'all' ? 'active' : ''}" data-cat="all">Усі</button>` +
        CATEGORIES.map(c => `<button class="chip ${searchCat === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(short(c))}</button>`).join('')
      : '';
    chips.toggleAttribute('hidden', !q);
    if (!q) { body.innerHTML = installCard() + dailyCard() + termOfDayCard() + recentBlock(); countUp(body); return; }
    const res = search(q, searchCat);
    body.innerHTML = !res.length
      ? `<div class="empty"><b>Нічого не знайдено</b>${searchCat === 'all' ? 'Перевірте написання або спробуйте шукати українською.' : 'У цьому розділі збігів немає — оберіть «Усі», щоб шукати по всій базі.'}</div>`
      : `<span class="meta">${res.length} ${plural(res.length, 'результат', 'результати', 'результатів')}${res.length > MAX_RESULTS ? ` · показано перші ${MAX_RESULTS}, уточніть запит` : ''}</span>
        ${res.slice(0, MAX_RESULTS).map(t => `
          <a class="result ${toneOf(t.cat)}" href="#/term/${t.id}">
            <span class="top"><span class="en">${highlight(t.en, q)}</span><span class="tag">${esc(short(catById[t.cat]))}</span></span>
            ${t.full ? `<span class="full">${highlight(t.full, q)}</span>` : ''}
            <span class="ua">${highlight(t.ua, q)}</span>
          </a>`).join('')}`;
  }

  // Картка «Завдання дня»: вогник із серією, тиждень і шлях до наступного звання
  function dailyCard() {
    const done = doneToday(), days = streak(), res = store.get('safelex:dailyScore', {});
    const next = nextRank(days), prev = rankOf(days);
    // Сьогодні і 6 наступних днів: у кожному — яку серію ви матимете, якщо не пропускати; зірка — день нового звання
    const base = done ? days : days + 1;
    const week = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const n = base + i, r = RANKS.find(r => r.days === n);
      const inner = i === 0 && done ? I.flame : r ? I.star : `<b>${n}</b>`;
      return `<span class="wd ${i === 0 ? 'today' : ''} ${i === 0 && done ? 'on' : ''} ${r ? 'rk' : ''}" ${r ? `title="День ${n}: звання «${esc(r.title)}»"` : ''}><i>${inner}</i>${i === 0 ? 'Сьогодні' : ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]}</span>`;
    }).join('');
    const from = prev ? prev.days : 0;
    return `
      <a class="daily ${done ? 'done' : ''}" href="#/train/daily">
        <span class="daily-top">
          <span class="fire ${days ? 'lit' : ''}">${I.flame}<b data-count="${days}">${days}</b></span>
          <span class="daily-txt">
            <span class="k">${days ? `${plural(days, 'день', 'дні', 'днів')} поспіль` : 'Серія ще не почалася'}</span>
            <span class="t">${done ? 'Сьогодні виконано' : 'Завдання дня'}</span>
            <span class="s">${done && res.date === dayKey() ? `Результат ${res.score} з ${res.total} · наступне — завтра` : `${DAILY_LEN} питань з усієї бази`}</span>
          </span>
          <span class="go">${done ? I.check : I.chev}</span>
        </span>
        <span class="week">${week}</span>
        ${next ? `
          <span class="next-rank">
            <span class="nr-bar"><span style="width:${Math.round((days - from) / (next.days - from) * 100)}%"></span></span>
            <span class="nr-txt">${esc(prev.title)} · до звання «${esc(next.title)}» ще ${nDays(next.days - days)}</span>
          </span>` : `<span class="nr-txt">Найвище звання — «Генерал»</span>`}
      </a>`;
  }

  // «Термін дня» — щодня інший; кнопка «Ще один» показує випадковий
  let todTerm = null, todShown = false;
  const hashStr = str => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const todPool = () => CORE.length ? CORE : TERMS;
  function termOfDayCard() {
    if (!TERMS.length) return '';
    const t = todTerm || todPool()[hashStr(dayKey()) % todPool().length];
    const saved = favs.has(t.id);
    return `
      <div class="tod ${toneOf(t.cat)}">
        <div class="tod-head">
          <span class="label">${todTerm ? 'Випадковий термін' : 'Термін дня'}</span>
          <button class="tod-more" data-action="tod-next">${I.dice}Ще один</button>
        </div>
        <div class="tod-body">
          <span class="tod-en">${esc(t.en)}</span>
          ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
          ${t.full ? `<span class="tod-full">${esc(t.full)}</span>` : ''}
          ${t.exEn ? `<span class="tod-ex">“${esc(t.exEn)}”</span>` : ''}
          <button class="tod-ua ${todShown ? 'shown' : ''}" data-action="tod-reveal" aria-expanded="${todShown}">
            <span class="tu-text">${esc(t.uaShort || t.ua)}</span>
            <span class="tu-cover">${I.eye}Спершу згадайте самі — торкніться, щоб побачити переклад</span>
          </button>
        </div>
        <div class="tod-actions">
          <a class="pill" href="#/term/${t.id}">Детальніше</a>

          <button class="pill ${saved ? 'on' : ''}" data-action="fav" data-id="${t.id}" aria-pressed="${saved}">${I.star}<span>${saved ? 'Збережено' : 'Зберегти'}</span></button>
        </div>
      </div>`;
  }

  // Нещодавно переглянуті терміни
  const recent = store.get('safelex:recent', []).filter(id => termById[id]);
  function rememberTerm(id) {
    const i = recent.indexOf(id);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift(id); recent.length = Math.min(recent.length, 10);
    store.set('safelex:recent', recent);
  }
  function recentBlock() {
    if (!recent.length) return '';
    return `
      <div class="section-head"><h2>Нещодавні</h2><button class="link-sm" data-action="recent-clear">Очистити</button></div>
      <div class="recent">${recent.slice(0, 5).map(id => `<a class="${toneOf(termById[id].cat)}" href="#/term/${id}"><b>${esc(termById[id].en)}</b><span>${esc(termById[id].ua)}</span></a>`).join('')}</div>`;
  }

  /* =================== ДОВІДНИК =================== */
  // Розділи з прогресом; у розділі — фільтр, алфавіт і підвантаження списку під час гортання
  const GUIDE_CHUNK = 120;
  const sortedCache = {};
  const sortKey = t => t.en.replace(/^[^a-z0-9]+/i, '');
  const sortedTerms = cat => sortedCache[cat] ||= poolFor(cat).slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'en', { sensitivity: 'base' }));
  const letterOf = t => { const c = (t.en.match(/[a-z0-9]/i) || ['#'])[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; }; // «(alarm) card» → A
  const gv = { cat: '', filter: '', letter: '', items: [], shown: 0, lastLetter: '' };
  let guideObs = null;

  // 3 найвпізнаваніші терміни розділу для плитки: спершу ключові та абревіатури, коротші першими
  function previewTerms(list) {
    return list.slice().sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0) || (b.full ? 1 : 0) - (a.full ? 1 : 0) || a.en.length - b.en.length).slice(0, 3);
  }

  // Розділи довідника об’єднано в групи за змістом. Тема, якої немає в жодній групі, потрапить в «Інше»
  const GROUPS = [
    { title: 'Служба та зв’язок', ids: ['service', 'alarm'] },
    { title: 'Вогонь і гасіння', ids: ['combustion', 'extinguishing', 'heat', 'forest'] },
    { title: 'Техніка та вода', ids: ['vehicles', 'water', 'aviation'] },
    { title: 'Люди й будівлі', ids: ['rescue', 'buildings'] },
    { title: 'Небезпечні речовини', ids: ['chemistry', 'explosives'] },
    { title: 'Загальна лексика', ids: ['technical'] }
  ];
  function guideGroups() {
    const used = new Set(), out = GROUPS.map(g => ({ title: g.title, cats: g.ids.map(id => catById[id]).filter(c => c && !used.has(c.id) && used.add(c.id)) }));
    const rest = CATEGORIES.filter(c => !used.has(c.id));
    if (rest.length) out.push({ title: 'Інше', cats: rest });
    return out.filter(g => g.cats.length);
  }
  function renderGuide() {
    const p = progressOf(TERMS), n = TERMS.length || 1;
    let no = 0; // наскрізна нумерація 01, 02, 03… у тому порядку, як розділи стоять на екрані
    app.innerHTML = `
      <header class="hero">
        <h1>Довідник</h1>
        <p class="lead">${nTerms(TERMS.length)} у ${CATEGORIES.length} розділах</p>
        <div class="g-prog">
          <div class="stack"><span class="s-mastered" style="width:${p.mastered / n * 100}%"></span><span class="s-learning" style="width:${p.learning / n * 100}%"></span></div>
          <span>Вивчено <b>${p.mastered}</b> · вчу <b>${p.learning}</b></span>
        </div>
      </header>
      <section class="section">
        <a class="az-row" href="#/guide/all">
          <span class="az-mark">A–Я</span>
          <span class="body"><b>Усі терміни</b><span>Алфавітний список з фільтром</span></span>${I.chev}
        </a>
        ${guideGroups().map(g => {
          const total = g.cats.reduce((k, c) => k + (byCat[c.id] || []).length, 0);
          return `
          <div class="section-head"><h2>${esc(g.title)}</h2><span class="meta">${nTerms(total)}</span></div>
          <div class="topics">
            ${g.cats.map(c => {
              const list = byCat[c.id] || [], pc = progressOf(list), k = list.length || 1;
              const peek = previewTerms(list);
              return `
              <a class="topic" href="#/guide/${c.id}" style="--i:${no++}">
                <span class="tp-no" style="--p:${Math.round((pc.mastered + pc.learning * 0.5) / k * 100)}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="tn-t" cx="22" cy="22" r="20"/><circle class="tn-v" cx="22" cy="22" r="20" pathLength="100"/></svg><b>${pad(no)}</b></span>
                <span class="tp-body">
                  <span class="tp-title">${esc(c.title)}</span>
                  ${c.en ? `<span class="tp-en">${esc(c.en)}</span>` : ''}
                  <span class="tp-peek">напр.: ${peek.map(t => esc(t.en)).join(', ')}</span>
                </span>
                <span class="tp-count"><em data-count="${list.length}">${list.length}</em><small>${pc.mastered ? `вивч. ${pc.mastered}` : plural(list.length, 'термін', 'терміни', 'термінів')}</small></span>
              </a>`;
            }).join('')}
          </div>`;
        }).join('')}
        ${devCard()}
      </section>`;
    countUp(app);
  }

  function renderCategory(id) {
    const all = id === 'all';
    const c = catById[id];
    if (!all && !c) return renderGuide();
    const terms = sortedTerms(id);
    const letters = [...new Set(terms.map(letterOf))];
    const isMarch = id === 'medical' && MARCH_STEPS.length > 0;
    if (gv.cat !== id) Object.assign(gv, { cat: id, filter: '', letter: '' });
    app.innerHTML = `
      <header class="hero tinted ${all ? '' : toneOf(id)}" style="gap:14px">
        <div class="topbar">
          <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
          <span class="crumb">Довідник · ${nTerms(terms.length)}</span>
        </div>
        <h1>${all ? 'Усі терміни' : esc(c.title)}</h1>
        ${all ? '' : `<p class="lead">${esc(c.desc)}</p>`}
        <label class="searchbox small">
          ${I.search}
          <input id="gq" type="search" value="${esc(gv.filter)}" placeholder="Фільтр у ${all ? 'довіднику' : 'розділі'}" aria-label="Фільтр" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">
        </label>
        ${letters.length > 1 ? `<div class="chips scroll letters">${letters.map(l => `<button class="chip ${gv.letter === l ? 'active' : ''}" data-letter="${l}">${l}</button>`).join('')}</div>` : ''}
      </header>
      <section class="section">
        ${isMarch ? `
          <div class="march-box" id="march">
            <div class="section-head"><h2>Алгоритм MARCH</h2></div>
            ${MARCH_STEPS.map(s => `
              <div class="step"><span class="letter c-${s.letter}">${s.letter}</span>
                <span class="body"><span class="en">${esc(s.en)}</span><span class="ua">${esc(s.ua)}</span></span></div>`).join('')}
          </div>` : ''}
        <span class="meta" id="gcount"></span>
        <div class="list" id="glist"></div>
        <div id="gmore" class="gmore"></div>
        <a class="btn train-cta" href="#/train?cat=${all ? 'all' : id}">${I.target}Тренувати ${all ? 'всі терміни' : 'цей розділ'}</a>
      </section>`;
    const input = document.getElementById('gq');
    input.addEventListener('input', () => { gv.filter = input.value; applyGuideFilter(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    applyGuideFilter();
  }

  function applyGuideFilter() {
    const q = gv.filter.trim().toLowerCase();
    gv.items = sortedTerms(gv.cat).filter(t => (!gv.letter || letterOf(t) === gv.letter) &&
      (!q || (t.find || [t.en.toLowerCase()]).some(f => f.includes(q)) || t.ua.toLowerCase().includes(q) || (t.full || '').toLowerCase().includes(q)));
    gv.shown = 0; gv.lastLetter = '';
    document.getElementById('glist').innerHTML = gv.items.length ? '' : `<div class="empty"><b>Нічого не знайдено</b>Змініть фільтр або оберіть іншу літеру.</div>`;
    document.getElementById('gcount').textContent = q || gv.letter ? `Знайдено: ${gv.items.length}` : '';
    document.getElementById('march')?.toggleAttribute('hidden', !!(q || gv.letter));
    renderMoreTerms();
  }

  // Малюємо список порціями: наступна порція — коли користувач догортав до кінця
  function renderMoreTerms() {
    const list = document.getElementById('glist'), more = document.getElementById('gmore');
    if (!list) return;
    const part = gv.items.slice(gv.shown, gv.shown + GUIDE_CHUNK);
    let html = '';
    for (const t of part) {
      const l = letterOf(t);
      if (l !== gv.lastLetter && !gv.filter.trim()) { html += `<div class="letter-h">${l}</div>`; gv.lastLetter = l; }
      html += `<a class="row" href="#/term/${t.id}"><span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>${favs.has(t.id) ? `<span class="fav-dot">${I.star}</span>` : ''}${I.chev}</a>`;
    }
    list.insertAdjacentHTML('beforeend', html);
    gv.shown += part.length;
    guideObs?.disconnect();
    if (gv.shown < gv.items.length && 'IntersectionObserver' in window) {
      guideObs = new IntersectionObserver(es => { if (es[0].isIntersecting) renderMoreTerms(); }, { rootMargin: '600px' });
      guideObs.observe(more);
    } else if (gv.shown < gv.items.length) renderMoreTerms();
  }

  // Розробники додатка (показуються в довіднику і в «Про додаток»)
  const AUTHORS = [
    { name: 'Зелінський Гліб Сергійович', role: 'курсант 3 курсу' },
    { name: 'Пальчевська Олександра Святославівна', role: 'доцент кафедри іноземних мов та перекладознавства' }
  ];
  const authorsList = () => AUTHORS.map(a => `<span class="author"><b>${esc(a.name)}</b><span>${esc(a.role)}</span></span>`).join('');

  // Картка «Розробка» з гербом ЛДУ БЖД
  function devCard() {
    return `
      <a class="dev-card" href="#/about">
        <span class="dev-top">
          <img class="dev-crest" src="icons/ldubzhd-logo-white.png" alt="Герб ЛДУ БЖД">
          <span class="body">
            <span class="k">Розробка</span>
            <span class="s">Львівський державний університет безпеки життєдіяльності</span>
          </span>${I.chev}
        </span>
        <span class="authors">${authorsList()}</span>
      </a>`;
  }

  // Три галочки ✓ ✓ ○ — скільки днів термін уже «зараховано»
  const checksHtml = n => `<span class="checks">${Array.from({ length: MASTERED }, (_, i) => `<i class="${i < n ? 'on' : ''}">${i < n ? I.check : ''}</i>`).join('')}</span>`;

  // Статус терміна з поясненням
  function learnBadge(id) {
    const st = statusOf(id), n = boxOf(id), left = MASTERED - n, today = srs[id]?.day === dayKey();
    const text = st === 'new' ? 'Новий термін — ще не тренували'
      : st === 'mastered' ? 'Вивчено'
      : `Ще ${left} ${plural(left, 'день', 'дні', 'днів')} правильних відповідей${today ? ' · сьогодні вже зараховано' : ''}`;
    return `
      <details class="learn ${st}">
        <summary>
          ${checksHtml(n)}
          <span class="lt">${text}</span><span class="q-mark">?</span>
        </summary>
        ${learnHelp()}
      </details>`;
  }

  function renderTerm(id) {
    const t = termById[id];
    if (!t) {
      app.innerHTML = `
        <header class="hero"><div class="topbar"><button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button></div></header>
        <div class="empty"><b>Термін не знайдено</b>Можливо, його перейменували в базі. <a href="#/">На головну</a></div>`;
      return;
    }
    const cat = catById[t.cat];
    const related = (t.related || []).map(r => termById[r]).filter(Boolean);
    const isFav = favs.has(t.id);
    rememberTerm(t.id);
    app.innerHTML = `
      <header class="hero term-head tinted ${toneOf(t.cat)}">
        <div class="topbar">
          <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
          <span class="grow" style="display:flex;justify-content:center"><a class="cat-badge" href="#/guide/${t.cat}">${esc(short(cat))}</a></span>
          <button class="icon-btn ${isFav ? 'on' : ''}" data-action="fav" data-id="${t.id}" aria-label="${isFav ? 'Прибрати зі збережених' : 'Зберегти'}" aria-pressed="${isFav}">${I.star}</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <span class="abbr ${t.en.length > 36 ? 'xlong' : t.en.length > 16 ? 'long' : ''}">${esc(t.en)}</span>
          ${t.core ? `<span class="core-tag">${I.star}Ключовий термін</span>` : ''}
          ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
          ${t.full ? `<span class="full">${esc(t.full)}</span>` : ''}
        </div>
      </header>
      <section class="section" style="gap:14px">
        ${learnBadge(t.id)}
        <div class="card">
          <span class="label">Переклад</span>
          ${(t.senses || []).length > 1
            ? `<ol class="senses">${t.senses.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
            : `<span class="ua-big">${esc(t.ua)}</span>`}
          ${t.syn?.length ? `<p>Інше написання: <b>${t.syn.map(esc).join(', ')}</b></p>` : ''}
          ${t.note ? `<p>${esc(t.note)}</p>` : ''}
          ${srcTitle(t) ? `<span class="src-note">Джерело: ${esc(srcTitle(t))}</span>` : ''}
        </div>
        ${t.exEn ? `
        <div class="card">
          <span class="label">У контексті</span>
          <p class="ex-en">“${esc(t.exEn)}”</p>
          ${t.exUa ? `<p>«${esc(t.exUa)}»</p>` : ''}
        </div>` : ''}
        ${related.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          <span class="label">Пов’язані терміни</span>
          <div class="rel">${related.map(r => `<a href="#/term/${r.id}">${esc(r.en)}</a>`).join('')}</div>
        </div>` : ''}
        <a class="btn" href="#/train?cat=${t.cat}">${I.target}Тренувати цей розділ</a>
      </section>`;
  }

  function renderAbout() {
    app.innerHTML = `
      <header class="hero" style="gap:16px">
        <div class="topbar">
          <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
          <span class="crumb">Про додаток</span>
        </div>
        <div class="about-logos">
          <img class="emb" src="icons/emblem.png" alt="Герб ДСНС України">
          <span class="sep"></span>
          <img class="ld" src="icons/ldubzhd-logo-white.png" alt="Львівський державний університет безпеки життєдіяльності">
        </div>
        <div class="about-title">
          <div class="brand-name" style="font-size:26px">Safe<span>Lex</span></div>
          <p class="lead" style="margin:0">Англо-український словник пожежно-рятувальної термінології</p>
        </div>
      </header>
      <section class="section" style="gap:14px">
        <div class="card">
          <span class="label">Про проєкт</span>
          <p>Автономний цифровий словник для фахівців ДСНС України та курсантів: швидкий пошук термінів, довідник за напрямами роботи й тренажер для підготовки до заліків з професійної англійської мови. Працює без інтернету.</p>
        </div>
        <div class="card">
          <span class="label">Що всередині</span>
          <ul class="feat">
            <li>${nTerms(TERMS.length)} у ${CATEGORIES.length} розділах</li>
            <li>Живий пошук англійською та українською</li>
            ${CORE.length ? `<li>${nTerms(CORE.length)} позначено як ключові — тренажер дає їх першими</li>` : ''}
            ${MARCH_STEPS.length ? '<li>Алгоритм MARCH</li>' : ''}
            <li>Завдання дня, серія днів і звання</li>
            <li>Тренажер: тест, картки, пари, спринт, робота над помилками</li>
          </ul>
        </div>
        ${Object.keys(SOURCES).length ? `
        <div class="card">
          <span class="label">Джерела</span>
          ${Object.values(SOURCES).map(s => `<p><b>${esc(s.title)}</b>${s.note ? ` — ${esc(s.note)}` : ''}</p>`).join('')}
        </div>` : ''}
        <div class="card">
          <span class="label">Розробники</span>
          <span class="authors">${authorsList()}</span>
        </div>
        <div class="card about-uni">
          <img src="icons/ldubzhd-logo-white.png" alt="Львівський державний університет безпеки життєдіяльності">
          <span class="about-dep">Кафедра іноземних мов та перекладознавства</span>
        </div>
        <p class="meta" style="text-align:center">Версія 3.0 · ${new Date().getFullYear()}</p>
      </section>`;
  }

  /* =================== МОЄ =================== */
  // Пояснення статусів «Нові / Вчу / Вивчено» (показується в «Моє» і на картці терміна)
  const learnHelp = () => `
    <div class="how-rule">
      <b>Термін вивчено, коли ви правильно відповіли на нього в ${MASTERED} різні дні.</b>
      <span class="how-demo">${checksHtml(0)}<span>→</span>${checksHtml(1)}<span>→</span>${checksHtml(2)}<span>→</span>${checksHtml(3)}</span>
    </div>
    <ul class="how-list">
      <li><span class="how-ic ok">${I.check}</span><span>Правильна відповідь — <b>+1 галочка</b>, але не більше однієї на день.</span></li>
      <li><span class="how-ic bad">${I.x}</span><span>Помилка — <b>мінус одна галочка</b>.</span></li>
      <li><span class="how-ic">${I.redo}</span><span>Тренажер сам нагадає повторити: наступного дня, потім через 3 дні, потім через 10.</span></li>
    </ul>
    <p class="how-note"><b>Нові</b> — ще не траплялися вам. <b>Вчу</b> — є 0–2 галочки. <b>Вивчено</b> — усі ${MASTERED}.</p>`;

  // Серія, звання, прогрес і збережені терміни (їх можна одразу тренувати)
  // Рівень «вогню» плитки в «Моє»: що більше число, то яскравіша анімація (0…4)
  const streakLv = d => d >= 100 ? 4 : d >= 10 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : 0;
  const masteredLv = f => f >= .6 ? 4 : f >= .3 ? 3 : f >= .1 ? 2 : f > 0 ? 1 : 0;

  // Підказка під «днів поспіль»: що робити далі
  function streakHint(days, best) {
    if (!days) return 'почніть сьогодні';
    if (!doneToday()) return 'виконайте завдання сьогодні, щоб не перервати';
    if (days >= best) return best > 1 ? 'це ваш рекорд' : 'перший день';
    return `до рекорду ще ${nDays(best - days + 1)}`;
  }

  // Числа «набігають» від 0 до значення (на екрані «Моє»)
  function countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.dataset.count;
      if (!to) return;
      const dur = Math.min(900, 400 + to * 30), t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      };
      el.textContent = 0;
      requestAnimationFrame(step);
    });
  }

  function renderMe() {
    const days = streak(), best = bestStreak(), p = progressOf(TERMS), n = TERMS.length || 1;
    const saved = TERMS.filter(t => favs.has(t.id));
    const rank = rankOf(best);
    app.innerHTML = `
      <header class="hero">
        <div class="me-head">
          ${badge(rank, true)}
          <span class="me-title"><span class="k">Ваше звання</span><b>${esc(rank.title)}</b>
            <span class="s">${nextRank(best) ? `Наступне — «${esc(nextRank(best).title)}»: серія ${nDays(nextRank(best).days)}` : 'Найвище звання в додатку'}</span></span>
        </div>
        <div class="me-stats">
          <span class="lv${streakLv(days)}"><b class="fl">${I.flame}<em data-count="${days}">${days}</em></b>${plural(days, 'день', 'дні', 'днів')} поспіль
            <small class="ms-hint">${streakHint(days, best)}</small></span>
          <span class="lv${streakLv(best)}"><b><em data-count="${best}">${best}</em></b>рекорд серії
            <small class="ms-hint">${nextRank(best) ? `до «${esc(nextRank(best).title)}» ще ${nDays(nextRank(best).days - best)}` : 'найвище звання'}</small></span>
          <span class="lv${masteredLv(p.mastered / n)}"><b><em data-count="${p.mastered}">${p.mastered}</em></b>вивчено
            <small class="ms-hint">${Math.round(p.mastered / n * 100)}% бази · вчу ${p.learning}</small>
            <i class="ms-bar"><i style="width:${p.mastered / n * 100}%"></i></i></span>
        </div>
      </header>
      <section class="section" style="gap:14px">
        <a class="stats-link" href="#/stats">
          <span class="sl-ic">${I.chart}</span>
          <span class="body"><b>Статистика</b><span>Активність, точність, складні терміни</span></span>${I.chev}
        </a>
        <div class="card">
          <span class="label">Прогрес по базі</span>
          <div class="stack"><span class="s-mastered" style="width:${p.mastered / n * 100}%"></span><span class="s-learning" style="width:${p.learning / n * 100}%"></span></div>
          <div class="legend">
            <span><i class="s-mastered"></i>Вивчено ${p.mastered}</span>
            <span><i class="s-learning"></i>Вчу ${p.learning}</span>
            <span><i class="s-new"></i>Нові ${p.new}</span>
          </div>
          <details class="how">
            <summary>Як це рахується?</summary>
            ${learnHelp()}
          </details>
        </div>
        <div class="section-head"><h2>Звання</h2><span class="meta">за серію днів</span></div>
        <div class="ranks">${RANKS.map(r => {
          const got = best >= r.days, cur = r === rank, nx = r === nextRank(best);
          return `<span class="rank ${cur ? 'cur' : ''} ${nx ? 'nx' : ''} ${got ? 'got' : ''}" style="--i:${RANKS.indexOf(r)}">${badge(r, got)}
            <span class="rk-t">${esc(r.title)}</span>
            <span class="rk-d">${cur ? 'ви тут' : nx ? `ще ${nDays(r.days - best)}` : r.days ? nDays(r.days) : 'старт'}</span></span>`;
        }).join('')}</div>
        <div class="section-head"><h2>Збережені</h2>${saved.length >= 2 ? `<a href="#/train?cat=fav">Тренувати</a>` : ''}</div>
        ${saved.length ? `<div class="list">${saved.map(t => `
          <a class="row" href="#/term/${t.id}">
            <span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>${I.chev}
          </a>`).join('')}</div>`
        : `<div class="empty"><b>Поки що порожньо</b>Натисніть ☆ на картці терміна, щоб зберегти його сюди і вчити окремо.</div>`}
        <button class="link-btn" data-action="reset">Скинути прогрес навчання</button>
      </section>`;
    countUp(app);
  }

  /* =================== СТАТИСТИКА =================== */
  // Активність за 14 днів, календар практики, точність, розділи, повторення і найскладніші терміни.
  // Дані — з журналу safelex:log (ведеться з цієї версії) і з днів виконаного завдання дня.
  const STATS_DAYS = 14;    // стовпчиків у графіку активності
  const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayLabel = k => { const t = keyToDate(k).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const nAnswers = n => `${n} ${plural(n, 'відповідь', 'відповіді', 'відповідей')}`;
  const pct = (r, a) => a ? Math.round(r / a * 100) : 0;

  // Підпис під графіком для вибраного дня
  function dayText(k) {
    const d = actLog[k];
    const when = k === dayKey() ? 'Сьогодні' : dayLabel(k);
    if (!d || !d.a) return `<b>${esc(when)}</b> · ${doneDays.has(k) ? 'завдання дня виконано' : 'без практики'}`;
    return `<b>${esc(when)}</b> · ${nAnswers(d.a)} · ${pct(d.r, d.a)}% правильних${doneDays.has(k) ? ' · завдання дня ✓' : ''}`;
  }
  // Вибраний день підсвічується лише в тому графіку, де його торкнулися; підпис — під цим графіком
  function showDay(k, el) {
    const card = el.closest('.card');
    if (!card) return;
    if (card.querySelector('#hmBox')) hmSel = k;
    const out = card.querySelector('.st-read');
    if (out) out.innerHTML = dayText(k);
    card.querySelectorAll('[data-day]').forEach(b => b.classList.toggle('sel', b.dataset.day === k));
  }

  // Календар практики: місяць сіткою пн…нд, колір — скільки відповідей, крапка — виконане завдання дня.
  // Стрілки гортають місяці назад (до року) і вперед до поточного.
  const MONTH_NAMES = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  let hmOffset = 0;  // 0 — поточний місяць, 1 — попередній…
  let hmSel = '';    // вибраний у календарі день (спершу — жоден, сьогодні й так виділено кольором)
  const heatLevel = k => { const a = actLog[k]?.a || 0; return a >= 50 ? 4 : a >= 25 ? 3 : a >= 10 ? 2 : a > 0 || doneDays.has(k) ? 1 : 0; };
  const practiced = k => !!(actLog[k]?.a) || doneDays.has(k);
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function heatmap() {
    const today = dayKey(), now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() - hmOffset, 1);
    const y = first.getFullYear(), m = first.getMonth();
    const len = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // порожніх клітинок до 1-го числа (тиждень з понеділка)
    let cells = '<i class="hm-cell blank"></i>'.repeat(lead), inMonth = 0;
    for (let d = 1; d <= len; d++) {
      const k = ymd(new Date(y, m, d));
      if (k > today) { cells += `<span class="hm-cell future">${d}</span>`; continue; }
      const a = actLog[k]?.a || 0, done = doneDays.has(k);
      if (practiced(k)) inMonth++;
      const tip = `${dayLabel(k)}: ${a ? nAnswers(a) : 'без відповідей'}${done ? ', завдання дня виконано' : ''}`;
      cells += `<button class="hm-cell l${heatLevel(k)} ${done ? 'done' : ''} ${k === today ? 'today' : ''} ${k === hmSel ? 'sel' : ''}" data-day="${k}" title="${esc(tip)}" aria-label="${esc(tip)}">${d}</button>`;
    }
    const elapsed = hmOffset ? len : now.getDate();
    return `<div class="hm-nav">
        <button class="icon-btn" data-action="hm-prev" aria-label="Попередній місяць" ${hmOffset >= 12 ? 'disabled' : ''}>${I.back}</button>
        <span class="hm-title"><b>${MONTH_NAMES[m]} ${y}</b><small>Днів практики: ${inMonth} з ${elapsed}</small></span>
        <button class="icon-btn" data-action="hm-next" aria-label="Наступний місяць" ${hmOffset <= 0 ? 'disabled' : ''}>${I.chev}</button>
      </div>
      <div class="hm-week" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span class="${i > 4 ? 'we' : ''}">${w}</span>`).join('')}</div>
      <div class="hm">${cells}</div>`;
  }
  function drawHeatmap(step) {
    hmOffset = Math.min(12, Math.max(0, hmOffset + step));
    const box = document.getElementById('hmBox');
    if (box) box.innerHTML = heatmap();
  }

  function renderStats() {
    const keys = Object.keys(actLog);
    const total = keys.reduce((n, k) => n + actLog[k].a, 0), right = keys.reduce((n, k) => n + actLog[k].r, 0);
    const active = new Set([...keys.filter(k => actLog[k].a), ...doneDays]).size;
    const p = progressOf(TERMS);
    const today = dayKey();

    // Активність: останні 14 днів
    const last = Array.from({ length: STATS_DAYS }, (_, i) => dayKey(STATS_DAYS - 1 - i));
    const max = Math.max(1, ...last.map(k => actLog[k]?.a || 0));
    const bars = last.map(k => {
      const a = actLog[k]?.a || 0, d = keyToDate(k);
      return `<button class="ab ${k === today ? 'sel today' : ''} ${a ? '' : 'zero'}" data-day="${k}" aria-label="${esc(dayLabel(k))}: ${nAnswers(a)}">
        <span class="ab-col"><i style="height:${a ? Math.max(4, a / max * 100) : 0}%"></i></span>
        <span class="ab-d">${d.getDate()}</span>
      </button>`;
    }).join('');
    const week = last.slice(-7).reduce((n, k) => n + (actLog[k]?.a || 0), 0);

    const now = new Date(); now.setHours(0, 0, 0, 0);
    // Повторення: скільки термінів чекає сьогодні, завтра, цього тижня
    const endOf = n => { const d = new Date(now); d.setDate(d.getDate() + n + 1); return d.getTime(); };
    const dueIn = n => Object.keys(srs).filter(id => termById[id] && srs[id].due < endOf(n)).length;
    const dueToday = dueIn(0), dueTomorrow = dueIn(1) - dueToday, dueWeek = dueIn(6);

    // Найскладніші: найбільше помилок, ще не вивчені
    const hard = Object.keys(srs).filter(id => termById[id] && srs[id].wrong > 0)
      .sort((a, b) => srs[b].wrong - srs[a].wrong || boxOf(a) - boxOf(b)).slice(0, 5).map(id => termById[id]);

    const matchBest = store.get('safelex:matchBest', 0), sprintBest = store.get('safelex:sprintBest', 0);

    app.innerHTML = `
      <header class="hero" style="gap:14px">
        <div class="topbar">
          <button class="icon-btn" data-action="back" aria-label="Назад">${I.back}</button>
          <span class="crumb">Моє</span>
        </div>
        <h1>Статистика</h1>
        <div class="st-tiles">
          <span><b data-count="${total}">${total}</b>${plural(total, 'відповідь', 'відповіді', 'відповідей')}</span>
          <span><b>${total ? `<em data-count="${pct(right, total)}">${pct(right, total)}</em>%` : '—'}</b>точність</span>
          <span><b data-count="${active}">${active}</b>${plural(active, 'день', 'дні', 'днів')} практики</span>
          <span><b data-count="${p.mastered}">${p.mastered}</b>вивчено з ${TERMS.length}</span>
        </div>
      </header>
      <section class="section" style="gap:14px">
        <div class="card">
          <div class="st-head"><span class="label">Активність · ${STATS_DAYS} днів</span><span class="meta">${nAnswers(week)} за тиждень</span></div>
          <div class="abars ${week || last.some(k => actLog[k]?.a) ? '' : 'none'}">${bars}</div>
          ${last.some(k => actLog[k]?.a) ? '' : '<span class="ab-empty">Графік з’явиться після перших відповідей у тренажері</span>'}
          <span class="st-read" aria-live="polite">${dayText(today)}</span>
        </div>
        <div class="card">
          <div class="st-head"><span class="label">Календар практики</span></div>
          <div id="hmBox">${heatmap()}</div>
          <div class="hm-legend">
            <span class="hm-key"><i class="hm-cell l1 done"></i>завдання дня</span>
            <span class="hm-key">Менше <i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i> Більше</span>
          </div>
          <span class="st-read" aria-live="polite">Торкніться дня, щоб побачити деталі</span>
        </div>
        <div class="card">
          <span class="label">Повторення</span>
          <div class="st-due">
            <a href="#/train/quiz?cat=all"><b>${dueToday}</b>сьогодні</a>
            <span><b>${Math.max(0, dueTomorrow)}</b>завтра</span>
            <span><b>${dueWeek}</b>за 7 днів</span>
          </div>
          <span class="meta" style="padding:0">Тренажер сам підкидає ці терміни першими.</span>
        </div>
        <div class="card">
          <span class="label">За розділами</span>
          ${CATEGORIES.map(c => {
            const list = byCat[c.id] || [], pc = progressOf(list), n = list.length || 1;
            return `<a class="st-cat" href="#/guide/${c.id}">
              <span class="st-cat-top"><span>${esc(short(c))}</span><span class="mono">${pc.mastered}/${list.length}</span></span>
              <span class="stack"><span class="s-mastered" style="width:${pc.mastered / n * 100}%"></span><span class="s-learning" style="width:${pc.learning / n * 100}%"></span></span>
            </a>`;
          }).join('')}
          <div class="legend">
            <span><i class="s-mastered"></i>Вивчено</span>
            <span><i class="s-learning"></i>Вчу</span>
            <span><i class="s-new"></i>Нові</span>
          </div>
        </div>
        <div class="section-head"><h2>Найскладніші</h2>${hard.length ? `<a href="#/train/mistakes?cat=all">Тренувати</a>` : ''}</div>
        ${hard.length ? `<div class="list">${hard.map(t => `
          <a class="row" href="#/term/${t.id}">
            <span class="body"><span class="en">${esc(t.en)}</span><span class="sub">${esc(t.ua)}</span></span>
            <span class="st-wrong">${srs[t.id].wrong} ${plural(srs[t.id].wrong, 'помилка', 'помилки', 'помилок')}</span>
          </a>`).join('')}</div>`
        : `<div class="empty"><b>Помилок ще немає</b>Тут з’являться терміни, у яких ви помиляєтеся найчастіше.</div>`}
        <div class="section-head"><h2>Рекорди</h2></div>
        <div class="st-due st-rec">
          <span><b>${bestStreak()}</b>${plural(bestStreak(), 'день', 'дні', 'днів')} серії</span>
          <span><b>${sprintBest || '—'}</b>спринт</span>
          <span><b>${matchBest ? fmtTime(matchBest) : '—'}</b>пари</span>
        </div>
      </section>`;
    countUp(app);
  }

  /* =================== ТРЕНАЖЕР =================== */
  let trainCat = store.get('safelex:trainCat', 'all');
  let ticker = null; // таймер для «Пар» і «Спринту»
  const inTrainMode = m => location.hash.startsWith('#/train/' + m); // відкладені дії не малюють поверх іншого екрана
  const stopTicker = () => { clearInterval(ticker); ticker = null; };

  const MODES = [
    { id: 'quiz', title: 'Тест', desc: `${QUIZ_LEN} питань. Складність росте разом із вашими знаннями`, icon: I.target, meta: () => '≈3 хв' },
    { id: 'cards', title: 'Картки', desc: 'Згадайте переклад, переверніть картку й чесно оцініть себе', icon: I.cards, meta: () => `${CARDS_LEN} карток` },
    { id: 'match', title: 'Пари', desc: 'З’єднайте терміни з перекладами якнайшвидше', icon: I.link, meta: () => { const b = store.get('safelex:matchBest', 0); return b ? `рекорд ${fmtTime(b)}` : `${MATCH_ROUNDS} раунди`; } },
    { id: 'sprint', title: 'Спринт', desc: `${SPRINT_SEC} секунд: переклад правильний чи ні?`, icon: I.bolt, meta: () => { const b = store.get('safelex:sprintBest', 0); return b ? `рекорд ${b}` : `${SPRINT_SEC} с`; } },
    { id: 'mistakes', title: 'Помилки', desc: 'Терміни, у яких ви помилялися', icon: I.redo, meta: cat => nTerms(mistakesIn(cat).length) }
  ];

  function renderTrainHub(cat) {
    if (cat) trainCat = cat;
    if (trainCat === 'fav' ? favs.size < 2 : trainCat === 'core' ? !CORE.length : trainCat !== 'all' && !catById[trainCat]) trainCat = 'all';
    store.set('safelex:trainCat', trainCat);
    const pool = poolFor(trainCat), mist = mistakesIn(trainCat).length;
    const cats = [['all', 'Усі розділи'], ...(CORE.length ? [['core', `Ключові · ${CORE.length}`]] : []), ...(favs.size >= 2 ? [['fav', `Збережені · ${favs.size}`]] : []), ...CATEGORIES.map(c => [c.id, short(c)])];
    const tile = (m, big) => {
      const off = m.id === 'mistakes' && !mist;
      return `<a class="mode m-${m.id} ${big ? 'big' : ''} ${off ? 'off' : ''}" ${off ? 'aria-disabled="true"' : `href="#/train/${m.id}?cat=${trainCat}"`}>
        <span class="mode-ic">${m.icon}</span>
        <span class="mode-body"><b>${m.title}</b><span>${off ? 'Поки що помилок немає' : m.desc}</span></span>
        ${off ? '' : `<span class="mode-meta">${m.meta(trainCat)}</span>`}
      </a>`;
    };
    app.innerHTML = `
      <header class="hero" style="gap:14px">
        <h1>Тренажер</h1>
        <p class="lead">Оберіть розділ і режим · ${nTerms(pool.length)}</p>
        <div class="chips scroll">${cats.map(([id, l]) => `<button class="chip ${trainCat === id ? 'active' : ''}" data-tcat="${id}">${esc(l)}</button>`).join('')}</div>
      </header>
      <section class="section">
        ${tile(MODES[0], true)}
        <div class="modes">${MODES.slice(1).map(m => tile(m)).join('')}</div>
      </section>`;
  }

  // Верхня панель режиму: закрити · прогрес · лічильник
  const trainBar = (title, pos, total, counter, exit = '#/train') => `
    <div class="topbar">
      <a class="icon-btn" href="${exit}" aria-label="Закрити">${I.close}</a>
      <div class="progress"><div style="width:${total ? Math.min(pos / total, 1) * 100 : 0}%"></div></div>
      <span class="counter">${counter ?? `${pos}/${total}`}</span>
    </div>
    <span class="mode-title">${title}</span>`;
  const emptyMode = (title, head, text) => `<div class="trainer">${trainBar(title, 0, 0, '')}
    <div class="empty-box"><span class="eb-ic">${I.check}</span><b>${head}</b><span>${text}</span></div>
    <a class="btn ghost" href="#/train">До режимів</a></div>`;
  const missList = list => list.length ? `
    <div class="miss">
      <span class="label">Варто повторити</span>
      ${list.map(t => `<a href="#/term/${t.id}"><b class="mono">${esc(t.en)}</b><span>${esc(t.ua)}</span></a>`).join('')}
    </div>` : '';

  function runMode(mode, cat) {
    cat = cat || trainCat;
    if (mode === 'daily') return startQuiz('daily', 'all');
    if (mode === 'quiz' || mode === 'mistakes') return startQuiz(mode, cat);
    if (mode === 'cards') return startCards(cat);
    if (mode === 'match') return startMatch(cat);
    if (mode === 'sprint') return startSprint(cat);
    location.hash = '#/train';
  }

  /* ---------- Тест, Помилки, Завдання дня ---------- */
  const tr = { mode: 'quiz', cat: 'all', qs: [], base: 0, i: 0, score: 0, ans: null, done: false, missed: [], rank: null };
  const QUIZ_TITLE = { quiz: 'Тест', mistakes: 'Робота над помилками', daily: 'Завдання дня' };

  function startQuiz(mode, cat) {
    Object.assign(tr, { mode, cat, i: 0, score: 0, ans: null, done: false, missed: [], rank: null, gained: 0, learned: 0 });
    if (mode === 'daily') tr.qs = dailyTerms().map(t => makeQuestion(t, null, true));
    else if (mode === 'mistakes') tr.qs = shuffle(mistakesIn(cat)).slice(0, QUIZ_LEN).map(t => makeQuestion(t, 'en2ua'));
    else tr.qs = pickTerms(poolFor(cat), QUIZ_LEN).map(t => makeQuestion(t));
    tr.base = tr.qs.length;
    drawQuiz();
  }

  function answer(right, extra) {
    const q = tr.qs[tr.i];
    app.classList.remove('enter'); // відповідь одразу після відкриття — без повторної «появи» екрана
    tr.ans = Object.assign({ right }, extra);
    vibrate(right ? 25 : [40, 60, 40]);
    if (!q.retry) {
      tr.ans.g = grade(q.t.id, right);
      if (tr.ans.g.gain > 0) tr.gained++;
      if (tr.ans.g.mastered) tr.learned++;
      if (right) tr.score++;
      else {
        tr.missed.push(q.t);
        // Помилку повторюємо через 3 питання, в іншому напрямку — так термін краще запам’ятовується
        tr.qs.splice(Math.min(tr.i + 3, tr.qs.length), 0, Object.assign(makeQuestion(q.t, q.kind === 'en2ua' ? 'ua2en' : 'en2ua'), { retry: true }));
      }
    }
    drawQuiz();
    document.querySelector('[data-action="next"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function nextQuestion() {
    tr.ans = null;
    if (++tr.i >= tr.qs.length) {
      tr.done = true; tr.i = tr.qs.length - 1;
      if (tr.mode === 'daily') tr.rank = finishDaily(tr.score, tr.base);
    }
    drawQuiz();
    window.scrollTo(0, 0);
    if (tr.done && tr.rank) setTimeout(() => { if (inTrainMode('daily')) celebrate(tr.rank); }, 350);
  }

  function submitTyped(giveUp) {
    const typed = giveUp ? '' : (document.getElementById('ans')?.value || '');
    if (!giveUp && !typed.trim()) return;
    answer(typedRight(typed, tr.qs[tr.i].t), { typed });
  }

  function drawQuiz() {
    const title = QUIZ_TITLE[tr.mode] + (tr.mode === 'daily' ? '' : ` · ${catTitle(tr.cat)}`);
    const exit = tr.mode === 'daily' ? '#/' : '#/train';
    if (!tr.qs.length) { app.innerHTML = tr.mode === 'mistakes'
      ? emptyMode(QUIZ_TITLE[tr.mode], 'Помилок поки немає', 'Сюди потраплять терміни, у яких ви помилитеся в тесті, картках, парах чи спринті.')
      : emptyMode(QUIZ_TITLE[tr.mode], 'Термінів немає', 'У цьому розділі поки немає термінів — оберіть інший.'); return; }
    const total = tr.qs.length, pos = tr.done ? total : tr.i + (tr.ans ? 1 : 0);
    app.innerHTML = `<div class="trainer ${tr.ans || tr.done ? '' : 'q-in'}">${trainBar(title, pos, total, null, exit)}${tr.done ? quizResult() : quizBody()}</div>`;
    const input = document.getElementById('ans');
    if (input) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(false); } });
      input.focus({ preventScroll: true });
    }
  }

  function quizBody() {
    const q = tr.qs[tr.i], a = tr.ans, t = q.t;
    let answers;
    if (q.kind === 'type') {
      answers = a
        ? `<div class="typed ${a.right ? 'ok' : 'bad'}">${esc(a.typed) || '—'}</div>`
        : `<input id="ans" class="type-input" type="text" placeholder="Ваша відповідь" aria-label="Відповідь англійською" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
           <div class="row-btns">
             <button class="btn ghost" data-action="giveup">Не знаю</button>
             <button class="btn" data-action="check">Перевірити</button>
           </div>`;
    } else {
      answers = `<div class="options">${q.options.map((o, n) => {
        const cls = !a ? '' : o.id === t.id ? 'ok' : o.id === a.picked ? 'bad' : 'dim';
        return `<button class="opt ${cls}" data-pick="${o.id}" ${a ? 'disabled' : ''}><span class="key">${n + 1}</span><span class="txt">${esc(o[q.key])}</span></button>`;
      }).join('')}</div>`;
    }
    return `
      <div class="q-card ${q.kind === 'context' ? 'ctx' : ''}">
        <span class="label">${q.retry ? 'Ще раз · ' : ''}${q.label}</span>
        <span class="q">${esc(q.ask)}</span>
        ${q.hint ? `<span class="hint">${esc(q.hint)}</span>` : ''}
      </div>
      ${answers}
      ${a ? `
        <div class="feedback ${a.right ? 'ok' : 'bad'}">
          <b>${a.right ? 'Правильно!' : 'Запам’ятайте:'}</b>
          <span><b class="mono">${esc(t.en)}</b> — ${esc(t.ua)}${t.full && q.kind !== 'en2ua' ? ` · ${esc(t.full)}` : ''}</span>
          ${!a.right && t.exEn ? `<span class="fb-ex">“${esc(t.exEn)}”</span>` : ''}
          ${a.g ? `<span class="fb-progress">${checksHtml(a.g.checks)}<span>${
            a.g.mastered ? 'Термін вивчено'
            : a.g.gain > 0 ? `+1 галочка · ще ${MASTERED - a.g.checks} ${plural(MASTERED - a.g.checks, 'день', 'дні', 'днів')}`
            : a.g.gain < 0 ? '−1 галочка'
            : a.right ? (a.g.checks >= MASTERED ? 'Вже вивчено' : 'Сьогодні вже зараховано — приходьте завтра') : 'Галочок поки немає'}</span></span>` : ''}
        </div>
        <button class="btn" data-action="next">${tr.i + 1 < tr.qs.length ? 'Далі' : 'Результат'}</button>` : ''}`;
  }

  // Підсумок для екрана результату: скільки галочок здобуто сьогодні
  const gainLine = (gained, learned) => gained || learned
    ? `<span class="res-gain"><i>${I.check}</i>+${gained} ${plural(gained, 'галочка', 'галочки', 'галочок')}${learned ? ` · ${learned} ${plural(learned, 'термін', 'терміни', 'термінів')} вивчено` : ''}</span>`
    : `<span class="res-gain muted">Нових галочок немає — сьогодні ці терміни вже зараховано</span>`;

  function quizResult() {
    const pct = tr.base ? tr.score / tr.base : 0;
    const daily = tr.mode === 'daily', days = streak();
    const msg = daily ? 'Завдання дня виконано!'
      : pct >= 0.9 ? 'Майже без помилок.' : pct >= 0.6 ? 'Непогано. Помилки повторимо найближчим часом.' : 'Ці терміни варто повторити.';
    return `
      <div class="result-screen">
        <span class="score">${tr.score}/${tr.base}</span>
        <span class="msg">${msg}</span>
        ${daily ? `<span class="res-fire">${I.flame}${nDays(days)} поспіль</span>` : ''}
        ${gainLine(tr.gained, tr.learned)}
      </div>
      ${missList(tr.missed)}
      ${daily ? `<a class="btn" href="#/">Готово</a>` : `
        <button class="btn" data-action="restart">Ще раз</button>
        <a class="btn ghost" href="#/train">Інший режим</a>`}`;
  }

  /* ---------- Картки ---------- */
  // Екран будується один раз; після кожної оцінки оновлюються лише колода й лічильники — без «смикання»
  const cd = { cat: 'all', deck: [], i: 0, flipped: false, known: 0, again: 0, requeued: new Set() };

  function startCards(cat) {
    Object.assign(cd, { cat, deck: pickTerms(poolFor(cat), CARDS_LEN), i: 0, flipped: false, known: 0, again: 0, gained: 0, learned: 0, busy: false, requeued: new Set() });
    drawCards();
  }

  function rateCard(knows) {
    const t = cd.deck[cd.i];
    const g = grade(t.id, knows);
    if (g.gain > 0) cd.gained++;
    if (g.mastered) cd.learned++;
    if (knows) cd.known++;
    else {
      cd.again++;
      // «Ще вчу» — картка повернеться в кінці колоди (один раз)
      if (!cd.requeued.has(t.id)) { cd.requeued.add(t.id); cd.deck.push(t); }
    }
    cd.i++; cd.flipped = false;
    if (cd.i >= cd.deck.length) drawCards(); else nextCard();
  }

  // Верхня картка + дві картки позаду.
  // mode 'first' — колода щойно з'явилась: картка піднімається зі стосу.
  // mode 'next' — стос уже підсунувся під час вильоту: на місці верхньої лежить сорочка (d0),
  // і нова картка м'яко проявляється поверх неї — без стрибка між старим і новим DOM.
  const FLY_MS = 380; // тривалість вильоту картки й підсування стосу (= flyYes/flyNo і promote у CSS)
  // Розмір шрифту на картці: довгий текст або одне довге слово («пожежонебезпечні») — дрібніше, щоб слово не рвалося посередині
  const longestWord = str => Math.max(0, ...String(str).split(/[\s\-–—/]+/).map(w => w.length));
  const enCls = str => str.length > 28 || longestWord(str) > 14 ? 'long' : '';
  const uaCls = str => str.length > 60 || longestWord(str) > 18 ? 'xl' : str.length > 30 || longestWord(str) > 13 ? 'mid' : '';

  // Обидва боки картки — в одних пропорціях: розмір беремо за довшим із двох текстів
  const SIZE_RANK = { '': 0, long: 1, mid: 1, xl: 2 }, SIZE_CLS = ['', 'mid', 'xl'];
  const pairCls = (en, ua) => SIZE_CLS[Math.max(SIZE_RANK[enCls(en)], SIZE_RANK[uaCls(ua)])];

  function deckHtml(mode) {
    const t = cd.deck[cd.i], behind = cd.deck.slice(cd.i + 1, cd.i + 3);
    const ua = t.uaShort || t.ua, big = pairCls(t.en, ua);
    const exLong = Math.max((t.exEn || '').length, (t.exUa || '').length) > 90 ? 'long' : '';
    const back = cls => `<div class="deck-back ${cls}"><i class="db-emb"></i><i class="db-cap">ДСНС · SafeLex</i></div>`;
    return `${behind.map((n, k) => back(`d${k + 1}`)).reverse().join('')}${mode === 'next' ? back('d0') : ''}
      <button class="flash ${toneOf(t.cat)} ${mode === 'next' ? 'reveal' : 'enter'}" data-action="flip" aria-label="Перевернути картку">
        <div class="flash-inner">
          <div class="flash-face flash-front">
            <span class="flash-cat">${esc(catTitle(t.cat))}</span>
            <span class="big ${big}">${esc(t.en)}</span>
            ${t.tr ? `<span class="ipa">${esc(t.tr)}</span>` : ''}
            ${t.full ? `<span class="small">${esc(t.full)}</span>` : ''}
            ${t.exEn ? `<span class="flash-ex ${exLong}">“${esc(t.exEn)}”</span>` : ''}
            <span class="tap">Торкніться, щоб перевернути</span>
          </div>
          <div class="flash-face flash-back">
            <span class="flash-cat">Переклад</span>
            <span class="big ${big}">${esc(ua)}</span>
            ${(t.senses || []).length > 1 ? `<span class="small">${esc(t.senses.slice(1).join('; '))}</span>` : ''}
            ${t.exUa ? `<span class="flash-ex ${exLong}">«${esc(t.exUa)}»</span>` : ''}
            <span class="tap">Торкніться, щоб повернути</span>
          </div>
        </div>
        <span class="stamp s-yes">Знаю</span><span class="stamp s-no">Ще вчу</span>
      </button>`;
  }

  function drawCards() {
    const title = `Картки · ${catTitle(cd.cat)}`;
    if (!cd.deck.length) { app.innerHTML = emptyMode('Картки', 'Термінів немає', 'У цьому розділі поки немає термінів — оберіть інший.'); return; }
    const total = cd.deck.length;
    if (cd.i >= total) {
      app.innerHTML = `<div class="trainer">${trainBar(title, total, total)}
        <div class="result-screen">
          <span class="score">${cd.known}</span>
          <span class="msg">${plural(cd.known, 'картку', 'картки', 'карток')} ви знаєте${cd.again ? ` · ${cd.again} ще вчите` : ''}</span>
          ${gainLine(cd.gained, cd.learned)}
        </div>
        <button class="btn" data-action="restart">Нова колода</button>
        <a class="btn ghost" href="#/train">Інший режим</a></div>`;
      return;
    }
    app.innerHTML = `<div class="trainer">${trainBar(title, cd.i, total, `${cd.i + 1}/${total}`)}
      <div class="deck" id="deck">${deckHtml('first')}</div>
      <div class="card-tally"><span class="no" id="cNo">Ще вчу · ${cd.again}</span><span class="hint">← свайп →</span><span class="yes" id="cYes">Знаю · ${cd.known}</span></div>
      <div class="row-btns">
        <button class="btn no" data-action="card-no">Ще вчу</button>
        <button class="btn yes" data-action="card-yes">Знаю</button>
      </div></div>`;
  }

  // Наступна картка: міняємо тільки колоду, прогрес і лічильники
  function nextCard() {
    const deck = document.getElementById('deck');
    if (!deck) return drawCards();
    const total = cd.deck.length;
    const burst = deck.querySelector('.burst');
    const was = deck.offsetHeight;
    deck.classList.remove('advance', 'dragging'); deck.classList.add('settled');
    deck.style.height = ''; deck.style.removeProperty('--p');
    deck.innerHTML = deckHtml('next');
    if (burst) deck.appendChild(burst); // сплеск догорає поверх нової картки
    // Нова картка іншої висоти: колода плавно підлаштовується, а кнопки під нею не стрибають
    const now = deck.offsetHeight;
    if (Math.abs(now - was) > 2) {
      deck.style.height = was + 'px'; void deck.offsetHeight;
      deck.style.height = now + 'px';
      clearTimeout(deck._h); deck._h = setTimeout(() => { deck.style.height = ''; }, 360);
    }
    const bar = document.querySelector('.trainer .progress div'), counter = document.querySelector('.trainer .counter');
    if (bar) bar.style.width = cd.i / total * 100 + '%';
    if (counter) counter.textContent = `${cd.i + 1}/${total}`;
    const tally = (id, text) => {
      const el = document.getElementById(id);
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    };
    tally('cNo', `Ще вчу · ${cd.again}`);
    tally('cYes', `Знаю · ${cd.known}`);
  }

  // Картка плавно відлітає вправо («Знаю») або вліво («Ще вчу»), а стос одночасно підсувається вгору
  function flyCard(knows) {
    if (cd.busy) return;
    const card = document.querySelector('.deck .flash');
    const deck = document.getElementById('deck');
    cd.busy = true;
    drag = null;
    if (card) {
      card.classList.remove('enter', 'reveal', 'lift', 'dragging');
      card.style.transform = '';
      // без свайпу (кнопка чи стрілка) картка стартує з місця — інша крива розгону
      card.classList.toggle('from-rest', !card.style.getPropertyValue('--dx'));
      card.classList.add(knows ? 'fly-yes' : 'fly-no');
    }
    vibrate(knows ? 20 : [30, 40, 30]);
    // «Сплеск» у центрі колоди: зелена ✓ або червона ↺
    if (deck) {
      deck.classList.remove('dragging');
      deck.classList.add('advance');
      const b = document.createElement('span');
      b.className = 'burst ' + (knows ? 'yes' : 'no');
      b.innerHTML = knows ? I.check : I.redo;
      deck.appendChild(b);
      setTimeout(() => b.remove(), 700);
    }
    setTimeout(() => { cd.busy = false; if (inTrainMode('cards')) rateCard(knows); }, card ? FLY_MS : 0);
  }

  // Свайп картки пальцем. Позиція малюється раз на кадр (rAF); швидкий змах зараховується й на коротшій відстані
  const SWIPE_DIST = 90, FLICK_DIST = 40, FLICK_SPEED = .5; // px, px, px/мс
  let drag = null, dragMoved = false, dragFrame = 0;
  const resetDrag = card => {
    card.style.transform = ''; ['--yes', '--no', '--dx', '--rot'].forEach(v => card.style.removeProperty(v));
    const deck = card.closest('.deck');
    if (deck) { deck.classList.remove('dragging'); deck.style.removeProperty('--p'); } // стос пружно опускається назад
  };
  function paintDrag() {
    dragFrame = 0;
    if (!drag || !dragMoved) return;
    const { card, dx } = drag, rot = dx / 18;
    card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
    card.style.setProperty('--dx', dx + 'px'); card.style.setProperty('--rot', rot + 'deg');
    card.style.setProperty('--yes', Math.max(0, Math.min(1, dx / SWIPE_DIST)));
    card.style.setProperty('--no', Math.max(0, Math.min(1, -dx / SWIPE_DIST)));
    card.parentElement.style.setProperty('--p', Math.min(1, Math.abs(dx) / (SWIPE_DIST * 1.6)));
  }
  document.addEventListener('pointerdown', e => {
    const card = e.target.closest('.deck .flash');
    if (!card || cd.busy || (e.button && e.pointerType === 'mouse')) return;
    drag = { card, x: e.clientX, y: e.clientY, dx: 0, t: e.timeStamp, v: 0 }; dragMoved = false;
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragMoved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // це вертикальне гортання сторінки
      dragMoved = true;
      // анімації «появи» і «підйому» сильніші за inline-transform — знімаємо, щоб картка йшла за пальцем
      drag.card.classList.remove('enter', 'reveal', 'lift'); drag.card.classList.add('dragging');
      drag.card.parentElement.classList.add('dragging');
    }
    const dt = e.timeStamp - drag.t;
    if (dt > 0) drag.v = drag.v * .5 + (dx - drag.dx) / dt * .5; // згладжена швидкість
    drag.dx = dx; drag.t = e.timeStamp;
    if (!dragFrame) dragFrame = requestAnimationFrame(paintDrag);
  });
  const endDrag = () => {
    if (!drag) return;
    const { card, dx, v } = drag; drag = null;
    if (dragFrame) { cancelAnimationFrame(dragFrame); dragFrame = 0; }
    card.classList.remove('dragging');
    const flick = Math.abs(dx) > FLICK_DIST && Math.abs(v) > FLICK_SPEED && Math.sign(v) === Math.sign(dx);
    if (Math.abs(dx) > SWIPE_DIST || flick) {
      card.style.setProperty('--dx', dx + 'px'); card.style.setProperty('--rot', dx / 18 + 'deg');
      flyCard(dx > 0);
    } else resetDrag(card);
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  /* ---------- Пари ---------- */
  // Раунди по 5 пар: торкніться терміна, потім його перекладу. Швидше й без помилок — краще.
  // Сітка малюється лише на початку раунду; далі змінюються тільки ті плитки, яких торкнулись
  const mt = { cat: 'all', rounds: [], r: 0, left: [], right: [], sel: null, matched: new Set(), bad: new Set(), mistakes: 0, start: 0, time: 0, over: false, record: false, busy: false };

  function startMatch(cat) {
    stopTicker();
    // Для гри на швидкість — терміни з коротким перекладом (якщо таких вистачає) і без однакових перекладів
    const seen = new Set(), all = poolFor(cat), shortOnes = all.filter(t => (t.uaShort || t.ua).length <= 45);
    const terms = pickTerms(shortOnes.length >= MATCH_PAIRS * 2 ? shortOnes : all, MATCH_ROUNDS * MATCH_PAIRS * 2)
      .filter(t => { const k = sense(t.uaShort || t.ua); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, MATCH_ROUNDS * MATCH_PAIRS);
    const rounds = [];
    for (let i = 0; i < terms.length; i += MATCH_PAIRS) rounds.push(terms.slice(i, i + MATCH_PAIRS));
    if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) rounds[rounds.length - 2].push(...rounds.pop());
    Object.assign(mt, { cat, rounds, r: 0, sel: null, bad: new Set(), mistakes: 0, start: Date.now(), time: 0, over: false, record: false, busy: false });
    if (terms.length >= 2) { setRound(); ticker = setInterval(tickMatch, 1000); }
    drawMatch();
  }

  function setRound() {
    const round = mt.rounds[mt.r];
    mt.left = shuffle(round); mt.right = shuffle(round); mt.matched = new Set(); mt.sel = null;
  }

  function tickMatch() {
    const el = document.querySelector('.counter');
    if (el && !mt.over) el.textContent = fmtTime(Math.floor((Date.now() - mt.start) / 1000));
  }

  const tileEl = (side, id) => document.querySelector(`.tile[data-mt="${side}"][data-id="${id}"]`);

  // Прогрес-бар і лічильник помилок
  function updateMatchHud() {
    const done = mt.rounds.slice(0, mt.r).reduce((n, r) => n + r.length, 0) + mt.matched.size;
    const total = mt.rounds.reduce((n, r) => n + r.length, 0);
    const bar = document.querySelector('.trainer .progress div'), miss = document.querySelector('.mt-miss');
    if (bar) bar.style.width = done / total * 100 + '%';
    if (miss) { miss.lastChild.textContent = mt.mistakes; miss.classList.toggle('has', mt.mistakes > 0); }
  }

  function matchTap(side, id) {
    if (mt.over || mt.busy || mt.matched.has(id)) return;
    const el = tileEl(side, id);
    if (!el) return;
    // Перший вибір (або інший вибір з того самого стовпця)
    if (!mt.sel || mt.sel.side === side) {
      const same = mt.sel && mt.sel.id === id;
      if (mt.sel) tileEl(mt.sel.side, mt.sel.id)?.classList.remove('sel');
      mt.sel = same ? null : { side, id };
      if (!same) el.classList.add('sel');
      return;
    }
    const other = tileEl(mt.sel.side, mt.sel.id), pair = [el, other].filter(Boolean);
    pair.forEach(t => t.classList.remove('sel'));
    if (mt.sel.id === id) {
      // Правильна пара: лише ці дві плитки стають зеленими й згасають
      mt.matched.add(id); mt.sel = null; vibrate(20);
      grade(id, !mt.bad.has(id));
      pair.forEach(t => { t.classList.add('ok'); t.disabled = true; });
      updateMatchHud();
      if (mt.matched.size === mt.rounds[mt.r].length) {
        mt.busy = true;
        const last = mt.r + 1 >= mt.rounds.length;
        setTimeout(() => { if (inTrainMode('match')) document.querySelector('.match')?.classList.add('leaving'); }, 380);
        setTimeout(() => {
          mt.busy = false;
          if (!inTrainMode('match')) return;
          mt.r++;
          if (last) finishMatch(); else setRound();
          drawMatch();
        }, 680);
      }
    } else {
      // Помилка: обидві плитки коротко трусяться червоним, решта не змінюється
      mt.mistakes++; vibrate([40, 60, 40]);
      mt.bad.add(mt.sel.id); mt.bad.add(id); mt.sel = null;
      pair.forEach(t => t.classList.add('bad'));
      updateMatchHud();
      setTimeout(() => pair.forEach(t => t.classList.remove('bad')), 420);
    }
  }

  function finishMatch() {
    stopTicker();
    mt.over = true; mt.time = Math.max(1, Math.round((Date.now() - mt.start) / 1000));
    const best = store.get('safelex:matchBest', 0);
    if (!best || mt.time < best) { mt.record = !!best; store.set('safelex:matchBest', mt.time); }
  }

  function drawMatch() {
    const title = `Пари · ${catTitle(mt.cat)}`;
    if (!mt.rounds.length || mt.rounds[0].length < 2) { app.innerHTML = emptyMode('Пари', 'Замало термінів', 'Для гри в пари потрібно щонайменше 2 терміни.'); return; }
    if (mt.over) {
      const best = store.get('safelex:matchBest', 0);
      app.innerHTML = `<div class="trainer">${trainBar(title, 1, 1, fmtTime(mt.time))}
        <div class="result-screen">
          <span class="score">${fmtTime(mt.time)}</span>
          <span class="msg">${mt.record ? 'Новий рекорд!' : `Рекорд: ${fmtTime(best)}`} · ${mt.mistakes ? `${mt.mistakes} ${plural(mt.mistakes, 'помилка', 'помилки', 'помилок')}` : 'без жодної помилки'}</span>
        </div>
        ${missList(mt.rounds.flat().filter(t => mt.bad.has(t.id)))}
        <button class="btn" data-action="restart">Ще раз</button>
        <a class="btn ghost" href="#/train">Інший режим</a></div>`;
      return;
    }
    const done = mt.rounds.slice(0, mt.r).reduce((n, r) => n + r.length, 0);
    const total = mt.rounds.reduce((n, r) => n + r.length, 0);
    app.innerHTML = `<div class="trainer">${trainBar(title, done, total, fmtTime(Math.floor((Date.now() - mt.start) / 1000)))}
      <div class="match-head">
        <span class="rounds">${mt.rounds.map((_, i) => `<i class="${i < mt.r ? 'done' : i === mt.r ? 'cur' : ''}"></i>`).join('')}<b>Раунд ${mt.r + 1} з ${mt.rounds.length}</b></span>
        <span class="mt-miss ${mt.mistakes ? 'has' : ''}">${I.x}<span>${mt.mistakes}</span></span>
      </div>
      <div class="match entering">
        ${mt.left.map((l, i) => {
          const r = mt.right[i];
          return `<button class="tile en" style="--i:${i}" data-mt="l" data-id="${l.id}">${esc(l.en)}</button>` +
            `<button class="tile" style="--i:${i}" data-mt="r" data-id="${r.id}">${esc(r.uaShort || r.ua)}</button>`;
        }).join('')}
      </div>
      <span class="meta dark match-hint">Торкніться терміна, а потім його перекладу</span></div>`;
    // після каскадної появи прибираємо клас, щоб анімація не повторювалась
    setTimeout(() => document.querySelector('.match.entering')?.classList.remove('entering'), 700);
  }

  /* ---------- Спринт ---------- */
  // 60 секунд: показано термін і переклад — правильний він чи ні. Помилки йдуть у «Помилки».
  const sp = { cat: 'all', pool: [], started: false, over: false, left: SPRINT_SEC, score: 0, total: 0, pair: null, flash: '', missed: [], record: false };

  function startSprint(cat) {
    stopTicker();
    Object.assign(sp, { cat, pool: poolFor(cat), started: false, over: false, left: SPRINT_SEC, score: 0, total: 0, pair: null, flash: '', missed: [], record: false });
    drawSprint();
  }

  function goSprint() {
    Object.assign(sp, { started: true, over: false, left: SPRINT_SEC, score: 0, total: 0, flash: '', missed: [], record: false, pair: null });
    nextPair(); drawSprint();
    stopTicker();
    ticker = setInterval(() => {
      if (--sp.left <= 0) {
        stopTicker(); sp.over = true;
        const best = store.get('safelex:sprintBest', 0);
        if (sp.score > best) { sp.record = best > 0; store.set('safelex:sprintBest', sp.score); }
        drawSprint(); return;
      }
      const c = document.querySelector('.counter'), bar = document.querySelector('.trainer .progress div');
      if (c) c.textContent = sp.left + ' с';
      if (bar) bar.style.width = (SPRINT_SEC - sp.left) / SPRINT_SEC * 100 + '%';
    }, 1000);
  }

  function nextPair() {
    const prev = sp.pair?.t;
    let t;
    do t = sp.pool[Math.floor(Math.random() * sp.pool.length)]; while (t === prev && sp.pool.length > 1);
    const fake = Math.random() < 0.5 ? distractors(t, 'uaShort', 1)[0] : null;
    sp.pair = { t, ua: (fake || t).uaShort || (fake || t).ua, truth: !fake };
  }

  function sprintAnswer(saysTrue) {
    const p = sp.pair, right = saysTrue === p.truth;
    app.classList.remove('enter');
    sp.total++;
    if (right) { sp.score++; vibrate(15); logAnswer(true); }
    else { vibrate([40, 60, 40]); grade(p.t.id, false); if (!sp.missed.includes(p.t)) sp.missed.push(p.t); }
    sp.flash = right ? 'ok' : 'bad';
    nextPair(); drawSprint();
  }

  function drawSprint() {
    const title = `Спринт · ${catTitle(sp.cat)}`, best = store.get('safelex:sprintBest', 0);
    if (sp.pool.length < 2) { app.innerHTML = emptyMode('Спринт', 'Замало термінів', 'Для спринту потрібно щонайменше 2 терміни.'); return; }
    let body;
    if (!sp.started) body = `
      <div class="q-card">
        <span class="label">${SPRINT_SEC} секунд</span>
        <span class="q">Вірно чи ні?</span>
        <span class="hint">Бачите термін і переклад — вирішуйте якомога швидше, чи переклад правильний.</span>
      </div>
      <ul class="sp-rules">
        <li><span class="sp-k yes">Так</span>переклад правильний <kbd>→</kbd></li>
        <li><span class="sp-k no">Ні</span>переклад хибний <kbd>←</kbd></li>
        <li><span class="sp-k">${I.redo}</span>помилки потрапляють у режим «Помилки»</li>
        ${best ? `<li><span class="sp-k">${I.bolt}</span>ваш рекорд — ${best} ${plural(best, 'правильна відповідь', 'правильні відповіді', 'правильних відповідей')}</li>` : ''}
      </ul>
      <button class="btn" data-action="sprint-go">Старт</button>`;
    else if (sp.over) body = `
      <div class="result-screen">
        <span class="score">${sp.score}</span>
        <span class="msg">${sp.record ? 'Новий рекорд!' : `правильних із ${sp.total} · рекорд ${Math.max(best, sp.score)}`}</span>
      </div>
      ${missList(sp.missed)}
      <button class="btn" data-action="sprint-go">Ще раз</button>
      <a class="btn ghost" href="#/train">Інший режим</a>`;
    else body = `
      <div class="q-card sp-card ${sp.flash}">
        <span class="label">Це правильний переклад?</span>
        <span class="q">${esc(sp.pair.t.en)}</span>
        <span class="sp-ua">${esc(sp.pair.ua)}</span>
      </div>
      <div class="row-btns">
        <button class="btn no" data-sprint="0">Ні</button>
        <button class="btn yes" data-sprint="1">Так</button>
      </div>
      <span class="sp-score">Рахунок: <b>${sp.score}</b></span>`;
    app.innerHTML = `<div class="trainer">${trainBar(title, sp.started ? SPRINT_SEC - sp.left : 0, SPRINT_SEC, `${sp.left} с`)}${body}</div>`;
  }

  /* =================== НАВІГАЦІЯ =================== */
  function route() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(qs || '');
    let tab = 'home';
    stopTicker();
    guideObs?.disconnect();
    document.querySelector('.celebrate')?.remove();
    document.body.classList.remove('dark');

    switch (parts[0]) {
      case undefined: case 'search':
        if (params.has('q')) lastQuery = params.get('q');
        renderHome();
        if (parts[0] === 'search') document.getElementById('q').focus(); // ярлик «Пошук» на іконці додатка
        break;
      case 'term': renderTerm(parts[1]); tab = null; break;
      case 'guide': parts[1] ? renderCategory(parts[1]) : renderGuide(); tab = 'guide'; break;
      case 'train':
        tab = 'train';
        if (parts[1] || params.get('mode')) { document.body.classList.add('dark'); runMode(parts[1] || params.get('mode'), params.get('cat')); }
        else renderTrainHub(params.get('cat'));
        break;
      case 'me': case 'fav': renderMe(); tab = 'me'; break;
      case 'stats': hmOffset = 0; hmSel = ''; renderStats(); tab = 'me'; break;
      case 'about': renderAbout(); tab = null; break;
      case 'demo': return seedDemo();
      default: renderHome();
    }
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    window.scrollTo(0, 0);
    // Плавна поява нового екрана
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    // Лише одна поява на екран — інакше анімація повторювалась би при кожному натисканні
    clearTimeout(route.enterTimer);
    route.enterTimer = setTimeout(() => app.classList.remove('enter'), 700);
  }

  /* ---------- Демо-режим (#/demo) ----------
     Для показу: серія DEMO_STREAK днів, DEMO_MASTERED вивчених термінів, ще частина — «вчу».
     Замінює поточний прогрес на пристрої (збережені терміни лишаються). Повернути — «Моє» → «Скинути прогрес». */
  const DEMO_STREAK = 456, DEMO_MASTERED = 1298, DEMO_LEARNING = 402;
  function seedDemo() {
    if (!confirm(`Демо-режим: серія ${nDays(DEMO_STREAK)} і ${nTerms(DEMO_MASTERED)} вивчено.\nПоточний прогрес на цьому пристрої буде замінено. Продовжити?`)) {
      location.replace('#/'); return;
    }
    const days = Array.from({ length: DEMO_STREAK }, (_, i) => dayKey(i + 1));
    const ids = shuffle(TERMS.map(t => t.id)), demo = {};
    ids.slice(0, DEMO_MASTERED).forEach(id => { demo[id] = { checks: MASTERED, day: dayKey(3), due: Date.now() + 5 * DAY, wrong: 0 }; });
    ids.slice(DEMO_MASTERED, DEMO_MASTERED + DEMO_LEARNING).forEach((id, i) => { demo[id] = { checks: 1 + i % 2, day: dayKey(1), due: Date.now() + (i % 3) * DAY, wrong: i % 4 ? 0 : 1 }; });
    const log = {};
    for (let i = 1; i <= 60; i++) { const a = 15 + (i * 7) % 40; log[dayKey(i)] = { a, r: Math.round(a * .82) }; }
    store.set('safelex:days', days);
    store.set('safelex:best', DEMO_STREAK);
    store.set('safelex:srs', demo);
    store.set('safelex:log', log);
    store.set('safelex:ranksSeen', RANKS.filter(r => r.days && r.days <= DEMO_STREAK).map(r => r.days));
    location.replace('#/');
    location.reload();
  }

  /* =================== НАТИСКАННЯ =================== */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action],[data-cat],[data-q],[data-pick],[data-tcat],[data-letter],[data-mt],[data-sprint],[data-day]');
    if (!el) return;
    const d = el.dataset;

    if (d.cat) { searchCat = d.cat; drawHome(); return; }
    if (d.q) { lastQuery = d.q; const i = document.getElementById('q'); if (i) i.value = d.q; drawHome(); return; }
    if (d.pick) { if (!tr.ans) answer(d.pick === tr.qs[tr.i].t.id, { picked: d.pick }); return; }
    if (d.tcat) { renderTrainHub(d.tcat); return; }
    if (d.letter) {
      gv.letter = gv.letter === d.letter ? '' : d.letter;
      document.querySelectorAll('[data-letter]').forEach(b => b.classList.toggle('active', b.dataset.letter === gv.letter));
      applyGuideFilter(); return;
    }
    if (d.mt) { matchTap(d.mt, d.id); return; }
    if (d.day) { showDay(d.day, el); return; }
    if (d.sprint) { if (ticker && !sp.over) sprintAnswer(d.sprint === '1'); return; }

    switch (d.action) {
      case 'back': goBack(); break;
      case 'tod-reveal': todShown = !todShown; el.classList.toggle('shown', todShown); el.setAttribute('aria-expanded', todShown); break;
      case 'hm-prev': drawHeatmap(1); break;
      case 'hm-next': drawHeatmap(-1); break;
      case 'clear': { const i = document.getElementById('q'); i.value = ''; lastQuery = ''; drawHome(); i.focus(); break; }
      case 'fav': {
        const id = d.id;
        favs.has(id) ? favs.delete(id) : favs.add(id); saveFavs();
        const on = favs.has(id);
        el.classList.toggle('on', on); el.setAttribute('aria-pressed', on);
        el.setAttribute('aria-label', on ? 'Прибрати зі збережених' : 'Зберегти');
        const label = el.querySelector('span'); if (label) label.textContent = on ? 'Збережено' : 'Зберегти';
        vibrate(15);
        break;
      }
      case 'install': if (installEvent) { installEvent.prompt(); installEvent.userChoice.finally(() => { installEvent = null; route(); }); } break;
      case 'hide-install': store.set('safelex:hideInstall', true); el.closest('.install-card')?.remove(); break;
      case 'next': nextQuestion(); break;
      case 'check': submitTyped(false); break;
      case 'giveup': submitTyped(true); break;
      case 'restart': route(); break;
      case 'flip':
        if (dragMoved) { dragMoved = false; break; }
        if (cd.busy) break;
        cd.flipped = !cd.flipped;
        el.classList.remove('enter', 'reveal', 'lift'); void el.offsetWidth; // перезапуск анімації «підйому»
        el.classList.toggle('flipped', cd.flipped); el.classList.add('lift');
        { const deck = el.closest('.deck'); deck?.classList.add('flipping'); clearTimeout(deck?._f); if (deck) deck._f = setTimeout(() => deck.classList.remove('flipping'), 650); }
        break;
      case 'card-yes': flyCard(true); break;
      case 'card-no': flyCard(false); break;
      case 'sprint-go': goSprint(); break;
      case 'tod-next': {
        const cur = todTerm || todPool()[hashStr(dayKey()) % todPool().length];
        todShown = false;
        todTerm = TERMS.length > 1 ? sample(todPool().length > 1 ? todPool() : TERMS, 1, t => t === cur)[0] || cur : cur;
        const box = document.querySelector('.tod');
        if (box) { box.outerHTML = termOfDayCard(); document.querySelector('.tod').classList.add('swap'); }
        break;
      }
      case 'recent-clear': recent.length = 0; store.set('safelex:recent', []); drawHome(); break;
      case 'cel-close': document.querySelector('.celebrate')?.remove(); break;
      case 'reset':
        if (confirm('Скинути весь прогрес навчання, серію днів і рекорди? Збережені терміни залишаться.')) {
          ['safelex:srs', 'safelex:days', 'safelex:best', 'safelex:ranksSeen', 'safelex:dailyScore', 'safelex:matchBest', 'safelex:sprintBest', 'safelex:log']
            .forEach(k => { try { localStorage.removeItem(k); } catch (err) { /* ігноруємо */ } });
          srs = {}; doneDays.clear(); for (const k in actLog) delete actLog[k]; renderMe();
        }
        break;
    }
  });

  /* ---------- Клавіатура на комп’ютері: 1–4 — відповідь, Enter — далі, ← → — спринт ---------- */
  document.addEventListener('keydown', e => {
    if (!location.hash.startsWith('#/train/') || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const btn = /^[1-4]$/.test(e.key) ? document.querySelector(`.opt:nth-child(${e.key}):not(:disabled)`)
      : e.key === 'Enter' ? document.querySelector('[data-action="next"],[data-action="sprint-go"]')
      : e.key === 'ArrowRight' ? document.querySelector('[data-sprint="1"],[data-action="card-yes"]')
      : e.key === 'ArrowLeft' ? document.querySelector('[data-sprint="0"],[data-action="card-no"]')
      : e.key === ' ' ? document.querySelector('.flash') : null;
    if (btn) { e.preventDefault(); btn.click(); }
  });

  window.addEventListener('hashchange', route);
  route();

  /* ---------- Екран завантаження ---------- */
  // sessionStorage може бути недоступний (приватний режим, заблоковані дані) — тоді заставка просто зникає
  const splash = document.getElementById('splash');
  let splashSeen = false;
  try { splashSeen = !!sessionStorage.getItem('safelex:splash'); sessionStorage.setItem('safelex:splash', '1'); } catch (e) { /* ігноруємо */ }
  if (splashSeen) splash.remove();
  else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }, 700);

  /* ---------- Офлайн-режим і автооновлення (service worker) ---------- */
  // Встановлений додаток (особливо на iPhone) часто не перезапускається днями,
  // а лише «прокидається» з фону. Тому при кожному поверненні в додаток
  // перевіряємо, чи не вийшла нова версія, і тихо оновлюємося.
  const BG_RELOAD_MS = 30 * 60 * 1000; // якщо додаток був у фоні довше 30 хв
  let hiddenAt = 0;
  let reloadPending = false;
  const inMode = () => location.hash.startsWith('#/train/');

  // Перезавантажуємо лише там, де користувач нічого не втратить (не посеред тренування)
  function safeReload() {
    if (inMode()) { reloadPending = true; showUpdateToast(); return; }
    location.reload();
  }

  function showUpdateToast() {
    if (document.querySelector('.update-toast')) return;
    const t = document.createElement('button');
    t.className = 'update-toast';
    t.innerHTML = '<b>Є оновлення</b><span>Натисніть, щоб застосувати</span>';
    t.addEventListener('click', () => location.reload());
    document.body.appendChild(t);
  }

  window.addEventListener('hashchange', () => { if (reloadPending && !inMode()) location.reload(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    // Новий service worker узяв керування → сторінка ще зі старими файлами, перезавантажуємо
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) safeReload(); });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
          if (!navigator.onLine) return;
          reg.update().catch(() => {});
          if (hiddenAt && Date.now() - hiddenAt > BG_RELOAD_MS) safeReload(); // свіжі терміни після довгої паузи
        });
      }).catch(() => {});
    });
  }
})();
