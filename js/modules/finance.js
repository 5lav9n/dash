/* ============================================================
   finance.js — модуль «Финансы»
   Три сущности:
   1) transactions  — операции { id, type:'income'|'expense', sum, category, date, comment }
   2) subscriptions — подписки { id, name, price, chargeDay, active }
   3) goals         — финпланы { id, title, targetSum, saved, targetDate, goalType, wishId? }
      goalType: 'save' (накопить), 'pay' (оплатить), 'buy' (купить), 'custom' (из календаря)
   ============================================================ */

let finMonth = todayStr().slice(0, 7); // "2026-10" — выбранный месяц отчёта

function getTx()    { return DB.get('transactions', []); }
function getSubs()  { return DB.get('subscriptions', []); }
function getGoals() { return DB.get('goals', []); }

function renderFinance(app) {
  const txs = getTx();
  const subs = getSubs();
  const goals = getGoals();

  // Операции выбранного месяца: строка даты начинается на "2026-10"
  const monthTxs = txs.filter(t => t.date.startsWith(finMonth));
  const income  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.sum), 0);
  const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.sum), 0);
  // Баланс = все доходы минус все расходы за всё время
  const balance = txs.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * Number(t.sum), 0);

  // Ближайшие списания подписок в течение 14 дней
  const soonSubs = subs.filter(s => s.active).map(s => {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), s.chargeDay); // списание в этом месяце
    if (todayStr(d) < todayStr()) { // день уже прошёл — считаем следующий месяц
      d = new Date(now.getFullYear(), now.getMonth() + 1, s.chargeDay);
    }
    const daysLeft = Math.round((new Date(todayStr(d)) - new Date(todayStr())) / 86400000); // мс в сутках
    return { ...s, nextDate: todayStr(d), daysLeft };
  }).sort((a, b) => a.daysLeft - b.daysLeft).filter(s => s.daysLeft <= 14);

  app.innerHTML = `
    <h2 class="page-title">💰 Финансы</h2>
    <p class="page-sub">Все данные хранятся локально в твоём браузере</p>

    <!-- Итоговые карточки -->
    <div class="grid grid-3">
      <div class="card sum-card"><span class="badge">Баланс</span>
        <div class="sum-value ${balance >= 0 ? 'plus' : 'minus'}">${money(balance)}</div></div>
      <div class="card sum-card"><span class="badge">Доход за месяц</span>
        <div class="sum-value plus">+${money(income)}</div></div>
      <div class="card sum-card"><span class="badge">Расход за месяц</span>
        <div class="sum-value minus">−${money(expense)}</div></div>
    </div>

    <!-- Добавление операции -->
    <div class="card">
      <h3 style="margin-bottom:10px">➕ Новая операция</h3>
      <div class="form-row">
        <select id="tx-type" style="flex:0 0 130px">
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input id="tx-sum" type="number" min="0" placeholder="Сумма" style="flex:0 0 120px">
        <select id="tx-cat">${FIN_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
        <input id="tx-date" type="date" value="${todayStr()}" style="flex:0 0 160px">
        <input id="tx-comment" placeholder="Комментарий">
        <button class="btn" id="tx-add" style="flex:0 0 auto">Добавить</button>
      </div>
    </div>

    <div class="grid grid-2">
      <!-- История операций -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <h3>Операции</h3>
          <input type="month" id="fin-month" value="${finMonth}" style="margin-left:auto">
        </div>
        ${monthTxs.length ? monthTxs.sort((a,b) => b.date.localeCompare(a.date)).map(t => `
          <div class="tx-row">
            <span>${t.type === 'income' ? '📈' : '📉'}</span>
            <div>
              <div>${esc(t.comment || t.category)}</div>
              <div class="task-meta">${prettyDate(t.date)} · <span class="badge cat">${esc(t.category)}</span></div>
            </div>
            <div class="tx-sum ${t.type === 'income' ? 'in' : 'out'}">${t.type === 'income' ? '+' : '−'}${money(t.sum)}</div>
            <button class="btn danger" data-del-tx="${t.id}">×</button>
          </div>`).join('') : '<p class="page-sub">В этом месяце операций нет</p>'}
      </div>

      <!-- Подписки -->
      <div class="card">
        <div style="display:flex;align-items:center;margin-bottom:8px">
          <h3>Подписки</h3>
          <button class="btn small" id="sub-add" style="margin-left:auto">➕</button>
        </div>
        ${soonSubs.length ? `<p style="font-size:13px;color:var(--red);margin-bottom:8px">⏰ Скоро: ${soonSubs.map(s => `${esc(s.name)} (${s.daysLeft} дн.)`).join(', ')}</p>` : ''}
        ${subs.length ? subs.map(s => `
          <div class="tx-row">
            <span>🔁</span>
            <div><div>${esc(s.name)}</div><div class="task-meta">каждый месяц, ${s.chargeDay}-го числа</div></div>
            <div class="tx-sum out">${money(s.price)}</div>
            <button class="btn danger" data-del-sub="${s.id}">×</button>
          </div>`).join('') : '<p class="page-sub">Подписок нет</p>'}
      </div>
    </div>

    <!-- Финансовые планы -->
    <div class="card">
      <div style="display:flex;align-items:center;margin-bottom:8px">
        <h3>Финансовые планы 🎯</h3>
        <button class="btn small" id="goal-add" style="margin-left:auto">➕ План</button>
      </div>
      ${goals.length ? goals.map(g => {
        const pct = g.targetSum > 0 ? Math.min(100, Math.round(g.saved / g.targetSum * 100)) : 0;
        return `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:14px">
            <span><strong>${esc(g.title)}</strong> <span class="badge">${{save:'Накопить',pay:'Оплатить',buy:'Купить',custom:'План'}[g.goalType]||''}</span>
              ${g.targetDate ? `<span class="task-meta">до ${prettyDate(g.targetDate)}</span>` : ''}</span>
            <span>${money(g.saved)} / ${money(g.targetSum)} <button class="btn danger" data-del-goal="${g.id}">×</button></span>
          </div>
          <div class="progress"><div style="width:${pct}%"></div></div>
          ${g.targetSum > 0 && pct < 100 ? `<button class="btn small secondary" style="margin-top:6px" data-topup="${g.id}">+ пополнить</button>` : ''}
        </div>`;
      }).join('') : '<p class="page-sub">Планов нет. Например: «Накопить на отпуск» 🏖</p>'}
    </div>
  `;

  // —— Обработчики ——————————————————————————
  document.getElementById('tx-add').onclick = () => {
    const sum = Number(document.getElementById('tx-sum').value);
    if (!sum || sum <= 0) { alert('Введи сумму'); return; }
    const txs = getTx();
    txs.push({
      id: uid(),
      type: document.getElementById('tx-type').value,
      sum,
      category: document.getElementById('tx-cat').value,
      date: document.getElementById('tx-date').value || todayStr(),
      comment: document.getElementById('tx-comment').value.trim(),
    });
    DB.set('transactions', txs);
    App.refresh();
  };

  document.getElementById('fin-month').onchange = e => { finMonth = e.target.value; App.refresh(); };

  app.querySelectorAll('[data-del-tx]').forEach(b => b.onclick = () => {
    DB.set('transactions', getTx().filter(t => t.id !== b.dataset.delTx));
    App.refresh();
  });

  document.getElementById('sub-add').onclick = () => {
    openModal('Новая подписка', `
      <div class="form-row"><input id="s-name" placeholder="Название (Netflix, Spotify...)"></div>
      <div class="form-row">
        <input id="s-price" type="number" placeholder="Цена в месяц">
        <input id="s-day" type="number" min="1" max="31" placeholder="День списания">
      </div>
      <button class="btn" id="s-save">Сохранить</button>
    `, wrap => wrap.querySelector('#s-save').onclick = () => {
      const name = wrap.querySelector('#s-name').value.trim();
      const price = Number(wrap.querySelector('#s-price').value);
      const chargeDay = Number(wrap.querySelector('#s-day').value) || 1;
      if (!name || !price) return;
      const subs = getSubs();
      subs.push({ id: uid(), name, price, chargeDay, active: true });
      DB.set('subscriptions', subs);
      closeModal(); App.refresh();
    });
  };

  app.querySelectorAll('[data-del-sub]').forEach(b => b.onclick = () => {
    DB.set('subscriptions', getSubs().filter(s => s.id !== b.dataset.delSub));
    App.refresh();
  });

  document.getElementById('goal-add').onclick = () => {
    openModal('Финансовый план', `
      <div class="form-row"><input id="g-title" placeholder="Цель (например: накопить на велосипед)"></div>
      <div class="form-row">
        <input id="g-sum" type="number" placeholder="Сумма цели">
        <select id="g-type">
          <option value="save">Накопить</option>
          <option value="pay">Оплатить</option>
          <option value="buy">Купить</option>
        </select>
        <input id="g-date" type="date" placeholder="К какой дате">
      </div>
      <button class="btn" id="g-save">Создать</button>
    `, wrap => wrap.querySelector('#g-save').onclick = () => {
      const title = wrap.querySelector('#g-title').value.trim();
      if (!title) return;
      const goals = getGoals();
      goals.push({
        id: uid(), title,
        targetSum: Number(wrap.querySelector('#g-sum').value) || 0,
        saved: 0,
        targetDate: wrap.querySelector('#g-date').value,
        goalType: wrap.querySelector('#g-type').value,
      });
      DB.set('goals', goals);
      closeModal(); App.refresh();
    });
  };

  app.querySelectorAll('[data-del-goal]').forEach(b => b.onclick = () => {
    DB.set('goals', getGoals().filter(g => g.id !== b.dataset.delGoal));
    App.refresh();
  });

  // Пополнение плана: добавляем расход + увеличиваем saved
  app.querySelectorAll('[data-topup]').forEach(b => b.onclick = () => {
    const sum = Number(prompt('Сколько отложить в этот план?'));
    if (!sum || sum <= 0) return;
    const goals = getGoals();
    const g = goals.find(x => x.id === b.dataset.topup);
    g.saved += sum;
    DB.set('goals', goals);
    const txs = getTx();
    txs.push({ id: uid(), type: 'expense', sum, category: 'Накопления', date: todayStr(), comment: 'План: ' + g.title });
    DB.set('transactions', txs);
    App.refresh();
  });
}

registerPage('finance', renderFinance);
window.FinanceModule = { getGoals, getSubs };
