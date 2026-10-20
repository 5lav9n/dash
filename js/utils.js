/* ============================================================
   utils.js — мелкие полезные функции, которые используются везде
   ============================================================ */

// Генератор уникального id для элементов (задач, заметок...).
// Date.now() — текущее время в миллисекундах + случайные цифры.
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Сегодняшняя дата в формате "ГГГГ-ММ-ДД" (например 2026-10-20).
// Такой формат удобен: его можно сравнивать как текст — "2026-10-21" > "2026-10-20".
function todayStr(date) {
  const d = date || new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0'); // месяцы считаются с 0!
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Красивая дата для показа человеку: "20 октября 2026"
function prettyDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00'); // T00:00:00 — чтобы часовой пояс не сдвигал дату
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Название месяца: "октябрь"
function monthName(year, month) {
  return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

// Короткий день недели: пн, вт...
function weekdayShort(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short' });
}

// Формат денег: 12345 -> "12 345 ₽"
function money(sum) {
  return Number(sum).toLocaleString('ru-RU') + ' ₽';
}

// Экранирование текста перед вставкой в HTML.
// ЗАЧЕМ: если пользователь введет "<script>", без этой функции
// браузер попытается это выполнить. Мы заменяем опасные символы на безопасные.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

// Понедельник недели, к которой относится дата (для модуля привычек)
function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // воскресенье=0, а нам нужен понедельник=0
  d.setDate(d.getDate() - day);
  return d;
}
