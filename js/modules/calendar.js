/* ============================================================
   calendar.js — модуль «Календарь» (v0.7)
   Собирает события из РАЗНЫХ источников: задачи (с inCalendar),
   подписки, финпланы + повторяющиеся события из «Привычек».
   Два режима просмотра:
   • 📅 Месяц  — привычная сетка месяца;
   • 🗓 Неделя — крупная развёрнутая сетка (1–4 недели) с
     временем задач и быстрым добавлением прямо в день.
   Сам календарь ничего не хранит — только «читает» данные.
   ============================================================ */

// Текущий просматриваемый месяц (переменные живут внутри модуля)
let calDate = new Date(); // дата внутри текущего месяца-на экране

// —— Дополнительные источники событий (регистраются другими модулями) ——
// Например, events.js добавляет сюда пользовательские события со временем.
const extraEventSources = [];
function registerCalSource(fn) { if (!extraEventSources.includes(fn)) extraEventSources.push(fn); }

// Понедельник недели, к которой относится дата d
function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // 0=вс → приводим к пн
  return x;
}

// Сохраняем выбранный режим просмотра между переходами по вкладкам
function setCalView(v) { DB.set('calView', v); }

// Цвета типов событий
const EVENT_COLORS = {
  task:    'var(--accent)',
  plan:    'var(--blue)',
  subscr:  'var(--red)',
  event:   'var(--green)',   // повторяющиеся события из «Привычек»
};

// Собираем все события в виде плоского списка:
// [{ date:'2026-10-20', time:'14:30', title:'...', type:'task' }, ...]
// monthY/monthM — для каких месяцев генерировать повторы (по умолчанию — экран месяца)
function getAllEvents(monthY, monthM) {
  const y = monthY ?? calDate.getFullYear();
  const m = monthM ?? calDate.getMonth();
  const events = [];

  // 1) Задачи, помеченные «показывать в календаре»
  //    (+ время начала dueTime и конца endTime — промежуток, если задан)
  (window.TasksModule?.getTasks() || []).forEach(t => {
    if (t.inCalendar && t.dueDate)
      events.push({ date: t.dueDate, time: t.dueTime || '', end: t.endTime || '',
                    title: t.title, type: 'task', done: t.status === 'done', taskId: t.id });
  });

  // 2) Финансовые планы (цели) — дата targetDate (+ время, если пользователь задал).
  //    time = начало промежутка, endTime = конец. goalType='custom' — просто событие.
  DB.get('goals', []).forEach(g => {
    if (g.targetDate)
      events.push({ date: g.targetDate, title: '💰 ' + g.title, type: 'plan',
                    time: g.time || '', end: g.endTime || '' });
  });

  // 3) Подписки — день списания повторяется каждый месяц
  DB.get('subscriptions', []).forEach(s => {
    if (!s.active) return;
    const day = Number(String(s.chargeDay).padStart(2, '0'));
    const lastDay = new Date(y, m + 1, 0).getDate(); // сколько дней в месяце
    const d = Math.min(day, lastDay); // если 31-е, а в феврале его нет — берём последний день
    events.push({ date: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
                  title: '🔁 ' + s.name, type: 'subscr' });
  });

  // 4) Повторяющиеся события из раздела «Привычки»
  const hm = window.HabitsModule;
  if (hm?.getHabits) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    hm.getHabits().filter(h => h.kind === 'event').forEach(h => {
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (hm.isDue(h, ds)) events.push({ date: ds, time: h.time || '', title: '🗓 ' + h.name, type: 'event', habitId: h.id });
      }
    });
  }

  // 5) Пользовательские события (модуль events.js): дата + время + название
  extraEventSources.forEach(src => { try { src(y, m, events); } catch (e) {} });

  // Сортировка: сначала по дате, внутри дня — по времени (без времени — в начало)
  events.sort((a, b) => (a.date + (a.time || '')) > (b.date + (b.time || '')) ? 1 : -1);

  return events;
}

