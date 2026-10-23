/* ============================================================
   today.js — экран «Сегодня» (витрина всего дашборда)
   Собираем данные из других модулей через window.*Module и
   DB напрямую: задачи на день, привычки/события, ближайшие
   подписки, заметка дня + БЫСТРЫЕ ЗАМЕТКИ (todo-лист без
   категорий) + мини-игры для ребёнка.
   ============================================================ */

function renderToday(app) {
  const today = todayStr();

  // Задачи: на сегодня или просроченные, ещё не сделанные
  const tasks = (window.TasksModule?.getTasks() || [])
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate <= today);
  const allOpen = (window.TasksModule?.getTasks() || []).filter(t => t.status !== 'done').length;

  // Привычки и события: отмечено ли сегодня
  const habits = (window.HabitsModule?.getHabits() || []);
  const habitsDone = habits.filter(h => (h.log || []).includes(today)).length;

  // Заметка дня (если есть)
  const dailyNote = DB.get('notes', []).find(n => n.type === 'daily' && n.date === today);

  // Ближайшие списания подписок
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

    <!-- Быстрые заметки todo-листом: просто текст, без категорий -->
    <div class="card quick-card">
      <h3>⚡ Быстрые заметки</h3>
      <p class="task-meta" style="margin-bottom:8px">Мини todo-лист: записал идею — отметил галочкой. Хранятся только здесь.</p>
      <div id="quick-list"></div>
      <div class="form-row" style="margin-top:8px">
        <input id="q-input" placeholder="Записать быструю заметку... (Enter)">
        <button class="btn" id="q-add" style="flex:0 0 auto">＋</button>
      </div>
    </div>

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
        <h3>🔥 Привычки и события сегодня</h3>
        ${habits.length ? habits.map(h => {
          const on = (h.log || []).includes(today);
          return `<div class="stat-line"><span>${on ? '✅' : '⬜'} ${esc(h.name)}${h.kind === 'event' ? ' 🔁' : ''}</span>
                  ${h.kind === 'event' ? '' : `<span class="streak">⚡ ${window.HabitsModule.calcStreak(h.log)} дн.</span>`}</div>`;
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

    <!-- Мини-игры: переводчик, географ, факты.
         Если файл js/modules/games.js не загрузился (например, устаревший
         кэш на телефоне или файл не долит на GitHub), показываем подсказку,
         а не пустую карточку -->
    <div class="card" id="games-widget">${window.GamesModule ? '' :
      '<h3 style="margin-bottom:10px">🎮 Игры и развитие</h3>' +
      '<p class="page-sub">Файл <b>js/modules/games.js</b> не загрузился. ' +
      'Проверь, что он есть в репозитории на GitHub, и обнови страницу.</p>'}</div>

    <!-- v0.6: «Буст дня» — короткая мотивирующая страница (как маленькие заметки Notion).
         Содержимое рисует js/notion.js; если файл не загрузился — карточку просто видно пустой -->
    <div class="card boost-card" id="booster-widget" ${window.Notion ? 'hidden' : ''}></div>
  `;

  setupQuickNotes();

  // Виджет игр рисуем через games.js, если он загрузился
  if (window.GamesModule) window.GamesModule.renderGamesWidget(document.getElementById('games-widget'));
  // Буст дня — через notion.js
  if (window.Notion) {
    const bw = document.getElementById('booster-widget');
    bw.hidden = false;
    window.Notion.renderBoosterCard(bw);
  }
}

// —— Быстрые заметки (todo-лист) ————————————————
// Данные: [{ id, text, done }] — без категорий и дат
function getQuick() { return DB.get('quick', []); }

function setupQuickNotes() {
  const list = document.getElementById('quick-list');
  const input = document.getElementById('q-input');
  const addBtn = document.getElementById('q-add');

  const render = () => {
    const items = getQuick();
    list.innerHTML = items.length ? items.map(q => `
      <label class="quick-line ${q.done ? 'q-done' : ''}">
        <input type="checkbox" data-q="${q.id}" ${q.done ? 'checked' : ''}>
        <span>${esc(q.text)}</span>
        <button class="btn danger" data-qdel="${q.id}">×</button>
      </label>`).join('')
      : '<p class="task-meta">Пока пусто — запиши первую мысль 💡</p>';

    list.querySelectorAll('[data-q]').forEach(cb => cb.onchange = () => {
      const items = getQuick();
      items.find(x => x.id === cb.dataset.q).done = cb.checked;
      DB.set('quick', items);
      render();
    });
    list.querySelectorAll('[data-qdel]').forEach(b => b.onclick = () => {
      DB.set('quick', getQuick().filter(x => x.id !== b.dataset.qdel));
      render();
    });
  };

  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    const items = getQuick();
    items.unshift({ id: uid(), text, done: false });
    DB.set('quick', items);
    input.value = '';
    input.focus();
    render();
  };

  addBtn.onclick = add;
  input.onkeydown = e => { if (e.key === 'Enter') add(); };
  render();
}

registerPage('today', renderToday);
