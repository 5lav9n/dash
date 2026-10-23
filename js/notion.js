/* ============================================================
   notion.js — «Notion-подобный» движок v0.6 (новый файл)

   Здесь живут 4 главные «нотионовские» фишки:
   1) Умный парсер quickParse() — превращает одну строку текста
      в готовую задачу/заметку/расход. Например:
        «📅 25 октября купить билеты работа !высокий»
   2) Быстрое создание openQuickCreate() — окно как Quick Find
      в Notion: жмёшь Ctrl+K (или кнопку «＋») и пишешь одну строку.
   3) Блок-редактор заметок openNoteBlocks() — заметка состоит из
      блоков (текст, чек-лист, ссылка, выделенный вызов), каждый
      блок можно удалить или превратить в другой тип.
   4) Канбан-доска renderKanban() — задачи колонками по статусам,
      карточки можно перетаскивать мышкой между колонками.

   ВАЖНО: этот файл подключается ПОСЛЕ всех модулей и ПЕРЕД app.js
   не ставится — он только расширяет функции других модулей
   (window.Notion = {...}), поэтому старое поведение сохраняется.
   ============================================================ */

// ---------- Русские названия месяцев для парсера дат ----------
const MONTHS_RU = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  // именительный падеж тоже принимаем: «25 октябрь»
  январь: 1, февраль: 2, март: 3, апрель: 4, май: 5, июнь: 6,
  июль: 7, август: 8, сентябрь: 9, октябрь: 10, ноябрь: 11, декабрь: 12,
  янв: 1, фев: 2, мар: 3, апр: 4, май: 5, июн: 6,
  июл: 8, авг: 8, сен: 9, сент: 9, окт: 10, ноя: 11, дек: 12,
};

// Дни недели → дата ближайшего такого дня (пн...вс)
const WEEKDAYS_RU = { пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6, вс: 0,
                     'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4,
                     'пятница': 5, 'суббота': 6, 'воскресенье': 0 };

/* ------------------------------------------------------------
   quickParse(text) — «магия» одной строки.
   Находит внутри текста подсказки и возвращает объект:
   { kind, title, dueDate, priority, category, sum, type }
   kind: 'task' | 'note' | 'tx' (финансовая операция)
   ------------------------------------------------------------ */
