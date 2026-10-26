/* ============================================================
   agenda.js — модуль «Расписание» (полноэкранный календарь)
   Отдельная страница с крупным сеточным календарём. Клик по
   дню открывает ПАНЕЛЬ НА ВЕСЬ ЭКРАН: список задач, событий и
   расходов на этот день + быстрый ввод. Данные не хранятся —
   всё читаем из calendar.js / tasks / habits / finance.
   ============================================================ */

let agDate = new Date();      // просматриваемый месяц
let agSelected = todayStr();  // выбранный день (открываем сразу сегодня)

function renderAgenda(app) {
  const y = agDate.getFullYear(), m = agDate.getMonth();
  const events = window.CalendarModule.getAllEvents(y, m);
  const today = todayStr();

  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.date === ds);
    const markerTypes = [...new Set(dayEvents.map(e => e.type))];
    cells += `
      <div class="cal-cell big ${ds === today ? 'today' : ''} ${ds === agSelected ? 'selected' : ''}" data-agdate="${ds}">
        <div class="cal-num">${d}</div>
        ${dayEvents.slice(0, 4).map(e => `
          <div class="cal-event" style="background:${EVENT_COLORS[e.type]}22; color:${EVENT_COLORS[e.type]}; border-left:3px solid ${EVENT_COLORS[e.type]}">
            ${e.done ? '✓ ' : ''}${esc(e.title)}
          </div>`).join('')}
        ${dayEvents.length > 4 ? `<div class="cal-event" style="color:var(--muted)">ещё ${dayEvents.length - 4}…</div>` : ''}
        <div class="cal-markers">${markerTypes.map(t => `<span class="cal-marker ${t}"></span>`).join('')}</div>
      </div>`;
  }

  app.innerHTML = `
    <h2 class="page-title">🗒 Расписание</h2>
    <p class="page-sub">Полноэкранный календарь. Нажми на день — откроется подробная панель дня.</p>

    <div class="card">
      <div class="cal-head">
        <button class="btn secondary small" id="ag-prev">←</button>
        <h3>${monthName(y, m)}</h3>
        <button class="btn secondary small" id="ag-next">→</button>
        <button class="btn small" id="ag-today">Сегодня</button>
      </div>
      <div class="cal-grid">
        ${['пн','вт','ср','чт','пт','сб','вс'].map(w => `<div class="cal-weekday">${w}</div>`).join('')}
        ${cells}
      </div>
    </div>

    <div id="ag-panel"></div>
  `;

  document.getElementById('ag-prev').onclick = () => { agDate.setMonth(agDate.getMonth() - 1); App.refresh(); };
  document.getElementById('ag-next').onclick = () => { agDate.setMonth(agDate.getMonth() + 1); App.refresh(); };
  document.getElementById('ag-today').onclick = () => { agDate = new Date(); agSelected = todayStr(); App.refresh(); };

  app.querySelectorAll('[data-agdate]').forEach(cell => cell.onclick = () => {
    agSelected = cell.dataset.agdate;
    // Перерисовываем только панель + подсветку выбранного дня (без полной перерисовки)
    app.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    renderAgendaPanel();
  });

  renderAgendaPanel();
}

