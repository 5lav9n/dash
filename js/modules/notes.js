/* ============================================================
   notes.js — модуль «Заметки»
   Типы: general (общие), daily (на день), weekly (на неделю).
   У daily/weekly есть поле date — дата начала дня/недели.
   Автосохранение: при вводе текста ждём 500 мс и сохраняем.
   ============================================================ */

let noteSearch = '';       // строка поиска
let noteFilter = 'all';    // фильтр по типу

function getNotes() { return DB.get('notes', []); }

function renderNotes(app) {
  const TYPE_LABEL = { general: '📄 Общая', daily: '📅 Дневная', weekly: '🗓 Недельная' };

  let notes = getNotes();
  if (noteFilter !== 'all') notes = notes.filter(n => n.type === noteFilter);
  if (noteSearch) {
    const q = noteSearch.toLowerCase();
    notes = notes.filter(n => (n.text || '').toLowerCase().includes(q) || (n.title || '').toLowerCase().includes(q));
  }
  // Свежие сверху: сортируем по дате изменения наоборот
  notes.sort((a, b) => (b.updatedAt || '') .localeCompare(a.updatedAt || ''));

  app.innerHTML = `
    <h2 class="page-title">📝 Заметки</h2>
    <p class="page-sub">Автосохранение — ничего нажимать не нужно, пиши спокойно ✍️</p>

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

    <div id="notes-list" class="grid grid-2">
      ${notes.length ? notes.map(n => `
        <div class="card note-card" data-id="${n.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div>
              <strong>${esc(n.title || 'Без названия')}</strong>
              <span class="badge">${TYPE_LABEL[n.type]}</span>
              ${n.date ? `<span class="badge cat">${prettyDate(n.date)}</span>` : ''}
            </div>
            <button class="btn danger" data-del="${n.id}">🗑</button>
          </div>
          <textarea data-text="${n.id}" placeholder="Текст заметки...">${esc(n.text || '')}</textarea>
          <span class="saved-hint" id="hint-${n.id}"></span>
        </div>`).join('') : empty('Заметок нет. Создай первую!')}
    </div>
  `;

  document.getElementById('n-new').onclick = createNote;
  document.getElementById('n-filter').onchange = e => { noteFilter = e.target.value; App.refresh(); };
  document.getElementById('n-search').oninput  = e => { noteSearch = e.target.value; renderNotes(app); /* перерисовать список */ 
    // Возвращаем фокус в поле поиска, чтобы можно было печатать дальше
    const s = document.getElementById('n-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); };

  // Удаление
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('Удалить заметку?')) return;
    DB.set('notes', getNotes().filter(n => n.id !== b.dataset.del));
    App.refresh();
  });

  // —— АВТОСОХРАНЕНИЕ ——————————————————————
  // debounce: пока человек печатает, мы НЕ сохраняем каждый символ.
  // Ждём паузу 500 мс после последнего нажатия — и только тогда пишем в localStorage.
  const timers = {};
  app.querySelectorAll('[data-text]').forEach(ta => {
    ta.oninput = () => {
      const id = ta.dataset.text;
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => {
        const notes = getNotes();
        const n = notes.find(n => n.id === id);
        if (n) { n.text = ta.value; n.updatedAt = new Date().toISOString(); DB.set('notes', notes); }
        const hint = document.getElementById('hint-' + id);
        if (hint) { hint.textContent = 'сохранено ✓'; setTimeout(() => hint.textContent = '', 1500); }
      }, 500);
    };
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
      notes.push({
        id: uid(),
        title: wrap.querySelector('#nt-title').value.trim(),
        text: wrap.querySelector('#nt-text').value,
        type: typeSel.value,
        date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      DB.set('notes', notes);
      closeModal();
      App.refresh();
    };
  });
}

registerPage('notes', renderNotes);
