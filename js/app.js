/* ============================================================
   app.js — «дирижёр» приложения: переключение страниц.

   ВАЖНО: этот файл подключается в index.html ПЕРВЫМ из скриптов,
   потому что модули вызывают registerPage(...) сразу при загрузке —
   функция и хранилище страниц должны существовать до них.

   Каждый модуль — это файл в js/modules/, который регистрирует
   себя так: registerPage('tasks', renderTasks)
   Это нужно, чтобы модули ничего не знали друг о друге
   и их легко было отключать/заменять.
   ============================================================ */

var pages = {}; // сюда модули записывают свои функции рисования

// Красивые названия разделов и сегодняшняя дата для шапки сверху.
// Обновляем их каждый раз, когда показываем новую страницу.
const PAGE_TITLES = {
  today: 'Сегодня', tasks: 'Задачи', calendar: 'Календарь', notes: 'Заметки',
  habits: 'Привычки', finance: 'Финансы', wishlist: 'Вишлист'
};
function updateTopbar(name) {
  const h = document.getElementById('topbar-heading');
  const d = document.getElementById('topbar-date');
  if (h) h.textContent = PAGE_TITLES[name] || 'Мой дашборд';
  if (d) d.textContent = new Intl.DateTimeFormat('ru-RU',
    { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

// Объект приложения. Модули вызывают App.refresh() после изменений,
// чтобы перерисовать текущую страницу.
const App = {
  currentPage: null,
  refresh() { showPage(this.currentPage); }
};

function registerPage(name, renderFn) {
  pages[name] = renderFn;
}

// Показать страницу по имени (например, "tasks")
function showPage(name) {
  if (!pages[name]) name = 'today'; // защита от опечатки в адресе
  App.currentPage = name;
  const app = document.getElementById('app');
  app.innerHTML = '';                      // очистили старую страницу
  if (pages[name]) pages[name](app);       // модуль нарисовал новую

  // Подсветка активной кнопки в меню + обновление шапки сверху.
  // (пишем через classList, а не через className — так безопаснее:
  //  если внутри есть SVG-иконки, className у них работает иначе)
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.page === name));
  updateTopbar(name);

  // Перерисовываем линейные иконки Lucide, которые появились внутри модулей.
  // (функция есть только если библиотека иконок загрузилась — проверяем это)
  if (window.lucide) lucide.createIcons();

  // Запоминаем открытую страницу в адресной строке (#tasks).
  // При следующем открытии сайта вернёмся на ту же вкладку.
  history.replaceState(null, '', '#' + name);
}

// Навешиваем клики на кнопки меню (делаем один раз при загрузке)
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// Кнопка «Резервная копия» в шапке делает то же самое, что пункт в левом меню
const exportTop = document.getElementById('export-btn-top');
if (exportTop) exportTop.addEventListener('click', () =>
  document.getElementById('export-btn').click());

// Старт: открываем страницу из адреса (или «Сегодня» по умолчанию)
showPage(location.hash.slice(1) || 'today');

// Иконки в самой оболочке (меню и шапка) рисуем один раз при загрузке
if (window.lucide) lucide.createIcons();
