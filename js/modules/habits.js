/* ============================================================
   habits.js — модуль «Привычки» (v0.5: + повторяющиеся события)
   Данные: { id, name, log: ['2026-10-20', ...], kind, repeat }
   kind:   'habit' (привычка, как раньше) | 'event' (событие)
   repeat: 'daily' (каждый день) | 'every2' (через день) | 'monthly' (число месяца)
   Для событий поле 'day' — число месяца (для monthly).
   Отметка дня = «сделано / случилось». Стreak считается только у привычек.
   ============================================================ */

let weekOffset = 0; // 0 — текущая неделя, -1 — прошлая и т.д.

function getHabits() { return DB.get('habits', []); }

// Должен ли элемент «проходить» в эту дату (по типу повтора)
function isDue(item, dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const repeat = item.repeat || 'daily';
  if (repeat === 'daily') return true;
  if (repeat === 'every2') {
    // Считаем дни от даты создания — каждый второй день
    const start = new Date((item.createdAt || todayStr()) + 'T00:00:00');
    const diff = Math.round((d - start) / 86400000);
    return diff % 2 === 0;
  }
  if (repeat === 'monthly') return d.getDate() === Number(item.day);
  return true;
}

const REPEAT_LABEL = { daily: 'каждый день', every2: 'через день', monthly: 'по числу месяца' };

function renderHabits(app) {
  const items = getHabits();

  // Дни отображаемой недели: понедельник + 7 дней
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const futureLimit = todayStr(); // нельзя отмечать будущее

  app.innerHTML = `
    <h2 class="page-title">🔥 Привычки и события</h2>
    <p class="page-sub">Отмечай выполненные дни — серия подряд (streak) считается автоматически.
      События могут повторяться каждый день, через день или в конкретное число месяца.</p>

    <div class="filters">
      <button class="btn" id="h-new">➕ Привычка</button>
      <button class="btn secondary" id="e-new">🔁 Повторяющееся событие</button>
      <button class="btn secondary small" id="h-prev">← нед.</button>
      <button class="btn secondary small" id="h-next">нед. →</button>
      <span class="badge" style="align-self:center">${prettyDate(todayStr(days[0]))} — ${prettyDate(todayStr(days[6]))}</span>
    </div>

    <div class="card">
      ${items.length ? items.map(h => {
        const isEvent = h.kind === 'event';
        return `
        <div class="habit-row">
          <div class="habit-name">${isEvent ? '🔁' : ''} ${esc(h.name)}
            ${isEvent ? `<div class="task-meta">${REPEAT_LABEL[h.repeat || 'daily']}${h.repeat === 'monthly' ? ', ' + h.day + '-го числа' : ''}</div>` : ''}</div>
          <div class="habit-days">
            ${days.map(d => {
              const ds = todayStr(d);
              const on = (h.log || []).includes(ds);
              const isFuture = ds > futureLimit;
              const due = isDue(h, ds); // день «активен» по правилу повтора
              return `<div class="day-dot ${on ? 'on' : ''} ${!due && !on ? 'dim' : ''}"
                data-habit="${h.id}" data-day="${ds}"
                style="${isFuture ? 'opacity:.3;cursor:not-allowed' : ''}"
                title="${prettyDate(ds)}${due ? '' : ' · не по расписанию'}">${d.getDate()}</div>`;
            }).join('')}
          </div>
          ${!isEvent ? `<span class="streak" title="Дней подряд">⚡ ${calcStreak(h.log)} дн.</span>` : ''}
          <button class="btn small secondary" data-edit="${h.id}">✏️</button>
          <button class="btn danger" data-del="${h.id}">🗑</button>
        </div>`;
      }).join('') : empty('Пока пусто — добавь первую привычку 💪 или событие 🔁')}
    </div>
  `;

  document.getElementById('h-new').onclick = () => editHabit(null, 'habit');
  document.getElementById('e-new').onclick = () => editHabit(null, 'event');
  document.getElementById('h-prev').onclick = () => { weekOffset--; App.refresh(); };
  document.getElementById('h-next').onclick = () => { weekOffset++; App.refresh(); };

  // Клик по кружку дня — отметить/снять (будущее не даём трогать)
  app.querySelectorAll('[data-habit]').forEach(dot => dot.onclick = () => {
    const ds = dot.dataset.day;
    if (ds > futureLimit) return;
    const habits = getHabits();
    const h = habits.find(x => x.id === dot.dataset.habit);
    h.log = h.log || [];
    const i = h.log.indexOf(ds);
    if (i >= 0) h.log.splice(i, 1); else h.log.push(ds);
    DB.set('habits', habits);
    App.refresh();
  });

  app.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const item = getHabits().find(x => x.id === b.dataset.edit);
    editHabit(b.dataset.edit, item.kind || 'habit');
  });
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('Удалить со всей историей?')) return;
    DB.set('habits', getHabits().filter(h => h.id !== b.dataset.del));
    App.refresh();
  });
}

