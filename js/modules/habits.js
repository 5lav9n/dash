/* ============================================================
   habits.js — модуль «Привычки»
   Данные: { id, name, log: ['2026-10-20', ...] } — log это список
   отмеченных дат. Неделя показывается пн–вс, streak считается
   по подряд идущим дням назад от сегодня.
   ============================================================ */

let weekOffset = 0; // 0 — текущая неделя, -1 — прошлая и т.д.

function getHabits() { return DB.get('habits', []); }

function renderHabits(app) {
  const habits = getHabits();

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
    <h2 class="page-title">🔥 Привычки</h2>
    <p class="page-sub">Отмечай выполненные дни — серия подряд (streak) считается автоматически</p>

    <div class="filters">
      <button class="btn" id="h-new">➕ Новая привычка</button>
      <button class="btn secondary small" id="h-prev">← нед.</button>
      <button class="btn secondary small" id="h-next">нед. →</button>
      <span class="badge" style="align-self:center">${prettyDate(todayStr(days[0]))} — ${prettyDate(todayStr(days[6]))}</span>
    </div>

    <div class="card">
      ${habits.length ? habits.map(h => `
        <div class="habit-row">
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-days">
            ${days.map(d => {
              const ds = todayStr(d);
              const on = h.log.includes(ds);
              const isFuture = ds > futureLimit;
              return `<div class="day-dot ${on ? 'on' : ''}" 
                data-habit="${h.id}" data-day="${ds}"
                style="${isFuture ? 'opacity:.3;cursor:not-allowed' : ''}"
                title="${prettyDate(ds)}">${d.getDate()}</div>`;
            }).join('')}
          </div>
          <span class="streak" title="Дней подряд">⚡ ${calcStreak(h.log)} дн.</span>
          <button class="btn small secondary" data-edit="${h.id}">✏️</button>
          <button class="btn danger" data-del="${h.id}">🗑</button>
        </div>`).join('') : empty('Привычек нет — добавь первую, например «Зарядка» 💪')}
    </div>
  `;

  document.getElementById('h-new').onclick = () => editHabit(null);
  document.getElementById('h-prev').onclick = () => { weekOffset--; App.refresh(); };
  document.getElementById('h-next').onclick = () => { weekOffset++; App.refresh(); };

  // Клик по кружку дня — отметить/снять (будущее не даём трогать)
  app.querySelectorAll('[data-habit]').forEach(dot => dot.onclick = () => {
    const ds = dot.dataset.day;
    if (ds > futureLimit) return;
    const habits = getHabits();
    const h = habits.find(x => x.id === dot.dataset.habit);
    const i = h.log.indexOf(ds);
    if (i >= 0) h.log.splice(i, 1); else h.log.push(ds);
    DB.set('habits', habits);
    App.refresh();
  });

  app.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editHabit(b.dataset.edit));
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('Удалить привычку со всей историей?')) return;
    DB.set('habits', getHabits().filter(h => h.id !== b.dataset.del));
    App.refresh();
  });
}

// Счётчик дней подряд: идём от сегодня назад, пока дата есть в логе
function calcStreak(log) {
  let streak = 0;
  const d = new Date();
  // Если сегодня ещё не отмечено — начинаем отччёт со вчера (streak не «сгорает» до вечера)
  if (!log.includes(todayStr(d))) d.setDate(d.getDate() - 1);
  while (log.includes(todayStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Создание и редактирование привычки (одна и та же форма)
function editHabit(id) {
  const h = id ? getHabits().find(x => x.id === id) : null;
  openModal(h ? 'Редактировать привычку' : 'Новая привычка', `
    <div class="form-row"><input id="hb-name" placeholder="Название, например «Читать 20 минут»" value="${esc(h?.name || '')}"></div>
    <button class="btn" id="hb-save">Сохранить</button>
  `, wrap => {
    wrap.querySelector('#hb-save').onclick = () => {
      const name = wrap.querySelector('#hb-name').value.trim();
      if (!name) return;
      const habits = getHabits();
      if (h) { h.name = name; }
      else { habits.push({ id: uid(), name, log: [] }); }
      DB.set('habits', habits);
      closeModal();
      App.refresh();
    };
  });
}

registerPage('habits', renderHabits);
window.HabitsModule = { getHabits, calcStreak };
