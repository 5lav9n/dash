/* ============================================================
   today.js — экран «Сегодня»: главная сводка дня.
   Собирает короткую выжимку из всех модулей: задачи на сегодня,
   привычки, ближайшие подписки, заметка дня.
   ============================================================ */

function renderToday(app) {
  const today = todayStr();

  // Задачи: на сегодня или просроченные, ещё не сделанные
  const tasks = (window.TasksModule?.getTasks() || [])
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate <= today);
  const allOpen = (window.TasksModule?.getTasks() || []).filter(t => t.status !== 'done').length;

  // Привычки: отмечено ли сегодня
  const habits = (window.HabitsModule?.getHabits() || []);
  const habitsDone = habits.filter(h => h.log.includes(today)).length;

  // Заметка дня (если есть)
  const dailyNote = DB.get('notes', []).find(n => n.type === 'daily' && n.date === today);

  // Ближайшие списания подписок (используем логику финансового модуля через данные)
  const subs = (window.FinanceModule?.getSubs() || []).filter(s => s.active).map(s => {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), s.chargeDay);
    if (todayStr(d) < today) d = new Date(now.getFullYear(), now.getMonth() + 1, s.chargeDay);
    return { ...s, date: todayStr(d), left: Math.round((d - new Date(today)) / 86400000) };
  }).sort((a, b) => a.left - b.left).slice(0, 3);

  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  app.innerHTML = `
    <h2 class="page-title">${hello}! ☀️</h2>
    <p class="page-sub">${prettyDate(today)}</p>

    <div class="grid grid-2">
      <div class="card">
        <h3>📌 На сегодня (${tasks.length})</h3>
        ${tasks.length ? tasks.map(t => `
          <div class="stat-line"><span>${esc(t.title)}</span>
            <span class="badge ${t.dueDate < today ? 'overdue' : 'progress'}">${t.dueDate < today ? 'просрочено' : 'сегодня'}</span></div>`).join('')
          : '<p class="page-sub" style="margin:8px 0">Ничего страшного — планов на сегодня нет 🌿</p>'}
        <p class="task-meta">Всего открытых задач: ${allOpen}</p>
        <button class="btn small secondary" onclick="showPage('tasks')">Все задачи →</button>
      </div>

      <div class="card">
        <h3>🔥 Привычки сегодня</h3>
        ${habits.length ? habits.map(h => {
          const on = h.log.includes(today);
          return `<div class="stat-line"><span>${on ? '✅' : '⬜'} ${esc(h.name)}</span>
                  <span class="streak">⚡ ${window.HabitsModule.calcStreak(h.log)} дн.</span></div>`;
        }).join('') : '<p class="page-sub" style="margin:8px 0">Привычек пока нет</p>'}
        <p class="task-meta">Отмечено сегодня: ${habitsDone} из ${habits.length}</p>
      </div>

      <div class="card">
        <h3>💰 Ближайшие списания</h3>
        ${subs.length ? subs.map(s => `
          <div class="stat-line"><span>🔁 ${esc(s.name)}</span>
            <span>${money(s.price)} · через ${s.left} дн. (${s.date})</span></div>`).join('')
          : '<p class="page-sub" style="margin:8px 0">Подписок нет</p>'}
        <button class="btn small secondary" onclick="showPage('finance')">Финансы →</button>
      </div>

      <div class="card">
        <h3>📝 Заметка дня</h3>
        ${dailyNote
          ? `<p style="white-space:pre-wrap;font-size:14px">${esc(dailyNote.text)}</p>`
          : '<p class="page-sub" style="margin:8px 0">На сегодня заметки нет</p>'}
        <button class="btn small secondary" onclick="showPage('notes')">К заметкам →</button>
      </div>
    </div>
  `;
}

registerPage('today', renderToday);