function quickParse(raw) {
  let text = String(raw || '').trim();
  const out = { kind: 'task', title: '', dueDate: '', priority: 'mid', category: '', sum: 0, txType: 'expense' };

  // 1) Тип по первому эмодзи: 📝/🗒 — заметка, 💰/₽ — деньги, всё остальное — задача
  if (/^(📝|🗒|📒)/.test(text)) { out.kind = 'note'; text = text.replace(/^(📝|🗒|📒)\s*/, ''); }
  else if (/^(💰|💸|₽|\d+\s*₽)/.test(text)) { out.kind = 'tx'; text = text.replace(/^(💰|💸)\s*/, ''); }

  // 2) Приоритет: !высокий / !средний / !низкий (!high !mid !low тоже поймём)
  const prioMap = { high: 'high', '!high': 'high', 'высокий': 'high', 'выс': 'high',
                    mid: 'mid', '!mid': 'mid', средний: 'mid', сред: 'mid',
                    low: 'low', '!low': 'low', низкий: 'low', низ: 'low' };
  text = text.replace(/!(\w+)/g, (m, w) => {
    const p = prioMap[w.toLowerCase()];
    if (p) { out.priority = p; return ''; }
    return m; // не распознали — оставляем как есть
  });

  // 3) Категория: #работа #учёба ... (совпадение с TASK_CATEGORIES без учёта регистра)
  text = text.replace(/#([\wА-Яа-яЁё]+)/g, (m, w) => {
    const found = TASK_CATEGORIES.find(c => c.toLowerCase() === w.toLowerCase());
    if (found) { out.category = found; return ''; }
    out.category = w.charAt(0).toUpperCase() + w.slice(1); // новая категория — принимаем как есть
    return '';
  });

  // 4) Дата. Варианты: "25 октября", "октября 25", "25.10", "10/25", "25 окт",
  //    "сегодня", "завтра", "пн/вт/...", год опционально
  const today = new Date();
  // слово «сегодня»/«завтра»
  text = text.replace(/\b(сегодня|завтра|today|tomorrow)\b/i, (m, w) => {
    const d = new Date(today);
    if (/завтра|tomorrow/i.test(w)) d.setDate(d.getDate() + 1);
    out.dueDate = todayStr(d);
    return '';
  });
  // день + месяц словом
  text = text.replace(/(\d{1,2})\s*([а-яё]+)(?:\s*(\d{4}))?/i, (m, day, mon, year) => {
    const mm = MONTHS_RU[mon.toLowerCase()];
    if (mm && day >= 1 && day <= 31) {
      const y = year ? Number(year) : today.getFullYear();
      const d = new Date(y, mm - 1, day);
      // если дата уже прошла в этом году — берём следующий год
      if (!year && todayStr(d) < todayStr(today)) d.setFullYear(y + 1);
      out.dueDate = todayStr(d);
      return '';
    }
    return m;
  });
  // число.месяц или число/месяц (25.10, 25/10)
  text = text.replace(/(\d{1,2})[.\/](\d{1,2})(?![\d])/g, (m, day, mon) => {
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      const d = new Date(today.getFullYear(), mon - 1, day);
      if (todayStr(d) < todayStr(today)) d.setFullYear(today.getFullYear() + 1);
      out.dueDate = todayStr(d);
      return '';
    }
    return m;
  });
  // день недели: «пт», «в пятницу»
  text = text.replace(/\b(пн|вт|ср|чт|пт|сб|вс)\b\.?/i, (m, w) => {
    const target = WEEKDAYS_RU[w.toLowerCase()];
    if (target === undefined) return m;
    const d = new Date(today);
    let add = (target - d.getDay() + 7) % 7;
    if (add === 0) add = 7; // «пт» в пятницу = следующая пятница
    d.setDate(d.getDate() + add);
    out.dueDate = todayStr(d);
    return '';
  });

  // 5) Для денег: ищем сумму вида «1200₽» или «1200 руб»
  if (out.kind === 'tx') {
    text = text.replace(/(\d[\d\s]*)\s*(₽|руб\.?)/i, (m, num) => {
      out.sum = Number(String(num).replace(/\s/g, ''));
      return '';
    });
    // «+5000» считаем доходом
    if (/^\+/.test(text)) { out.txType = 'income'; text = text.slice(1); }
  }

  // 6) Эмодзи-подсказки типов убираем из заголовка, «+» перед суммой тоже
  out.title = text.replace(/[📅💰💸📝🗒📒₽]/g, '').replace(/\s{2,}/g, ' ').trim();
  return out;
}

/* ------------------------------------------------------------
   Быстрое создание: одно окно — одна строка — готовая запись.
   Открывается по Ctrl+K / Cmd+K или кнопке «＋» в шапке.
   ------------------------------------------------------------ */