// Одна карточка события (используется в месяце, неделе и панели дня)
function calEventHtml(e, maxTitle = 0) {
  let title = esc(e.title);
  if (maxTitle && title.length > maxTitle) title = title.slice(0, maxTitle) + '…';
  // Время: показываем промежуток «14:00–15:30», если задан конец, иначе только начало
  const time = e.time ? `<span class="ce-time">🕠${e.time}${e.end ? '–' + e.end : ''}</span> ` : '';
  return `<div class="cal-event" data-cal-ev="${e.type}" style="background:${EVENT_COLORS[e.type]}22; color:${EVENT_COLORS[e.type]}; border-left:3px solid ${EVENT_COLORS[e.type]}">
    ${time}${e.done ? '✓ ' : ''}${title}
  </div>`;
}

// —— Вспомогательные функции для «Расписания» (agenda.js) ————

// Красивый текст времени: '14:30' → '14:30', промежуток → '14:00–15:30'
function fmtTimeRange(e) {
  if (!e.time) return '';
  return e.end ? `${e.time}–${e.end}` : e.time;
}

// Сортировка событий внутри дня: timed-события по началу, без времени — в конец
function sortDayEvents(list) {
  return [...list].sort((a, b) => {
    if (!a.time && !b.time) return a.title.localeCompare(b.title, 'ru');
    if (!a.time) return 1;   // без времени — ниже тех, у которых оно есть
    if (!b.time) return -1;
    return a.time < b.time ? -1 : 1;
  });
}

// Быстрое добавление задачи/плана на день (используют agenda.js и календарь).
// time — начало ('14:00' или ''), end — конец промежутка ('16:00' или '')
function addEventToDay(date, type, title, time = '', end = '') {
  if (type === 'task') {
    const tasks = DB.get('tasks', []);
    tasks.push({ id: uid(), title, category: 'Личное', priority: 'mid',
                 status: 'todo', dueDate: date, dueTime: time, endTime: end,
                 inCalendar: true, subtasks: [], comments: [] });
    DB.set('tasks', tasks);
  } else {
    // Финансовый план: goalType='custom' — просто событие в календаре
    const goals = DB.get('goals', []);
    goals.push({ id: uid(), title, targetSum: 0, saved: 0, targetDate: date,
                 goalType: 'custom', time, endTime: end });
    DB.set('goals', goals);
  }
}

// Сохранение editedTask через TasksModule недоступно извне, поэтому
// agenda.js меняет время напрямую в массиве tasks/goals этим способом:
function setEventTime(date, ev, time, end) {
  if (ev.type === 'task' && ev.taskId) {
    const tasks = DB.get('tasks', []);
    const t = tasks.find(x => x.id === ev.taskId);
    if (t) { t.dueTime = time; t.endTime = end; DB.set('tasks', tasks); }
  } else if (ev.type === 'plan') {
    const goals = DB.get('goals', []);
    // Ищем цель по названию (в заголовке есть префикс '💰 ') и дате
    const g = goals.find(x => x.targetDate === date && ('💰 ' + x.title) === ev.title);
    if (g) { g.time = time; g.endTime = end; DB.set('goals', goals); }
  }
}

// Обёртка страницы: переключатель «Месяц / Неделя» + нужный вид
function renderCalendar(app) {
  const view = DB.get('calView', 'month'); // запоминаем выбранный режим

  app.innerHTML = `
    <h2 class="page-title">📅 Календарь</h2>
    <div class="seg" role="tablist">
      <button class="seg-btn ${view === 'month' ? 'active' : ''}" data-cal-view="month">📅 Месяц</button>
      <button class="seg-btn ${view === 'week' ? 'active' : ''}" data-cal-view="week">🗓 Неделя</button>
    </div>
    <div id="cal-body"></div>
    <div id="day-panel"></div>
  `;

  app.querySelectorAll('[data-cal-view]').forEach(b =>
    b.onclick = () => { setCalView(b.dataset.calView); App.refresh(); });

  const body = document.getElementById('cal-body');
  if (view === 'week') renderWeekView(body);
  else renderMonthView(body);
}

