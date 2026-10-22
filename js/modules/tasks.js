/* ============================================================
   tasks.js — модуль «Задачи»
   Данные одной задачи:
   { id, title, category, priority, status, dueDate, inCalendar,
     subtasks: [{id, title, done}], comments: [{id, text, date}] }
   status: 'todo' | 'progress' | 'done'
   priority: 'low' | 'mid' | 'high'
   ============================================================ */

// Тексты статусов и приоритетов по-русски
const STATUS_LABEL = { todo: 'Не начато', progress: 'В процессе', done: 'Завершено' };
const PRIO_LABEL   = { low: 'Низкий', mid: 'Средний', high: 'Высокий' };
const PRIO_DOT     = { low: 'var(--green)', mid: 'var(--amber)', high: 'var(--red)' };

// Сумма расходов, привязанных к задаче (через поле taskId у операций)
function taskSpent(taskId) {
  return DB.get('transactions', [])
    .filter(t => t.taskId === taskId && t.type === 'expense')
    .reduce((s, t) => s + Number(t.sum), 0);
}

// Текущие значения фильтров (живут внутри модуля)
let filters = { status: 'all', category: 'all', sort: 'due' };

function getTasks()  { return DB.get('tasks', []); }
function saveTasks(t){
  DB.set('tasks', t);
  // Обновляем аккуратно: если мы на странице задач — перерисовываем список,
  // не сбрасывая форму. Иначе — полная перерисовка страницы.
  if (App.currentPage === 'tasks') { renderTaskList(); renderFilters(); }
}

// —— Рисование страницы ——————————————————————————
function renderTasks(app) {
  const tasks = getTasks();

  app.innerHTML = `
    <h2 class="page-title">✅ Задачи</h2>
    <p class="page-sub">Всего: ${tasks.length} · Выполнено: ${tasks.filter(t => t.status === 'done').length}</p>
    <div id="task-form" class="card"></div>
    <div class="filters" id="task-filters"></div>
    <div id="task-list"></div>
  `;

  renderTaskForm();
  renderFilters();
  renderTaskList();
}

// —— Форма добавления / редактирования ————————
// editId !== null означает, что мы редактируем существующую задачу
let editId = null;

