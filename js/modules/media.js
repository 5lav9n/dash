/* ============================================================
   media.js — модуль «Медиатека» (книги / фильмы / сериалы)
   Данные: { id, kind:'book'|'movie'|'series', title, author/director,
             year, status, progress, rating, note }
   status по-русски: 'Хочу' | 'Смотрю/Читаю' | 'Готово' | 'Брошено'
   Сериалы имеют поле seasons — количество сезонов.
   Обложки не храним (localStorage маленький) — только текст.
   ============================================================ */

const MEDIA_KINDS = { book: '📚 Книга', movie: '🎬 Фильм', series: '📺 Сериал' };
const MEDIA_STATUS = ['Хочу', 'Смотрю/Читаю', 'Готово', 'Брошено'];
const STATUS_BADGE = { 'Хочу': 'todo', 'Смотрю/Читаю': 'progress', 'Готово': 'done', 'Брошено': 'overdue' };

let mediaFilter = 'all'; // all | book | movie | series

function getMedia() { return DB.get('media', []); }

function renderMedia(app) {
  let items = getMedia();
  if (mediaFilter !== 'all') items = items.filter(x => x.kind === mediaFilter);

  app.innerHTML = `
    <h2 class="page-title">🎬 Медиатека</h2>
    <p class="page-sub">Книги, фильмы и сериалы: что посмотрел, что читаешь, что в планах</p>

    <div class="filters">
      <button class="btn" id="m-add-book">➕ 📚 Книга</button>
      <button class="btn" id="m-add-movie">➕ 🎬 Фильм</button>
      <button class="btn" id="m-add-series">➕ 📺 Сериал</button>
      <select id="m-filter" style="max-width:180px;margin-left:auto">
        <option value="all">Всё</option>
        <option value="book" ${mediaFilter==='book'?'selected':''}>Книги</option>
        <option value="movie" ${mediaFilter==='movie'?'selected':''}>Фильмы</option>
        <option value="series" ${mediaFilter==='series'?'selected':''}>Сериалы</option>
      </select>
    </div>

    <div class="grid grid-3">
      ${items.length ? items.map(x => `
        <div class="card media-card">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:6px">
            <strong>${MEDIA_KINDS[x.kind].split(' ')[0]} ${esc(x.title)}</strong>
            <span class="badge ${STATUS_BADGE[x.status]}">${x.status}</span>
          </div>
          <div class="task-meta" style="margin:6px 0">
            ${x.author ? esc(x.author) + ' · ' : ''}${x.year || ''}
            ${x.kind === 'series' && x.seasons ? ` · ${x.seasons} сезон(а)` : ''}
          </div>
          ${x.note ? `<p style="font-size:13px;color:var(--muted);margin:4px 0">${esc(x.note)}</p>` : ''}
          ${x.status === 'Смотрю/Читаю' && x.total ? `
            <div class="progress" style="margin:8px 0 4px"><div style="width:${Math.min(100, Math.round(x.progress / x.total * 100))}%"></div></div>
            <div class="task-meta">${x.progress} из ${x.total} ${x.kind === 'book' ? 'стр.' : 'эп.'}</div>` : ''}
          ${x.rating ? `<div style="margin-top:6px;color:var(--amber)">★ ${'★'.repeat(x.rating - 1)}${x.rating} / 5</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            ${x.status !== 'Готово' ? `<button class="btn small" data-done="${x.id}">✅ Готово</button>` : ''}
            ${x.status === 'Хочу' ? `<button class="btn small secondary" data-start="${x.id}">▶ Начать</button>` : ''}
            <button class="btn small secondary" data-edit="${x.id}">✏️</button>
            <button class="btn danger" data-del="${x.id}">🗑</button>
          </div>
        </div>`).join('') : empty('Пусто. Добавь первую книгу или фильм ✨')}
    </div>
  `;

  document.getElementById('m-add-book').onclick   = () => editMedia(null, 'book');
  document.getElementById('m-add-movie').onclick  = () => editMedia(null, 'movie');
  document.getElementById('m-add-series').onclick = () => editMedia(null, 'series');
  document.getElementById('m-filter').onchange    = e => { mediaFilter = e.target.value; App.refresh(); };

  app.querySelectorAll('[data-done]').forEach(b => b.onclick = () => setStatus(b.dataset.done, 'Готово'));
  app.querySelectorAll('[data-start]').forEach(b => b.onclick = () => setStatus(b.dataset.start, 'Смотрю/Читаю'));
  app.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editMedia(b.dataset.edit));
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('Удалить из медиатеки?')) return;
    DB.set('media', getMedia().filter(x => x.id !== b.dataset.del));
    App.refresh();
  });
}

function setStatus(id, status) {
  const items = getMedia();
  const x = items.find(i => i.id === id);
  x.status = status;
  if (status === 'Готово' && x.total) x.progress = x.total;
  DB.set('media', items);
  App.refresh();
}

// Форма добавления/редактирования
function editMedia(id, kind) {
  const x = id ? getMedia().find(i => i.id === id) : null;
  const k = x?.kind || kind || 'book';
  const what = { book: 'книги', movie: 'фильма', series: 'сериала' }[k];

  openModal(x ? 'Редактировать' : `Новая запись: ${MEDIA_KINDS[k]}`, `
    <div class="form-row"><input id="md-title" placeholder="Название ${what}" value="${esc(x?.title || '')}"></div>
    <div class="form-row">
      <input id="md-author" placeholder="${k === 'book' ? 'Автор' : 'Режиссёр / шоураннер'}" value="${esc(x?.author || '')}">
      <input id="md-year" type="number" placeholder="Год" value="${x?.year || ''}" style="flex:0 0 110px">
    </div>
    ${k === 'series' ? `<div class="form-row"><input id="md-seasons" type="number" min="1" placeholder="Сколько сезонов" value="${x?.seasons || ''}"></div>` : ''}
    <div class="form-row">
      <select id="md-status">${MEDIA_STATUS.map(s => `<option ${x?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select id="md-rating" style="flex:0 0 130px">
        <option value="">Без оценки</option>
        ${[1,2,3,4,5].map(n => `<option value="${n}" ${x?.rating === n ? 'selected' : ''}>★ ${n}</option>`).join('')}
      </select>
    </div>
    ${k !== 'movie' ? `<div class="form-row">
      <input id="md-progress" type="number" placeholder="${k === 'book' ? 'Прочитано стр.' : 'Смотрено эп.'}" value="${x?.progress || ''}">
      <input id="md-total" type="number" placeholder="${k === 'book' ? 'Всего стр.' : 'Всего эп.'}" value="${x?.total || ''}">
    </div>` : ''}
    <div class="form-row"><textarea id="md-note" placeholder="Заметка / впечатление">${esc(x?.note || '')}</textarea></div>
    <button class="btn" id="md-save">Сохранить</button>
  `, wrap => wrap.querySelector('#md-save').onclick = () => {
    const title = wrap.querySelector('#md-title').value.trim();
    if (!title) return;
    const data = {
      kind: k,
      title,
      author: wrap.querySelector('#md-author').value.trim(),
      year: Number(wrap.querySelector('#md-year').value) || null,
      status: wrap.querySelector('#md-status').value,
      rating: Number(wrap.querySelector('#md-rating').value) || 0,
      note: wrap.querySelector('#md-note').value.trim(),
    };
    if (k === 'series') data.seasons = Number(wrap.querySelector('#md-seasons').value) || null;
    if (k !== 'movie') {
      data.progress = Number(wrap.querySelector('#md-progress').value) || 0;
      data.total = Number(wrap.querySelector('#md-total').value) || 0;
    }
    const items = getMedia();
    if (x) Object.assign(x, data); else items.push({ id: uid(), ...data });
    DB.set('media', items);
    closeModal(); App.refresh();
  });
}

registerPage('media', renderMedia);
window.MediaModule = { getMedia };
