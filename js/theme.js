/* ============================================================
   theme.js — тёмная / светлая тема.

   Как это работает (просто):
   1) В css/style.css все цвета записаны как переменные (--bg, --card...).
      Тема = класс "dark" на самом верхнем теге <html>: он перезаписывает
      эти переменные, и сайт перекрашивается целиком.
   2) Твой выбор запоминается в localStorage (ключ "theme"):
        "dark"   — всегда тёмная
        "light"  — всегда светлая
        "system" — повторять тему телефона/компьютера (по умолчанию)
   ============================================================ */

const THEME_KEY = 'theme'; // DB.get/set сами добавляют приставку dashboard_

// Определяем, какая тема реально должна быть показана сейчас.
// Возвращаем 'dark' или 'light'.
function resolveTheme() {
  const saved = DB.get(THEME_KEY, 'system');       // что выбрал человек
  if (saved === 'dark' || saved === 'light') return saved;
  // 'system' → спрашиваем у браузера: matchMedia = «медиа-запрос» из JS,
  // то же самое, что @media в CSS, только проверяется прямо в коде.
  // typeof === 'function' — проверка «существует ли такая функция в браузере»:
  // на совсем старых браузерах её нет — тогда просто остаёмся в светлой теме
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// Применяем тему к странице + обновляем иконку кнопки и цвет системной панели
function applyTheme() {
  const theme = resolveTheme();
  const root = document.documentElement;           // это и есть <html>
  root.classList.toggle('dark',  theme === 'dark');
  root.classList.toggle('light', theme === 'light'); // явный выбор человека

  // Иконка кнопки: показываем луну на светлой теме («включи тёмную»)
  // и солнышко на тёмной («верни светлую»)
  const icon = document.getElementById('theme-icon');
  if (icon && window.lucide) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun-medium' : 'moon');
    lucide.createIcons();
  }

  // Подсказка в кнопке — подсказываем, какой режим сейчас активен
  const btn = document.getElementById('theme-btn');
  if (btn) btn.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';

  // meta[name=theme-color] — цвет рамки браузера/статус-бара на iPhone:
  // подкрасим его в тон текущей теме, выглядит как настоящее приложение
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0e17' : '#f7f8fa');
}

// Клик по кнопке: переключаем тёмную↔светлую и запоминаем выбор.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.addEventListener('click', () => {
    const next = resolveTheme() === 'dark' ? 'light' : 'dark';
    DB.set(THEME_KEY, next);
    applyTheme();
  });

  // Если человек выбрал "system", а телефон сам переключит тему
  // (например, вечером) — мгновенно реагируем на это:
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // addEventListener здесь слушает не клики, а смену настройки ОС
    // (старые браузеры умеют только addListener — проверяем и это)
    if (mq.addEventListener)      mq.addEventListener('change', onSystemChange);
    else if (mq.addListener)      mq.addListener(onSystemChange);
  }
  function onSystemChange() {
    if (DB.get(THEME_KEY, 'system') === 'system') applyTheme();
  }
});

applyTheme(); // применяем сразу, чтобы страница не «вспыхивала» светлой темой