// —— Вид «Месяц» (как было раньше, v0.5) ——————————————————
function renderMonthView(container) {
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
      ? `<div class="cal-markers">${markerTypes.map(t => `<span class="cal-marker ${t}" title="${{task:'Задача',plan:'Финплан',subscr:'Подписка',event:'Событие'}[t]}"></span>`).join('')}</div>`
      : '';
    cells += `
      <div class="cal-cell ${ds === today ? 'today' : ''}" data-date="${ds}">
        <div>${d}</div>
        ${dayEvents.slice(0, 3).map(e => calEventHtml(e, 24)).join('')}
        ${dayEvents.length > 3 ? `<div class="cal-event" style="color:var(--muted)">ещё ${dayEvents.length - 3}…</div>` : ''}
        ${markers}
      </div>`;
  }

  container.innerHTML = `
    <p class="page-sub">Нажми на день, чтобы добавить задачу или план. Точки под числом — события в этот день:
      <span class="dot" style="background:var(--accent)"></span>задача
      <span class="dot" style="background:var(--blue)"></span>финплан
      <span class="dot" style="background:var(--red)"></span>подписка
      <span class="dot" style="background:var(--green)"></span>повтор. событие
    </p>
    <div class="card">
      <div class="cal-head">
        <button class="btn secondary small" id="cal-prev">←</button>
        <h3>${monthName(y, m)}</h3>
        <button class="btn secondary small" id="cal-next">→</button>
        <button class="btn small" id="cal-today-btn">Сегодня</button>
        <button class="btn small secondary" id="cal-agenda-btn" title="Подробное расписание">🗒 Расписание</button>
      </div>
      <div class="cal-grid">
        ${['пн','вт','ср','чт','пт','сб','вс'].map(w => `<div class="cal-weekday">${w}</div>`).join('')}
        ${cells}
      </div>
    </div>
  `;

  document.getElementById('cal-prev').onclick = () => { calDate.setMonth(calDate.getMonth() - 1); App.refresh(); };
  document.getElementById('cal-next').onclick = () => { calDate.setMonth(calDate.getMonth() + 1); App.refresh(); };
  document.getElementById('cal-today-btn').onclick = () => { calDate = new Date(); App.refresh(); };
  document.getElementById('cal-agenda-btn').onclick = () => showPage('agenda');

  container.querySelectorAll('[data-date]').forEach(cell =>
    cell.onclick = () => renderDayPanel(cell.dataset.date));
}

// —— Вид «Неделя»: развёрнутая сетка 1–4 недели с временем ——————————
let calWeeks = 1; // глобально, чтобы remember значение между перерисовками