// Счётчик дней подряд: идём от сегодня назад, пока дата есть в логе
function calcStreak(log) {
  let streak = 0;
  const d = new Date();
  // Если сегодня ещё не отмечено — начинаем отчёт со вчера (streak не «сгорает» до вечера)
  if (!log.includes(todayStr(d))) d.setDate(d.getDate() - 1);
  while (log.includes(todayStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Создание и редактирование (kind: 'habit' | 'event')
function editHabit(id, kind) {
  const h = id ? getHabits().find(x => x.id === id) : null;
  const isEvent = kind === 'event';

  openModal(h ? 'Редактировать' : (isEvent ? 'Новое повторяющееся событие' : 'Новая привычка'), `
    <div class="form-row"><input id="hb-name" placeholder="${isEvent ? 'Название, например «Poliklinika»' : 'Название, например «Читать 20 минут»'}" value="${esc(h?.name || '')}"></div>
    ${isEvent ? `
    <div class="form-row">
      <select id="hb-repeat" style="flex:1">
        <option value="daily" ${h?.repeat==='daily'?'selected':''}>Каждый день</option>
        <option value="every2" ${h?.repeat==='every2'?'selected':''}>Через день</option>
        <option value="monthly" ${h?.repeat==='monthly'?'selected':''}>Число месяца</option>
      </select>
      <input id="hb-day" type="number" min="1" max="31" placeholder="Число (1–31)" value="${h?.day || ''}" style="flex:0 0 130px">
    </div>
    <div class="form-row">
      <label style="font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px">
        🕠 Время события (необязательно)
        <input id="hb-time" type="time" value="${h?.time || ''}" style="flex:0 0 140px">
      </label>
    </div>` : ''}
    <button class="btn" id="hb-save">Сохранить</button>
  `, wrap => {
    // Поле «число» показываем только для повтора «число месяца»
    if (isEvent) {
      const sel = wrap.querySelector('#hb-repeat');
      const dayInput = wrap.querySelector('#hb-day');
      const sync = () => dayInput.style.display = sel.value === 'monthly' ? '' : 'none';
      sel.onchange = sync; sync();
    }
    wrap.querySelector('#hb-save').onclick = () => {
      const name = wrap.querySelector('#hb-name').value.trim();
      if (!name) return;
      const habits = getHabits();
      let data = {};
      if (isEvent) {
        data.repeat = wrap.querySelector('#hb-repeat').value;
        data.day = Number(wrap.querySelector('#hb-day').value) || 1;
        data.time = wrap.querySelector('#hb-time').value; // '14:30' или
      }
      if (h) { h.name = name; Object.assign(h, data); }
      else {
        habits.push({
          id: uid(), name, log: [], kind: isEvent ? 'event' : 'habit',
          createdAt: todayStr(), ...data,
        });
      }
      DB.set('habits', habits);
      closeModal();
      App.refresh();
    };
  });
}

registerPage('habits', renderHabits);
window.HabitsModule = { getHabits, calcStreak, isDue };
