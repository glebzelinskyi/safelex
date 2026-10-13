import { store } from '../core/store.js';
import { DAY } from '../core/dates.js';
import { esc, nDays, nTerms } from '../core/util.js';
import { favs } from '../user.js';
import { srs } from '../learn/srs.js';
import { doneDays } from '../learn/streak.js';
import { MAX_BACKUP_CHARS, BackupError, backupDue, backupName, buildBackup, lastBackupAt, markBackedUp, restoreBackup, snoozeBackup } from '../learn/backup.js';
import { onAction } from './events.js';

const HINT_DAYS = 7;
const RESTORED_KEY = 'safelex:restored';
const ERRORS = {
  format: 'Це не файл прогресу SafeLex. Виберіть файл safelex-progress-….txt, який ви зберегли раніше.',
  version: 'Цей файл створено новішою версією SafeLex. Оновіть застосунок і спробуйте ще раз.',
  write: 'Не вдалося записати прогрес: браузер не дає зберегти дані. Вийдіть із приватного режиму або звільніть місце на пристрої.'
};

export function backupCard() {
  if (!backupDue()) return '';
  return `
    <div class="backup-card">
      <b>Збережіть прогрес</b>
      <span>Він зберігається лише на цьому телефоні. Надішліть файл собі в Telegram → «Збережене».</span>
      <span class="row-btns"><button class="btn" data-action="backup-save">Зберегти</button><button class="btn outline" data-action="backup-later">Пізніше</button></span>
    </div>`;
}

/** Рядок для тих, хто щойно встановив застосунок на новий телефон. */
export function restoreHint() {
  if (doneDays.size || favs.size || Object.keys(srs).length) return '';
  const now = Date.now(), first = store.get('safelex:firstSeen', 0);
  // Напряму, а не через store: якщо сховище недоступне, плашка про збій запису тут зайва.
  if (!first) try { localStorage.setItem('safelex:firstSeen', String(now)); } catch {}
  else if (now - first > HINT_DAYS * DAY) return '';
  return `<p class="restore-hint">Вже займалися раніше? <button class="link-sm" data-action="backup-restore">Відновити з файлу</button></p>`;
}

export function lastBackupText() {
  const at = lastBackupAt(), ago = Math.floor((Date.now() - at) / DAY);
  return !at || ago < 0 ? 'Копію ще не зберігали' : `Остання копія: ${ago ? `${nDays(ago)} тому` : 'сьогодні'}`;
}

function toast(title, text) {
  document.querySelector('.note-toast')?.remove();
  const t = document.createElement('button');
  t.className = 'note-toast';
  t.innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span>`;
  t.addEventListener('click', () => t.remove());
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 7000);
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Повертає 'shared', 'downloaded' або '' (користувач закрив меню «Поділитися»). */
async function exportBackup() {
  const text = buildBackup(), name = backupName();
  let file = null;
  try { file = new File([text], name, { type: 'text/plain' }); } catch {}
  let canShare = false;
  try { canShare = !!file && !!navigator.share && navigator.canShare?.({ files: [file] }); } catch {}
  if (canShare) {
    try { await navigator.share({ files: [file] }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError' || e?.name === 'InvalidStateError') return ''; }
  }
  download(text, name);
  return 'downloaded';
}

let saving = false;
onAction('backup-save', async () => {
  if (saving) return;
  saving = true;
  // Деякі браузери не завершують share(), якщо меню закрили, — кнопка не має лишитися мертвою.
  setTimeout(() => { saving = false; }, 4000);
  try {
    const how = await exportBackup();
    if (!how) return;
    markBackedUp();
    document.querySelector('.backup-card')?.remove();
    const last = document.querySelector('.bk-last');
    if (last) last.textContent = lastBackupText();
    toast('Копію прогресу створено', how === 'shared'
      ? 'Щоб повернути прогрес: «Моє» → «Відновити з файлу».'
      : `Файл ${backupName()} — у завантаженнях. Надішліть його собі, щоб не загубити.`);
  } finally { saving = false; }
});

onAction('backup-later', el => { snoozeBackup(); el.closest('.backup-card')?.remove(); });

async function restoreFrom(file) {
  try {
    if (file.size > MAX_BACKUP_CHARS * 4) throw new BackupError('format');
    const res = restoreBackup(await file.text());
    if (!res.changed) { alert('У цьому файлі немає нічого нового: весь цей прогрес уже є на телефоні.'); return; }
    try { sessionStorage.setItem(RESTORED_KEY, JSON.stringify(res)); } catch {}
    location.reload();
  } catch (e) {
    alert(ERRORS[e?.code] || ERRORS.format);
  }
}

onAction('backup-restore', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.txt,.json,text/plain,application/json'; input.hidden = true;
  input.className = 'backup-file';
  input.addEventListener('change', () => { const f = input.files[0]; input.remove(); if (f) restoreFrom(f); });
  input.addEventListener('cancel', () => input.remove());
  document.querySelectorAll('.backup-file').forEach(el => el.remove());
  document.body.appendChild(input);
  input.click();
});

/** Після відновлення сторінка перезавантажується — тут показуємо, що саме повернулося. */
export function initBackup() {
  let res = null;
  try { res = JSON.parse(sessionStorage.getItem(RESTORED_KEY)); sessionStorage.removeItem(RESTORED_KEY); } catch {}
  if (res) toast('Прогрес відновлено', `${nDays(res.days | 0)} занять · ${nTerms(res.terms | 0)} із прогресом`);
}