function openQuickCreate() {
  openModal('Быстрое создание', `
    <input class="qf-input" id="qc-input" placeholder="Напиши одной строкой, например:" autofocus
           autocomplete="off">
    <div class="qf-hint">
      💡 Подсказки: <b>📅 25 октября</b> — срок · <b>#работа</b> — категория ·
      <b>!высокий</b> — приоритет · <b>📝</b> в начале — заметка · <b>💰 1200₽</b> — расход.<br>
      Пример задачи целиком: <i>📅 пт позвонить в банк #работа !высокий</i>
    </div>
    <div class="qf-chips">
      <button class="qf-chip" data-demo="📅 завтра ">📅 Завтра …</button>
      <button class="qf-chip" data-demo="📝 ">📝 Заметка …</button>
      <button class="qf-chip" data-demo="💰 500₽ ">💰 Расход …</button>
      <button class="qf-chip" data-demo="">✅ Просто задача …</button>
    </div>
  `, wrap => {
    const input = wrap.querySelector('#qc-input');
    const save = () => {
      const parsed = quickParse(input.value);
      if (!parsed.title) { input.focus(); return; }

      if (parsed.kind === 'note') {
        // Заметка: создаём сразу с блоками (см. ниже формат blocks)
        const notes = DB.get('notes', []);
        const note = {
          id: uid(), title: parsed.title, text: parsed.title,
          type: 'general', date: todayStr(),
          blocks: [{ id: uid(), type: 'text', text: parsed.title }],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        notes.push(note); DB.set('notes', notes);
        closeModal(); showPage('notes'); openNoteBlocks(note.id);
      } else if (parsed.kind === 'tx') {
        if (!parsed.sum) { alert('Не нашёл сумму 🙂 Например: 💰 500₽ продукты'); return; }
        const txs = DB.get('transactions', []);
        txs.push({ id: uid(), type: parsed.txType, sum: parsed.sum,
                   category: parsed.category || 'Другое', date: todayStr(),
                   comment: parsed.title });
        DB.set('transactions', txs);
        closeModal(); App.refresh();
      } else {
        const tasks = DB.get('tasks', []);
        tasks.push({
          id: uid(), title: parsed.title,
          category: parsed.category || 'Личное',
          priority: parsed.priority, status: 'todo',
          dueDate: parsed.dueDate, inCalendar: !!parsed.dueDate,
          subtasks: [], comments: [],
        });
        DB.set('tasks', tasks);
        closeModal(); showPage('tasks');
      }
    };
    input.onkeydown = e => { if (e.key === 'Enter') save(); };
    wrap.querySelectorAll('[data-demo]').forEach(ch => ch.onclick = () => {
      input.value = ch.dataset.demo; input.focus();
    });
    input.focus();
  });
}

/* ------------------------------------------------------------
   Формат блоков заметки (пока заметка хранит и старый text —
   совместность: старые заметки открываются как один текстовый блок):
   blocks: [ {id, type:'text'|'todo'|'link'|'callout', text, done?} ]
   ------------------------------------------------------------ */
function noteBlocks(note) {
  if (note.blocks && note.blocks.length) return note.blocks;
  // Старая заметка: режем текст на строки → каждый абзац стал блоком
  return (note.text || '').split('\n').filter(Boolean)
    .map(t => ({ id: uid(), type: 'text', text: t }));
}

// Превью для карточки списка: первые блоки → обычный текст
function blocksToText(blocks) {
  return blocks.map(b => (b.type === 'todo' ? (b.done ? '☑ ' : '☐ ') : '') + b.text).join('\n');
}

/* ------------------------------------------------------------
   Блок-редактор заметки — маленькая страница вместо модалки.
   Каждый блок: слева «⋮⋮» (удалить), Enter — новый блок,
   Backspace в пустом блоке — удалить его.
   Кнопки внизу добавляют блоки нужного типа.
   ------------------------------------------------------------ */
function openNoteBlocks(id) {
  const notes = DB.get('notes', []);
  const note = notes.find(n => n.id === id);
  if (!note) return;
  let blocks = noteBlocks(note);

  const app = document.getElementById('app');
  const saveNow = () => {
    note.blocks = blocks;
    note.text = blocksToText(blocks);       // дублируем в старый поле text —
    note.updatedAt = new Date().toISOString(); // совместность со всем остальным кодом
    DB.set('notes', notes);
  };

  app.innerHTML = `
    <div class="card" style="padding:26px 30px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <button class="btn small secondary" id="nb-back">← Заметки</button>
        <span class="badge">${NOTE_TYPES[note.type] || '📄 Общая'}</span>
        ${note.date ? `<span class="badge cat">${prettyDate(note.date)}</span>` : ''}
        <span class="saved-hint" id="nb-hint"></span>
      </div>
      <input class="nb-title" id="nb-title" placeholder="Без названия" value="${esc(note.title || '')}">
      <div class="nb-blocks" id="nb-blocks"></div>
      <div class="nb-toolbar">
        <button class="btn secondary" data-add="text">＋ Текст</button>
        <button class="btn secondary" data-add="todo">☑ Чек-лист</button>
        <button class="btn secondary" data-add="link">🔗 Ссылка</button>
        <button class="btn secondary" data-add="callout">💡 Вызов</button>
      </div>
      <p class="task-meta" style="margin-top:12px">Пустой блок + Enter — создать новый. Пустой блок + Backspace — удалить. Всё сохраняется само.</p>
    </div>
  `;

  const listBox = document.getElementById('nb-blocks');
  const hint = document.getElementById('nb-hint');
  let timer = null;
  const autosave = () => {                       // debounce 500 мс, как в заметках v0.5
    clearTimeout(timer);
    timer = setTimeout(() => { saveNow(); hint.textContent = 'сохранено ✓';
                               setTimeout(() => hint.textContent = '', 1400); }, 500);
  };

  function draw(focusId) {
    listBox.innerHTML = '';
    if (!blocks.length) listBox.innerHTML = '<div class="nb-empty-hint">Пустая страница — начни печатать или добавь блок ниже ↓</div>';
    blocks.forEach(b => {
      const row = document.createElement('div');
      row.className = 'nb-block';
      const handle = document.createElement('button');
      handle.className = 'nb-handle'; handle.title = 'Удалить блок'; handle.textContent = '⋮⋮';
      handle.onclick = () => { blocks = blocks.filter(x => x.id !== b.id); saveNow(); draw(); };
      row.appendChild(handle);

      if (b.type === 'todo') {
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'nb-check'; cb.checked = !!b.done;
        cb.onchange = () => { b.done = cb.checked; autosave(); area.classList.add('checked-line'); };
        row.appendChild(cb);
      }
      if (b.type === 'link' && b.text.match(/^https?:\/\//)) {
        const a = document.createElement('a');
        a.className = 'nb-link'; a.href = b.text; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = b.text;
        row.appendChild(a);
      }
      const area = document.createElement('textarea');
      area.className = 'nb-text' + (b.type === 'todo' && b.done ? ' checked-line' : '') + (b.type === 'callout' ? ' nb-callout' : '');
      area.rows = 1; area.value = b.text;
      area.placeholder = b.type === 'todo' ? 'Пункт списка...' : b.type === 'link' ? 'Вставь ссылку https://...' : 'Напиши что-нибудь...';
      const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
      grow(area);
      area.oninput = () => { b.text = area.value; grow(area); autosave(); };
      area.onkeydown = e => {
        // Enter — новый блок того же типа (todo остаётся todo)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const nb = { id: uid(), type: b.type, text: '', done: false };
          blocks.splice(blocks.indexOf(b) + 1, 0, nb);
          saveNow(); draw(nb.id);
        }
        // Backspace в пустом блоке — удаляем и встаём в предыдущий
        if (e.key === 'Backspace' && !area.value) {
          e.preventDefault();
          const i = blocks.indexOf(b);
          blocks.splice(i, 1); saveNow();
          draw(i > 0 ? blocks[i - 1].id : (blocks[0] || {}).id);
        }
      };
      row.appendChild(area);
      listBox.appendChild(row);
      if (b.id === focusId) area.focus();
    });
  }

  document.getElementById('nb-title').oninput = e => { note.title = e.target.value; autosave(); };
  document.getElementById('nb-back').onclick = () => { saveNow(); showPage('notes'); };
  app.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => {
    const nb = { id: uid(), type: btn.dataset.add, text: '', done: false };
    blocks.push(nb); saveNow(); draw(nb.id);
  });

  draw();
}

