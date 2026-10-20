/* ============================================================
   ui.js — общие элементы интерфейса, используемые всеми модулями
   ============================================================ */

// Показ модального окна (всплывающая карточка поверх страницы).
// title — заголовок, html — содержимое, onOpen — функция после открытия
function openModal(title, html, onOpen) {
  closeModal(); // на всякий случай закрываем предыдущее
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.id = 'modal-wrap';
  wrap.innerHTML = `
    <div class="card modal">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn modal-x" title="Закрыть">✕</button></div>
      ${html}
    </div>`;
  document.body.appendChild(wrap);
  // Клик по крестику или по тёмному фону за окном — закрыть
  wrap.querySelector('.modal-x').addEventListener('click', closeModal);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(); });
  if (onOpen) onOpen(wrap);
}

function closeModal() {
  document.getElementById('modal-wrap')?.remove();
}

// Закрыть модалку по клавише Esc
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Быстрая кнопка «+ Добавить» в шапке страницы
function addBtn(text, onClick) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = text;
  b.onclick = onClick;
  return b;
}

// Пусто-заглушка, когда список пуст
function empty(text) {
  return `<div class="card" style="text-align:center;color:var(--muted)">${text}</div>`;
}
