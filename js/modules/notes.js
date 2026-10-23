/* ============================================================
   notes.js — модуль «Заметки» (v0.6: список + блок-редактор)
   Типы: general (общие), daily (на день), weekly (на неделю).
   У daily/weekly есть поле date — дата начала дня/недели.
   На странице видны только НАЗВАНИЯ и ДАТЫ. Клик по карточке
   открывает заметку в режиме блоков (как страницы Notion):
   текст, чек-листы, ссылки, вызовы — всё с автосохранением.
   Если js/notion.js почему-то не загрузился — работает старый
   простой редактор v0.5 (одним большим полем текста).
   ============================================================ */

let noteSearch = '';       // строка поиска
let noteFilter = 'all';    // фильтр по типу
let noteView = 'cards';    // v0.6: 'cards' — сетка карточек, 'table' — таблица-база как в Notion

const NOTE_TYPES = { general: '📄 Общая', daily: '📅 Дневная', weekly: '🗓 Недельная' };

function getNotes() { return DB.get('notes', []); }

// Красивое время изменения: "20 октября, 14:35"
function prettyDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
         ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function renderNotes(app) {
  let notes = getNotes();
  if (noteFilter !== 'all') notes = notes.filter(n => n.type === noteFilter);
  if (noteSearch) {
    const q = noteSearch.toLowerCase();
    notes = notes.filter(n => (n.text || '').toLowerCase().includes(q) || (n.title || '').toLowerCase().includes(q));
  }
  // Свежие сверху: сортируем по дате изменения наоборот
  notes.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 class="page-title" style="margin-bottom:0">📝 Заметки</h2>
      ${window.Notion ? `<div class="task-view-switch">
        <button data-nview="cards" class="${noteView === 'cards' ? 'on' : ''}">▦ Карточки</button>
        <button data-nview="table" class="${noteView === 'table' ? 'on' : ''}">⊞ Таблица</button>
      </div>` : ''}
    </div>
    <p class="page-sub">Клик по заметке — откроется страница-редактор с блоками, как в Notion. Всё сохраняется само ✍️</p>

    <div class="filters">
      <button class="btn" id="n-new">➕ Новая заметка</button>
      <select id="n-filter" style="max-width:180px">
        <option value="all">Все типы</option>
        <option value="general" ${noteFilter==='general'?'selected':''}>Общие</option>
        <option value="daily" ${noteFilter==='daily'?'selected':''}>Дневные</option>
        <option value="weekly" ${noteFilter==='weekly'?'selected':''}>Недельные</option>
      </select>
      <input id="n-search" placeholder="🔍 Поиск..." value="${esc(noteSearch)}" style="max-width:220px">
    </div>

    ${noteView === 'table' && window.Notion ? `
      <!-- Таблица-«база данных» (как Table view в Notion): все заметки сразу видны,
           название и текст можно править прямо в таблице -->
      <div class="card" style="padding:6px 14px;overflow-x:auto">
        <table class="notes-table" id="n-table">
          <thead><tr><th>Название</th><th>Тип</th><th>Дата</th><th>Блоков</th><th>Изменена</th><th></th></tr></thead>
          <tbody>
            ${notes.map(n => {
              const bc = (n.blocks || []).length || ((n.text || '').split('\n').filter(Boolean).length);
              return `
              <tr data-row="${n.id}">
                <td><input class="nt-name" value="${esc(n.title || 'Без названия')}" data-t="title"></td>
                <td>${NOTE_TYPES[n.type]}</td>
                <td>${n.date ? prettyDate(n.date) : '—'}</td>
                <td style="text-align:center">${bc}</td>
                <td class="task-meta">${prettyDateTime(n.updatedAt)}</td>
                <td style="white-space:nowrap">
                  <button class="btn small secondary" data-open="${n.id}">Открыть</button>
                  <button class="btn danger" data-del="${n.id}">🗑</button>
                </td>
              </tr>`; }).join('')}
          </tbody>
        </table>
        ${notes.length ? '' : empty('Заметок нет. Создай первую!')}
      </div>` : `
    <div id="notes-list" class="grid grid-2">
      ${notes.length ? notes.map(n => `
        <!-- data-open: клик по всей карточке открывает редактор -->
        <div class="card note-card" data-open="${n.id}" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
            <div>
              <strong>${esc(n.title || 'Без названия')}</strong>
              <div style="margin-top:5px">
                <span class="badge">${NOTE_TYPES[n.type]}</span>
                ${n.date ? `<span class="badge cat">${prettyDate(n.date)}</span>` : ''}
                ${(n.blocks || []).length ? `<span class="badge done">⬢ ${n.blocks.length} бл.</span>` : ''}
              </div>
            </div>
            <button class="btn danger" data-del="${n.id}" title="Удалить">🗑</button>
          </div>
          <!-- Только превью первых строк, без редактирования прямо в списке -->
          <p class="note-preview">${esc((n.text || '').slice(0, 90))}${(n.text || '').length > 90 ? '…' : ''}</p>
          <div class="note-dates">Создана: ${prettyDateTime(n.createdAt)}<br>Изменена: ${prettyDateTime(n.updatedAt)}</div>
        </div>`).join('') : empty('Заметок нет. Создай первую!')}
    </div>`}
  `;

  // Переключатель карточки/таблица
  app.querySelectorAll('[data-nview]').forEach(b => b.onclick = () => { noteView = b.dataset.nview; App.refresh(); });

  document.getElementById('n-new').onclick = createNote;
  document.getElementById('n-filter').onchange = e => { noteFilter = e.target.value; App.refresh(); };
  if (noteView !== 'table') {
    document.getElementById('n-search').oninput  = e => { noteSearch = e.target.value; renderNotes(app);
      const s = document.getElementById('n-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); };
  } else {
    // В таблице поиск терял фокус при перерисовке — чиним так же, но через мягкую фильтрацию строк
    document.getElementById('n-search').oninput = e => { noteSearch = e.target.value;
      filterTableRows(e.target.value.toLowerCase()); };
  }

  // Правка названия прямо в таблице (без открытия редактора)
  app.querySelectorAll('#n-table .nt-name').forEach(inp => inp.onchange = () => {
    const notes = getNotes();
    const n = notes.find(x => x.id === inp.closest('[data-row]').dataset.row);
    if (!n) return;
    n.title = inp.value.trim(); n.updatedAt = new Date().toISOString();
    DB.set('notes', notes);
  });

  function filterTableRows(q) {
    app.querySelectorAll('#n-table [data-row]').forEach(tr => {
      const txt = tr.textContent.toLowerCase();
      tr.hidden = q && !txt.includes(q);
    });
  }

  // Открытие заметки по клику на карточку / кнопку «Открыть»
  app.querySelectorAll('[data-open]').forEach(card => card.onclick = () => openNote(card.dataset.open));

  // Удаление (останавливаем всплытие клика, чтобы не открылся редактор)
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    if (!confirm('Удалить заметку?')) return;
    DB.set('notes', getNotes().filter(n => n.id !== b.dataset.del));
    App.refresh();
  });
}

// Куда вести клик по заметке: в блок-редактор (Notion-style),
// а если notion.js не загрузился — в старый модалочный редактор v0.5
function openNote(id) {
  if (window.Notion) window.Notion.openNoteBlocks(id);
  else openNoteEditor(id);
}

// —— Отдельное окно заметки с автосохранением ————————————
function openNoteEditor(id) {
  const note = getNotes().find(n => n.id === id);
  if (!note) return;

  openModal(NOTE_TYPES[note.type] + ' заметка', `
    <div class="form-row">
      <input id="ne-title" placeholder="Название" value="${esc(note.title || '')}">
    </div>
    <textarea id="ne-text" placeholder="Текст заметки..." style="min-height:220px">${esc(note.text || '')}</textarea>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
      <span class="saved-hint" id="ne-hint"></span>
      <span class="task-meta" style="margin-left:auto">Изменена: ${prettyDateTime(note.updatedAt)}</span>
    </div>
  `, wrap => {
    const ta = wrap.querySelector('#ne-text');
    const ti = wrap.querySelector('#ne-title');
    const hint = wrap.querySelector('#ne-hint');

    // Автосохранение с debounce: пока печатаешь — не сохраняем каждый символ,
    // ждём паузу 500 мс и только тогда пишем в localStorage
    let timer = null;
    const autosave = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const notes = getNotes();
        const n = notes.find(x => x.id === id);
        if (!n) return;
        n.title = ti.value.trim();
        n.text = ta.value;
        n.updatedAt = new Date().toISOString();
        DB.set('notes', notes);
        hint.textContent = 'сохранено ✓';
        setTimeout(() => hint.textContent = '', 1500);
      }, 500);
    };
    ta.oninput = autosave;
    ti.oninput = autosave;

    // При закрытии окна немедленно дописываем несохранённое
    // (MutationObserver следит, когда окно удалили из страницы)
    const observer = new MutationObserver(() => {
      if (!document.body.contains(wrap)) { observer.disconnect(); flush(); }
    });
    observer.observe(document.body, { childList: true });
    function flush() {
      clearTimeout(timer);
      const notes = getNotes();
      const n = notes.find(x => x.id === id);
      if (n && (n.title !== ti.value.trim() || n.text !== ta.value)) {
        n.title = ti.value.trim(); n.text = ta.value;
        n.updatedAt = new Date().toISOString();
        DB.set('notes', notes);
      }
      if (App.currentPage === 'notes') renderNotes(document.getElementById('app'));
    }
    ta.focus();
  });
}

// Создание заметки через модальное окно
function createNote() {
  openModal('Новая заметка', `
    <div class="form-row">
      <input id="nt-title" placeholder="Название (необязательно)">
    </div>
    <div class="form-row">
      <select id="nt-type" style="flex:1">
        <option value="general">📄 Общая</option>
        <option value="daily">📅 На день</option>
        <option value="weekly">🗓 На неделю</option>
      </select>
      <input id="nt-date" type="date" value="${todayStr()}">
    </div>
    <div class="form-row">
      <textarea id="nt-text" placeholder="Текст..."></textarea>
    </div>
    <button class="btn" id="nt-save">Создать</button>
  `, wrap => {
    // При выборе типа меняем подпись у поля даты
    const typeSel = wrap.querySelector('#nt-type');
    const dateInput = wrap.querySelector('#nt-date');
    const updateLabel = () => {
      dateInput.title = typeSel.value === 'weekly' ? 'Понедельник нужной недели' : 'Дата заметки';
    };
    typeSel.onchange = updateLabel; updateLabel();

    wrap.querySelector('#nt-save').onclick = () => {
      let date = dateInput.value;
      // Для недельной заметки автоматически округляем дату до понедельника
      if (typeSel.value === 'weekly' && date) date = todayStr(mondayOf(new Date(date + 'T00:00:00')));
      const notes = getNotes();
      const note = {
        id: uid(),
        title: wrap.querySelector('#nt-title').value.trim(),
        text: wrap.querySelector('#nt-text').value,
        type: typeSel.value,
        date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notes.push(note);
      DB.set('notes', notes);
      closeModal();
      App.refresh();
      // Сразу открываем новую заметку для редактирования
      openNote(note.id);   // v0.6: блок-редактор (или старый, если notion.js нет)
    };
  });
}

registerPage('notes', renderNotes);
window.NotesModule = { getNotes };
