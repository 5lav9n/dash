/* ============================================================
   wishlist.js — модуль «Вишлист»
   Данные: { id, title, description, price, link, status, priority, goalId }
   status: 'want' (хочу) | 'saving' (коплю) | 'bought' (куплено)
   Связь с финансами: goalId указывает на финансовый план (goals),
   и мы показываем прогресс накоплений из этого плана.
   ============================================================ */

const WISH_STATUS = { want: 'Хочу', saving: 'Коплю', bought: 'Куплено' };
const WISH_PRIO   = { low: 'Низкий', mid: 'Средний', high: 'Высокий' };

function getWishlist() { return DB.get('wishlist', []); }

function renderWishlist(app) {
  const wishes = getWishlist();
  const goals = window.FinanceModule?.getGoals() || [];

  app.innerHTML = `
    <h2 class="page-title">⭐ Вишлист</h2>
    <p class="page-sub">Желания можно связать с финансовой целью и видеть прогресс накопления</p>
    <div class="form-row" style="margin-bottom:16px">
      <!-- v0.6: быстрое добавление одной строкой (парсер из notion.js):
           «500₽ наушники» или просто «наушники» — создастся желание -->
      ${window.Notion ? `<input id="w-quick" placeholder="⚡ Быстро: велосипед 15000₽ — и Enter" style="flex:2;min-width:220px">` : ''}
      <button class="btn" id="w-add" style="flex:0 0 auto">➕ Новое желание</button>
    </div>

    <div class="grid grid-2">
      ${wishes.length ? wishes.map(w => {
        // Если желание связано с планом — считаем прогресс из goals
        const goal = w.goalId ? goals.find(g => g.id === w.goalId) : null;
        const pct = goal && goal.targetSum > 0 ? Math.min(100, Math.round(goal.saved / goal.targetSum * 100)) : null;
        const statusCls = { want: 'todo', saving: 'progress', bought: 'done' }[w.status];
        return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <strong style="font-size:16px">${esc(w.title)}</strong>
            <span class="badge ${statusCls}">${WISH_STATUS[w.status]}</span>
          </div>
          ${w.description ? `<p style="font-size:14px;color:var(--muted);margin:6px 0">${esc(w.description)}</p>` : ''}
          <div class="task-meta" style="margin:6px 0">
            ${w.price ? `💸 ${money(w.price)} · ` : ''}<span class="dot" style="background:${PRIO_DOT[w.priority]}"></span>${WISH_PRIO[w.priority]}
          </div>
          ${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener" style="color:var(--accent)">🔗 Ссылка на товар</a><br>` : ''}
          ${goal ? `
            <div style="margin-top:10px;font-size:13px">🎯 ${esc(goal.title)}: ${money(goal.saved)} / ${money(goal.targetSum)}</div>
            <div class="progress" style="margin-top:4px"><div style="width:${pct}%"></div></div>
            <div style="font-size:12px;color:var(--muted)">${pct}% накоплено</div>` : ''}
          <div style="margin-top:12px;display:flex;gap:6px">
            <button class="btn small secondary" data-edit="${w.id}">✏️ Изменить</button>
            ${w.status !== 'bought' ? `<button class="btn small" data-buy="${w.id}">✅ Куплено</button>` : ''}
            <button class="btn danger" data-del="${w.id}">🗑</button>
          </div>
        </div>`;
      }).join('') : empty('Список желаний пуст — самое время его заполнить ✨')}
    </div>
  `;

  document.getElementById('w-add').onclick = () => editWish(null);

  // Быстрое добавление одной строкой: «велосипед 15000₽» → желание с ценой
  const wQuick = document.getElementById('w-quick');
  if (wQuick) wQuick.onkeydown = e => {
    if (e.key !== 'Enter' || !window.Notion) return;
    const p = window.Notion.quickParse(wQuick.value);
    if (!p.title) return;
    // ищем цену в исходной строке: число перед ₽ или «руб»
    const mPrice = String(wQuick.value).match(/(\d[\d\s]*)\s*(?:₽|руб)/i);
    const wishes = getWishlist();
    wishes.push({ id: uid(), title: p.title, description: '',
                  price: mPrice ? Number(mPrice[1].replace(/\s/g, '')) : 0,
                  status: 'want', priority: p.priority === 'high' ? 'high' : 'mid', link: '', goalId: null });
    DB.set('wishlist', wishes);
    wQuick.value = '';
    App.refresh();
  };
  app.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editWish(b.dataset.edit));
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('Удалить желание?')) return;
    DB.set('wishlist', getWishlist().filter(w => w.id !== b.dataset.del));
    App.refresh();
  });
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const wishes = getWishlist();
    wishes.find(w => w.id === b.dataset.buy).status = 'bought';
    DB.set('wishlist', wishes);
    App.refresh();
  });
}

// Форма создания/редактирования желания
function editWish(id) {
  const w = id ? getWishlist().find(x => x.id === id) : null;
  const goals = (window.FinanceModule?.getGoals() || []).filter(g => g.targetSum > 0);

  openModal(w ? 'Редактировать желание' : 'Новое желание', `
    <div class="form-row"><input id="w-title" placeholder="Что хочешь?" value="${esc(w?.title || '')}"></div>
    <div class="form-row"><textarea id="w-desc" placeholder="Описание">${esc(w?.description || '')}</textarea></div>
    <div class="form-row">
      <input id="w-price" type="number" placeholder="Примерная стоимость" value="${w?.price || ''}">
      <select id="w-status">
        ${Object.entries(WISH_STATUS).map(([v,l]) => `<option value="${v}" ${w?.status===v?'selected':''}>${l}</option>`).join('')}
      </select>
      <select id="w-prio">
        ${Object.entries(WISH_PRIO).map(([v,l]) => `<option value="${v}" ${(w?.priority||'mid')===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><input id="w-link" placeholder="Ссылка https://..." value="${esc(w?.link || '')}"></div>
    <div class="form-row">
      <select id="w-goal">
        <option value="">— не привязывать к финцели —</option>
        ${goals.map(g => `<option value="${g.id}" ${w?.goalId===g.id?'selected':''}>🎯 ${esc(g.title)}</option>`).join('')}
      </select>
    </div>
    <button class="btn" id="w-save">Сохранить</button>
  `, wrap => wrap.querySelector('#w-save').onclick = () => {
    const title = wrap.querySelector('#w-title').value.trim();
    if (!title) return;
    const data = {
      title,
      description: wrap.querySelector('#w-desc').value.trim(),
      price: Number(wrap.querySelector('#w-price').value) || 0,
      status: wrap.querySelector('#w-status').value,
      priority: wrap.querySelector('#w-prio').value,
      link: wrap.querySelector('#w-link').value.trim(),
      goalId: wrap.querySelector('#w-goal').value || null,
    };
    const wishes = getWishlist();
    if (w) Object.assign(w, data); // редактируем
    else wishes.push({ id: uid(), ...data });
    DB.set('wishlist', wishes);
    closeModal(); App.refresh();
  });
}

registerPage('wishlist', renderWishlist);