function renderWeekView(container) {
  const ws = weekStart(calDate);              // понедельник показываемой недели
  const weeks = calWeeks || 1;                // сколько недель показывать (1–4)
  const today = todayStr();
  const events = getAllEvents(ws.getFullYear(), ws.getMonth());

  // Диапазон дат всех видимых недель: [start, end]
  const start = new Date(ws);
  const end = new Date(ws); end.setDate(end.getDate() + weeks * 7 - 1);

  // События могут приходить из месяцев вне текущего (например, висыпающиеся задачи),
  // поэтому дополнительно фильтруем по диапазону видимых дней
  const visibleDates = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    visibleDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  const evByDate = {};
  events.forEach(e => { if (visibleDates.includes(e.date)) (evByDate[e.date] ||= []).push(e); });

  // Заголовок диапазона: «20 – 26 октября» или «29 сен – 4 окт»
  const fmtShort = d => `${d.getDate()} ${monthName(d.getFullYear(), d.getMonth()).slice(0,3)}`;
  const rangeTitle = start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${monthName(start.getFullYear(), start.getMonth())}`
    : `${fmtShort(start)} – ${fmtShort(end)} ${end.getFullYear()}`;

  let head = '', body = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const ds = visibleDates[i];
    head += `<div class="cw-dayhead ${ds === today ? 'today' : ''}">
       <div class="cw-dow">${['пн','вт','ср','чт','пт','сб','вс'][i]}</div>
       <div class="cw-num">${d.getDate()}</div></div>`;
  }
  // Тело: по одному ряду на неделю, в каждом ряду — 7 колонок-дней
  for (let w = 0; w < weeks; w++) {
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const ds = visibleDates[w * 7 + i];
      const dayEv = evByDate[ds] || [];
      cols += `<div class="cw-col ${ds === today ? 'today' : ''}" data-date="${ds}">
        ${dayEv.map(e => calEventHtml(e, 30)).join('')}
        ${!dayEv.length ? '<div class="cw-empty">＋</div>' : ''}
      </div>`;
    }
    body += `<div class="wg-row">${cols}</div>`;
  }

  container.innerHTML = `
    <p class="page-sub">Крупная сетка недель. Клик по дню — панель добавления. У задач и событий отображается время 🕠.</p>
    <div class="card">
      <div class="cal-head">
        <button class="btn secondary small" id="cw-prev">←</button>
        <h3>${rangeTitle}</h3>
        <button class="btn secondary small" id="cw-next">→</button>
        <button class="btn small" id="cw-today">Сегодня</button>
        <select id="cw-weeks" class="input small-input" title="Сколько недель показывать">
          ${[1,2,3,4].map(n => `<option value="${n}" ${weeks === n ? 'selected' : ''}>недель: ${n}</option>`).join('')}
        </select>
      </div>
      <div class="week-scroll">
        <div class="week-grid">
          <div class="wg-head-row">${head}</div>
          ${body}
        </div>
      </div>
    </div>
  `;

  // Перематываем неделю целиком (стрелки)
  document.getElementById('cw-prev').onclick = () => { calDate = new Date(start); calDate.setDate(calDate.getDate() - 7); App.refresh(); };
  document.getElementById('cw-next').onclick = () => { calDate = new Date(end);   calDate.setDate(calDate.getDate() + 1); App.refresh(); };
  document.getElementById('cw-today').onclick = () => { calDate = new Date(); App.refresh(); };
  document.getElementById('cw-weeks').onchange = (e) => { calWeeks = Number(e.target.value); App.refresh(); };

  container.querySelectorAll('[data-date]').forEach(col =>
    col.onclick = (ev) => { if (!ev.target.closest('.cal-event')) renderDayPanel(col.dataset.date); });
}

// Панель под календарём: что в выбранном дне + быстрый ввод (с временем)
function renderDayPanel(date) {
  const panel = document.getElementById('day-panel');
  if (!panel) return;
  const events = getAllEvents().filter(e => e.date === date);

  panel.innerHTML = `
    <div class="card">
      <h3>${prettyDate(date)}</h3>
      ${events.length ? events.map(e => `
        <div class="tx-row"><span class="dot" style="background:${EVENT_COLORS[e.type]}"></span>
        ${e.time ? `<b style="font-size:12px">🕠${e.time}</b> ` : ''}${esc(e.title)} <span class="badge">${{task:'Задача',plan:'Финплан',subscr:'Подписка',event:'Событие'}[e.type]}</span></div>`).join('')
        : '<p class="page-sub" style="margin:8px 0">Пусто</p>'}
      <div class="form-row" style="margin-top:12px">
        <input id="dp-title" placeholder="Быстро добавить на этот день...">
        <input id="dp-time" type="time" style="flex:0 0 120px" title="Время (необязательно)">
        <select id="dp-type" style="flex:0 0 190px">
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
    const time = document.getElementById('dp-time').value; // '14:30' или ''

    if (type === 'task') {
      // Создаём задачу сразу с датой, временем и флагом "в календаре"
      const tasks = DB.get('tasks', []);
      tasks.push({ id: uid(), title, category: 'Личное', priority: 'mid',
                   status: 'todo', dueDate: date, dueTime: time, inCalendar: true });
      DB.set('tasks', tasks);
    } else {
      // Финансовый план с датой (goalType='custom' — просто событие в календаре)
      const goals = DB.get('goals', []);
      goals.push({ id: uid(), title, targetSum: 0, saved: 0, targetDate: date, goalType: 'custom' });
      DB.set('goals', goals);
    }
    App.refresh(); // перерисовываем календарь
  };

  // Аккуратно прокручиваем к панели, если она ниже экрана.
  // Проверка typeof нужен: в тестовой среде jsdom этого метода нет,
  // а в реальном браузере он есть и работает как задумано
  if (typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

registerPage('calendar', renderCalendar);
// Экспортируем функции наружу — ими пользуется agenda.js («Расписание»)
window.CalendarModule = { getAllEvents, EVENT_COLORS, registerCalSource,
                          fmtTimeRange, sortDayEvents, addEventToDay, setEventTime };