function renderTaskForm() {
  const task = editId ? getTasks().find(t => t.id === editId) : null;
  const box = document.getElementById('task-form');

  box.innerHTML = `
    <h3 style="margin-bottom:10px">${task ? '✏️ Редактировать задачу' : '➕ Новая задача'}</h3>
    <div class="form-row">
      <input id="f-title" placeholder="Название задачи" value="${esc(task?.title || '')}">
      <select id="f-cat">
        ${TASK_CATEGORIES.map(c => `<option ${task?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select id="f-prio">
        ${Object.entries(PRIO_LABEL).map(([v, l]) =>
          `<option value="${v}" ${ (task?.priority || 'mid') === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <input id="f-due" type="date" value="${task?.dueDate || ''}" title="Срок выполнения">
      <select id="f-status">
        ${Object.entries(STATUS_LABEL).map(([v, l]) =>
          `<option value="${v}" ${ (task?.status || 'todo') === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <!-- Поле «шаги»: каждое подзадачи — с новой строки -->
    <textarea id="f-sub" placeholder="Подзадачи — каждая с новой строки, например:&#10;Найти курсы&#10;Сравнить цены" style="min-height:64px">${
      (task?.subtasks || []).map(s => s.title).join('\n')}</textarea>
    <label style="font-size:13px;color:var(--muted)">
      <input type="checkbox" id="f-cal" ${task?.inCalendar ? 'checked' : ''} style="width:auto"> показывать в календаре
    </label>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn" id="f-save">${task ? 'Сохранить' : 'Добавить'}</button>
      ${task ? '<button class="btn secondary" id="f-cancel">Отмена</button>' : ''}
    </div>
  `;

  document.getElementById('f-save').onclick = () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { alert('Напиши название задачи 🙂'); return; }

    // Разбиваем текстareas по строкам и превращаем в подзадачи.
    // Если подзадача уже была (совпала по названию) — сохраняем её готовый статус.
    const oldSubs = task?.subtasks || [];
    const subtasks = document.getElementById('f-sub').value
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map((t, i) => {
        const found = oldSubs.find(s => s.title === t);
        return found || { id: uid(), title: t, done: false };
      });

    const data = {
      title,
      category: document.getElementById('f-cat').value,
      priority: document.getElementById('f-prio').value,
      dueDate:  document.getElementById('f-due').value,
      status:   document.getElementById('f-status').value,
      inCalendar: document.getElementById('f-cal').checked,
      subtasks,
    };

    const tasks = getTasks();
    if (editId) {
      // Нашли задачу по id и объединили со старыми полями ({...старое, ...новое})
      const i = tasks.findIndex(t => t.id === editId);
      tasks[i] = { ...tasks[i], ...data };
    } else {
      tasks.push({ id: uid(), ...data });
    }
    editId = null;
    saveTasks(tasks);
  };

  const cancel = document.getElementById('f-cancel');
  if (cancel) cancel.onclick = () => { editId = null; renderTaskForm(); };
}

// —— Фильтры ————————————————————————————————
function renderFilters() {
  const box = document.getElementById('task-filters');
  box.innerHTML = `
    <select id="fl-status">
      <option value="all">Все статусы</option>
      ${Object.entries(STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${filters.status===v?'selected':''}>${l}</option>`).join('')}
    </select>
    <select id="fl-cat">
      <option value="all">Все категории</option>
      ${TASK_CATEGORIES.map(c => `<option ${filters.category===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <select id="fl-sort">
      <option value="due" ${filters.sort==='due'?'selected':''}>По сроку</option>
      <option value="prio" ${filters.sort==='prio'?'selected':''}>По приоритету</option>
    </select>
  `;
  box.querySelector('#fl-status').onchange = e => { filters.status = e.target.value; renderTaskList(); };
  box.querySelector('#fl-cat').onchange    = e => { filters.category = e.target.value; renderTaskList(); };
  box.querySelector('#fl-sort').onchange   = e => { filters.sort = e.target.value; renderTaskList(); };
}

// —— Список задач ————————————————————————————
function renderTaskList() {
  const today = todayStr();
  let tasks = getTasks();

  // Применяем фильтры: .filter оставляет только подходящие элементы
  if (filters.status !== 'all')   tasks = tasks.filter(t => t.status === filters.status);
  if (filters.category !== 'all') tasks = tasks.filter(t => t.category === filters.category);

  // Сортировка
  const prioWeight = { high: 0, mid: 1, low: 2 };
  if (filters.sort === 'due') {
    tasks.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);
  } else {
    tasks.sort((a, b) => prioWeight[a.priority] - prioWeight[b.priority]);
  }

  const list = document.getElementById('task-list');
  if (!tasks.length) { list.innerHTML = empty('Задач нет — можно отдохнуть 🌤️'); return; }

  list.innerHTML = tasks.map(t => {
    // Просрочено = есть дата в прошлом и задача не сделана
    const overdue = t.dueDate && t.dueDate < today && t.status !== 'done';
    const badgeCls = t.status === 'done' ? 'done' : t.status === 'progress' ? 'progress' : overdue ? 'overdue' : 'todo';
    const badgeTxt = overdue ? 'Просрочено' : STATUS_LABEL[t.status];
    const subs = t.subtasks || [];
    const doneSubs = subs.filter(s => s.done).length;
    const spent = taskSpent(t.id);

    return `
      <div class="task-item ${t.status === 'done' ? 'done-task' : ''}">
        <!-- кружок-галочка: клик меняет статус todo -> done -->
        <div class="check ${t.status === 'done' ? 'checked' : ''}" data-toggle="${t.id}">
          ${t.status === 'done' ? '✓' : t.status === 'progress' ? '…' : ''}
        </div>
        <div style="flex:1">
          <div class="task-title"><span class="dot" style="background:${PRIO_DOT[t.priority]}"></span>${esc(t.title)}</div>
          <div class="task-meta">
            <span class="badge cat">${esc(t.category)}</span>
            <span class="badge ${badgeCls}">${badgeTxt}</span>
            ${t.dueDate ? ` · 📅 ${prettyDate(t.dueDate)}` : ''}
            ${subs.length ? ` · <span class="expand-hint" data-open="${t.id}">☑ ${doneSubs}/${subs.length} шагов</span>` : ''}
            ${(t.comments || []).length ? ` · 💬 ${t.comments.length}` : ''}
            ${spent ? ` · <span class="expand-hint" data-open="${t.id}">💸 ${money(spent)}</span>` : ''}
          </div>
          <!-- Кнопка «подробности» разворачивает подзадачи, комментарии и расходы -->
          <div class="task-details" id="details-${t.id}" hidden></div>
        </div>
        ${subs.length || (t.comments || []).length || spent ? `<button class="btn small secondary" data-expand="${t.id}" title="Подробности">📋</button>` : ''}
        <button class="btn small secondary" data-edit="${t.id}">✏️</button>
        <button class="btn danger" data-del="${t.id}">🗑</button>
      </div>`;
  }).join('');

  // Навешиваем обработчики кликов (data-атрибуты помогают понять, куда кликнули)
  list.querySelectorAll('[data-toggle]').forEach(el => el.onclick = () => toggleStatus(el.dataset.toggle));
  list.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => { editId = el.dataset.edit; renderTaskForm(); window.scrollTo(0,0); });
  list.querySelectorAll('[data-del]').forEach(el => el.onclick = () => removeTask(el.dataset.del));
  list.querySelectorAll('[data-expand]').forEach(el => el.onclick = () => toggleDetails(el.dataset.expand));
  list.querySelectorAll('[data-open]').forEach(el => el.onclick = () => toggleDetails(el.dataset.open));
}

// Развернуть/свернуть блок подробностей задачи
function toggleDetails(id) {
  const box = document.getElementById('details-' + id);
  if (!box) return;
  if (box.hidden) { renderTaskDetails(id); box.hidden = false; }
  else box.hidden = true;
}

// Рисует содержимое подробностей: подзадачи, комментарии, расходы
function renderTaskDetails(id) {
  const box = document.getElementById('details-' + id);
  const t = getTasks().find(x => x.id === id);
  if (!t || !box) return;
  const subs = t.subtasks || [];
  const coms = t.comments || [];
  const spentTxs = DB.get('transactions', []).filter(x => x.taskId === id && x.type === 'expense');

  box.innerHTML = `
    <div class="td-block">
      ${subs.map(s => `
        <label class="subtask-line">
          <input type="checkbox" data-sub="${s.id}" ${s.done ? 'checked' : ''}>
          <span class="${s.done ? 'sub-done' : ''}">${esc(s.title)}</span>
        </label>`).join('')}
      <div class="form-row" style="margin-top:6px">
        <input data-newsub placeholder="Новая подзадача..." style="min-width:100px">
        <button class="btn small" data-addsub style="flex:0 0 auto">＋</button>
      </div>
    </div>

    <div class="td-block">
      <div class="td-label">💬 Комментарии</div>
      ${coms.map(c => `
        <div class="comment-line">
          <div style="flex:1">${esc(c.text)}<div class="task-meta">${prettyDate(c.date.slice(0,10))}</div></div>
          <button class="btn danger" data-delcom="${c.id}">×</button>
        </div>`).join('')}
      <div class="form-row" style="margin-top:6px">
        <input data-newcom placeholder="Заметка по задаче..." style="min-width:100px">
        <button class="btn small" data-addcom style="flex:0 0 auto">Добавить</button>
      </div>
    </div>

    <div class="td-block">
      <div class="td-label">💸 Расходы по задаче: ${money(spentTxs.reduce((s,x)=>s+Number(x.sum),0))}</div>
      ${spentTxs.map(x => `
        <div class="comment-line">
          <div style="flex:1">${esc(x.comment || x.category)}<div class="task-meta">${prettyDate(x.date)} · <span class="badge cat">${esc(x.category)}</span></div></div>
          <div class="tx-sum out">−${money(x.sum)}</div>
        </div>`).join('')}
      <div class="form-row" style="margin-top:6px">
        <input data-costsum type="number" placeholder="Сумма" style="flex:0 0 110px;min-width:90px">
        <input data-costcat placeholder="Категория (например: Транспорт)" style="min-width:120px">
        <button class="btn small" data-addcost style="flex:0 0 auto">Записать расход</button>
      </div>
      <p class="task-meta">Расход попадёт в раздел «Финансы» и будет привязан к этой задаче.</p>
    </div>
  `;

  // —— Обработчики внутри блока подробностей ——
  box.querySelectorAll('[data-sub]').forEach(cb => cb.onchange = () => {
    const tasks = getTasks();
    const tt = tasks.find(x => x.id === id);
    const s = tt.subtasks.find(x => x.id === cb.dataset.sub);
    s.done = cb.checked;
    DB.set('tasks', tasks);
    // Если все шаги готовы — подсказываем завершить задачу
    renderTaskDetails(id);
    if (tt.subtasks.every(x => x.done) && tt.status !== 'done' && confirm('Все подзадачи выполнены! Отметить задачу как завершённую?')) {
      const tasks2 = getTasks();
      tasks2.find(x => x.id === id).status = 'done';
      saveTasks(tasks2);
    }
  });

  box.querySelector('[data-addsub]').onclick = () => {
    const val = box.querySelector('[data-newsub]').value.trim();
    if (!val) return;
    const tasks = getTasks();
    const tt = tasks.find(x => x.id === id);
    tt.subtasks = tt.subtasks || [];
    tt.subtasks.push({ id: uid(), title: val, done: false });
    DB.set('tasks', tasks);
    renderTaskDetails(id); renderTaskList();
  };

  box.querySelector('[data-addcom]').onclick = () => {
    const val = box.querySelector('[data-newcom]').value.trim();
    if (!val) return;
    const tasks = getTasks();
    const tt = tasks.find(x => x.id === id);
    tt.comments = tt.comments || [];
    tt.comments.unshift({ id: uid(), text: val, date: new Date().toISOString() });
    DB.set('tasks', tasks);
    renderTaskDetails(id); renderTaskList();
  };

  box.querySelectorAll('[data-delcom]').forEach(b => b.onclick = () => {
    const tasks = getTasks();
    const tt = tasks.find(x => x.id === id);
    tt.comments = (tt.comments || []).filter(c => c.id !== b.dataset.delcom);
    DB.set('tasks', tasks);
    renderTaskDetails(id); renderTaskList();
  });

  // Добавление расхода, привязанного к задаче (поле taskId)
  box.querySelector('[data-addcost]').onclick = () => {
    const sum = Number(box.querySelector('[data-costsum]').value);
    if (!sum || sum <= 0) { alert('Введи сумму'); return; }
    const cat = box.querySelector('[data-costcat]').value.trim() || 'Другое';
    const txs = DB.get('transactions', []);
    txs.push({ id: uid(), type: 'expense', sum, category: cat, date: todayStr(),
               comment: `${t.title} — расход`, taskId: id });
    DB.set('transactions', txs);
    renderTaskDetails(id); renderTaskList();
  };
}

// Клик по кружку:/todo <-> done (progress — через форму)
function toggleStatus(id) {
  const tasks = getTasks();
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.status = t.status === 'done' ? 'todo' : 'done';
  saveTasks(tasks);
}

function removeTask(id) {
  if (!confirm('Удалить задачу?')) return;
  saveTasks(getTasks().filter(t => t.id !== id));
}

// Регистрация страницы в app.js и экспорт функций для других модулей
registerPage('tasks', renderTasks);
window.TasksModule = { getTasks, taskSpent };