/* ------------------------------------------------------------
   Канбан-доска задач: три колонки (не начато / в процессе /
   завершено). Карточку можно перетащить в другую колонку —
   статус обновится. Работает через HTML5 drag-and-drop
   (нативное средство браузера, без библиотек).
   ------------------------------------------------------------ */
let taskView = 'list'; // текущий вид страницы «Задачи»: список или доска

function renderKanban(container) {
  const tasks = DB.get('tasks', []);
  const cols = [
    { key: 'todo',     label: '📥 Не начато' },
    { key: 'progress', label: '⏳ В процессе' },
    { key: 'done',     label: '✅ Завершено' },
  ];
  container.innerHTML = `<div class="kanban">` + cols.map(c => {
    const list = tasks.filter(t => (t.status || 'todo') === c.key);
    return `
      <div class="kb-col" data-col="${c.key}">
        <h4>${c.label}<span>${list.length}</span></h4>
        ${list.map(t => `
          <div class="kb-card" draggable="true" data-id="${t.id}">
            <strong>${esc(t.title)}</strong>
            <div class="kb-meta">
              <span class="badge cat">${esc(t.category || '')}</span>
              ${t.dueDate ? `<span>📅 ${prettyDate(t.dueDate)}</span>` : ''}
              ${(t.subtasks || []).length ? `<span>☑ ${(t.subtasks || []).filter(s => s.done).length}/${t.subtasks.length}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  }).join('') + `</div>`;

  // Перетаскивание: запоминаем id карточки, при попадании в колонку меняем статус
  let draggedId = null;
  container.querySelectorAll('.kb-card').forEach(card => {
    card.addEventListener('dragstart', () => { draggedId = card.dataset.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('click', () => { editId = card.dataset.id; showPage('tasks'); window.scrollTo(0, 0); });
  });
  container.querySelectorAll('.kb-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('drag-over');
      if (!draggedId) return;
      const tasks = DB.get('tasks', []);
      const t = tasks.find(x => x.id === draggedId);
      if (t) { t.status = col.dataset.col; DB.set('tasks', tasks); renderKanban(container); }
      draggedId = null;
    });
  });
}

/* Окно «страницы-буста»: короткие заметки-карточки на «Сегодня».
   Данные: DB 'boosters' = [{id, title, text}] */
const DEFAULT_BOOSTERS = [
  { title: '💪 Напоминание себе', text: 'Ты ведёшь эту систему уже лучше, чем большинство людей ведёт хоть что-то. Продолжай.' },
  { title: '🎯 Фокус дня', text: 'Одно большое дело сегодня важнее десяти маленьких. Выбери его утром.' },
];

function getBoosters() {
  let b = DB.get('boosters', null);
  if (!b) { b = DEFAULT_BOOSTERS.map(x => ({ id: uid(), ...x })); DB.set('boosters', b); }
  return b;
}

function renderBoosterCard(container) {
  const list = getBoosters();
  const b = list[Math.floor(Math.random() * list.length)];
  container.innerHTML = `
    <h3>✨ Буст дня</h3>
    <div class="boost-text"><strong>${esc(b.title)}</strong><br>${esc(b.text)}</div>
    <button class="btn small secondary" id="bs-next" style="margin-top:8px">Другой ↻</button>
    <button class="btn small ghost" id="bs-edit" style="margin-top:8px">Мои бусты</button>
  `;
  document.getElementById('bs-next').onclick = () => renderBoosterCard(container);
  document.getElementById('bs-edit').onclick = () => openBoostEditor(container);
}

function openBoostEditor(container) {
  const list = getBoosters();
  openModal('Мои бусты', `
    ${list.map(b => `
      <div class="form-row" data-b="${b.id}">
        <input value="${esc(b.title)}" data-f="title" placeholder="Заголовок">
        <input value="${esc(b.text)}" data-f="text" placeholder="Текст">
        <button class="btn danger" data-del>×</button>
      </div>`).join('')}
    <div class="form-row">
      <button class="btn secondary" id="bs-add">＋ Новый буст</button>
      <button class="btn" id="bs-save">Сохранить</button>
    </div>
  `, wrap => {
    wrap.querySelector('#bs-add').onclick = () => {
      const row = document.createElement('div');
      row.className = 'form-row';
      row.innerHTML = `<input data-f="title" placeholder="Заголовок"><input data-f="text" placeholder="Текст"><button class="btn danger" data-del>×</button>`;
      wrap.insertBefore(row, wrap.querySelector('.form-row:last-of-type'));
      row.querySelector('[data-del]').onclick = () => row.remove();
    };
    wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const row = b.closest('[data-b]'); if (row) row.remove();
    });
    wrap.querySelector('#bs-save').onclick = () => {
      const out = [];
      wrap.querySelectorAll('[data-b]').forEach(row => {
        const title = row.querySelector('[data-f="title"]').value.trim();
        const text = row.querySelector('[data-f="text"]').value.trim();
        if (title || text) out.push({ id: row.dataset.b, title, text });
      });
      // новые строки без data-b тоже сохраняем
      wrap.querySelectorAll('.form-row:not([data-b])').forEach(row => {
        const ti = row.querySelector('[data-f="title"]'), te = row.querySelector('[data-f="text"]');
        if (ti && te && ti.value.trim()) out.push({ id: uid(), title: ti.value.trim(), text: te.value.trim() });
      });
      DB.set('boosters', out);
      closeModal(); renderBoosterCard(container);
    };
  });
}

// Единая точка доступа для других модулей
window.Notion = { quickParse, openQuickCreate, openNoteBlocks, renderKanban, renderBoosterCard, noteBlocks, blocksToText };
