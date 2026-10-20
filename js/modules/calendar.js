/* ============================================================
   calendar.js — модуль «Календарь»
   Показывает месяц и собирает события из РАЗНЫХ источников:
   задачи (с inCalendar), подписки, финпланы. Сам календарь
   ничего не хранит — только собирает. Это удобно: данные живут
   в своих модулях, а календарь их «читает».
   ============================================================ */

// Текущий просматриваемый месяц (переменные живут внутри модуля)
let calDate = new Date(); // дата внутри текущего месяца-на экране

// Цвета типов событий
const EVENT_COLORS = {
  task:   'var(--accent)',
  plan:   'var(--blue)',
  subscr: 'var(--red)',
};

// Собираем все события в виде плоского списка:
// [{ date:'2026-10-20', title:'...', type:'task' }, ...]
function getAllEvents() {
  const events = [];

  // 1) Задачи, помеченные «показывать в календаре»
  (window.TasksModule?.getTasks() || []).forEach(t => {
    if (t.inCalendar && t.dueDate)
      events.push({ date: t.dueDate, title: t.title, type: 'task', done: t.status === 'done' });
  });

  // 2) Финансовые планы (цели) — дата targetDate
  DB.get('goals', []).forEach(g => {
    if (g.targetDate)
      events.push({ date: g.targetDate, title: '💰 ' + g.title, type: 'plan' });
  });

  // 3) Подписки — день списания повторяется каждый месяц
  const y = calDate.getFullYear(), m = calDate.getMonth();
  DB.get('subscriptions', []).forEach(s => {
    if (!s.active) return;
    const day = Number(String(s.chargeDay).padStart(2, '0'));
    const lastDay = new Date(y, m + 1, 0).getDate(); // сколько дней в месяце
    const d = Math.min(day, lastDay); // если 31-е, а в феврале его нет — берём последний день
    events.push({ date: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
                  title: '🔁 ' + s.name, type: 'subscr' });
  });

  return events;
}

function renderCalendar(app) {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const events = getAllEvents();
  const today = todayStr();

  // Первый день месяца (0=вс,1=пн...) и число дней в месяце
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7; // приводим к "понедельник — первый"
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // Строим сетку: пустые ячейки до 1-го числа + дни месяца
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.date === ds);
    // Маркеры-точки: по одной точке на каждый ТИП события в этот день.
    // Даже если названия событий не помещаются (на телефоне), точки всё
    // равно видны — сразу понятно, в каких днях что-то есть.
    const markerTypes = [...new Set(dayEvents.map(e => e.type))]; // уникальные типы
    const markers = markerTypes.length
      ? `<div class="cal-markers">${markerTypes.map(t => `<span class="cal-marker ${t}"></span>`).join('')}</div>`
      : '';
    cells += `
      <div class="cal-cell ${ds === today ? 'today' : ''}" data-date="${ds}">
        <div>${d}</div>
        ${dayEvents.slice(0, 3).map(e => `
          <div class="cal-event" style="background:${EVENT_COLORS[e.type]}22; color:${EVENT_COLORS[e.type]}; border-left:3px solid ${EVENT_COLORS[e.type]}">
            ${e.done ? '✓ ' : ''}${esc(e.title)}
          </div>`).join('')}
        ${dayEvents.length > 3 ? `<div class="cal-event" style="color:var(--muted)">ещё ${dayEvents.length - 3}…</div>` : ''}
        ${markers}
      </div>`;
  }

  app.innerHTML = `
    <h2 class="page-title">📅 Календарь</h2>
    <p class="page-sub">Нажми на день, чтобы добавить задачу или план. Точки под числом — события в этот день: 
      <span class="dot" style="background:var(--accent)"></span>задача
      <span class="dot" style="background:var(--blue)"></span>финплан
      <span class="dot" style="background:var(--red)"></span>подписка
    </p>
    <div class="card">
      <div class="cal-head">
        <button class="btn secondary small" id="cal-prev">←</button>
        <h3>${monthName(y, m)}</h3>
        <button class="btn secondary small" id="cal-next">→</button>
        <button class="btn small" id="cal-today-btn">Сегодня</button>
      </div>
      <div class="cal-grid">
        ${['пн','вт','ср','чт','пт','сб','вс'].map(w => `<div class="cal-weekday">${w}</div>`).join('')}
        ${cells}
      </div>
    </div>
    <div id="day-panel"></div>
  `;

  document.getElementById('cal-prev').onclick = () => { calDate.setMonth(calDate.getMonth() - 1); App.refresh(); };
  document.getElementById('cal-next').onclick = () => { calDate.setMonth(calDate.getMonth() + 1); App.refresh(); };
  document.getElementById('cal-today-btn').onclick = () => { calDate = new Date(); App.refresh(); };

  app.querySelectorAll('[data-date]').forEach(cell =>
    cell.onclick = () => renderDayPanel(cell.dataset.date));
}

// Панель под календарём: что в выбранном дне + быстрый ввод
function renderDayPanel(date) {
  const panel = document.getElementById('day-panel');
  const events = getAllEvents().filter(e => e.date === date);

  panel.innerHTML = `
    <div class="card">
      <h3>${prettyDate(date)}</h3>
      ${events.length ? events.map(e => `
        <div class="tx-row"><span class="dot" style="background:${EVENT_COLORS[e.type]}"></span>
        ${esc(e.title)} <span class="badge">${{task:'Задача',plan:'Финплан',subscr:'Подписка'}[e.type]}</span></div>`).join('')
        : '<p class="page-sub" style="margin:8px 0">Пусто</p>'}
      <div class="form-row" style="margin-top:12px">
        <input id="dp-title" placeholder="Быстро добавить на этот день...">
        <select id="dp-type" style="flex:0 0 160px">
          <option value="task">✅ В календарь (задача)</option>
          <option value="plan">💰 Финансовый план</option>
        </select>
        <button class="btn" id="dp-add" style="flex:0 0 auto">Добавить</button>
      </div>
    </div>`;

  document.getElementById('dp-add').onclick = () => {
    const title = document.getElementById('dp-title').value.trim();
    if (!title) return;
    const type = document.getElementById('dp-type').value;

    if (type === 'task') {
      // Создаём задачу сразу с датой и флагом "в календаре"
      const tasks = DB.get('tasks', []);
      tasks.push({ id: uid(), title, category: 'Личное', priority: 'mid',
                   status: 'todo', dueDate: date, inCalendar: true });
      DB.set('tasks', tasks);
    } else {
      // Финансовый план с датой (goalType='custom' — просто событие в календаре)
      const goals = DB.get('goals', []);
      goals.push({ id: uid(), title, targetSum: 0, saved: 0, targetDate: date, goalType: 'custom' });
      DB.set('goals', goals);
    }
    App.refresh(); // перерисовываем календарь
  };
}

registerPage('calendar', renderCalendar);