// —— Панель выбранного дня (занимает всю ширину) ——————————
function renderAgendaPanel() {
  const panel = document.getElementById('ag-panel');
  if (!panel) return;
  const date = agSelected;
  const CM = window.CalendarModule;
  // События дня, отсортированные по времени начала (без времени — в конце)
  const events = CM.sortDayEvents(CM.getAllEvents().filter(e => e.date === date));

  // Привязанные расходы из финансов (у операций есть поле taskId, а у задач — dueDate)
  const tasksOnDay = (window.TasksModule?.getTasks() || []).filter(t => t.dueDate === date);
  const spentSum = DB.get('transactions', []).filter(tx => {
    const t = tasksOnDay.find(x => x.id === tx.taskId);
    return t && tx.type === 'expense';
  }).reduce((s, tx) => s + Number(tx.sum), 0);

  panel.innerHTML = `
    <div class="card agenda-day">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <h3 style="margin:0">${prettyDate(date)}</h3>
        ${spentSum ? `<span class="badge" style="background:var(--red-bg);color:var(--red-tx)">💸 ${money(spentSum)}</span>` : ''}
      </div>

      ${events.length ? events.map(e => {
        const task = e.type === 'task' ? tasksOnDay.find(t => t.title === e.title) : null;
        const subs = task?.subtasks || [];
        const doneSubs = subs.filter(s => s.done).length;
        // Строка времени: «🕠 14:00–15:30» или «целый день», если времени нет
        const timeLabel = e.time ? `🕠 ${CM.fmtTimeRange(e)}` : '⏳ целый день';
        return `
        <div class="agenda-item">
          <span class="dot" style="background:${EVENT_COLORS[e.type]}"></span>
          <div style="flex:1">
            <div>${esc(e.title)} <span class="badge">${{task:'Задача',plan:'Финплан',subscr:'Подписка',event:'Событие'}[e.type]}</span></div>
            <div class="task-meta">
              <!-- Кнопка-редактор промежутка времени для задач и финпланов -->
              <button class="time-chip" data-time-ev="${esc(e.title)}" title="Изменить время">
                ⏱ ${timeLabel}
              </button>
            </div>
            ${subs.length ? `<div class="task-meta">☑ подзадачи: ${doneSubs}/${subs.length}</div>` : ''}
            ${(task?.comments || []).length ? `<div class="task-meta">💬 комментариев: ${task.comments.length}</div>` : ''}
          </div>
          ${task ? `<button class="btn small secondary" data-goto-task="${task.id}">Открыть →</button>` : ''}
        </div>`;
      }).join('') : '<p class="page-sub" style="margin:8px 0">На этот день ничего нет 🌿</p>'}

      <!-- Быстрый ввод прямо в день: название + промежуток времени -->
      <div class="form-row" style="margin-top:14px">
        <input id="ag-title" placeholder="Добавить на ${prettyDate(date)}...">
        <input id="ag-start" type="time" title="Начало (необязательно)" style="flex:0 0 125px">
        <input id="ag-end" type="time" title="Конец (необязательно)" style="flex:0 0 125px">
        <select id="ag-type" style="flex:0 0 200px">
          <option value="task">✅ Задача на этот день</option>
          <option value="plan">💰 Финансовый план</option>
        </select>
        <button class="btn" id="ag-add" style="flex:0 0 auto">Добавить</button>
      </div>
    </div>
  `;

  // Переход к задаче: открываем страницу задач (подробности раскроются там же)
  panel.querySelectorAll('[data-goto-task]').forEach(b => b.onclick = () => showPage('tasks'));

  // Клик по «⏱ чипу» времени → маленькое окно с началом и концом промежутка
  panel.querySelectorAll('[data-time-ev]').forEach(chip => chip.onclick = () => {
    const title = chip.dataset.timeEv;
    const ev = events.find(e => e.title === title);
    if (!ev || (ev.type !== 'task' && ev.type !== 'plan')) return; // подписки/повторы — без времени

    openModal('⏱ Время', `
      <p class="page-sub" style="margin-top:-6px">${esc(ev.title)} · ${prettyDate(date)}</p>
      <div class="form-row">
        <label style="flex:1"><small>Начало</small>
          <input id="tm-start" type="time" value="${ev.time || ''}"></label>
        <label style="flex:1"><small>Конец</small>
          <input id="tm-end" type="time" value="${ev.end || ''}"></label>
      </div>
      <p class="page-sub">Оставь поля пустыми, чтобы событие было «весь день».</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" id="tm-save">Сохранить</button>
        <button class="btn secondary" id="tm-clear">Весь день</button>
      </div>
    `);

    const save = (start, end) => {
      CM.setEventTime(date, ev, start, end); // пишем dueTime/endTime в задачу или goal.time
      closeModal();
      App.refresh();
    };
    document.getElementById('tm-save').onclick = () =>
      save(document.getElementById('tm-start').value, document.getElementById('tm-end').value);
    document.getElementById('tm-clear').onclick = () => save('', '');
  });

  document.getElementById('ag-add').onclick = () => {
    const title = document.getElementById('ag-title').value.trim();
    if (!title) return;
    const type = document.getElementById('ag-type').value;
    const start = document.getElementById('ag-start').value; // '14:00' или ''
    const end   = document.getElementById('ag-end').value;   // '16:00' или ''
    // Общим способом из calendar.js: создаёт задачу/план сразу с промежутком
    CM.addEventToDay(date, type, title, start, end);
    App.refresh();
  };
}

registerPage('agenda', renderAgenda);
