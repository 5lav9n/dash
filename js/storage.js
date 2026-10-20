/* ============================================================
   storage.js — единственный файл, который трогает localStorage.
   
   ВАЖНО ДЛЯ БУДУЩЕГО: когда появится бэкенд (сервер), 
   тебе нужно будет менять ТОЛЬКО этот файл — весь остальной
   код продолжит работать с DB.get() / DB.set().
   ============================================================ */

const DB = {
  // Читаем данные из localStorage по ключу (например, "tasks")
  // Если данных ещё нет — возвращаем запасной вариант (fallback)
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('dashboard_' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      // Если что-то сломалось (например, данные повреждены) — не падаем
      console.warn('Ошибка чтения ' + key, e);
      return fallback;
    }
  },

  // Сохраняем данные. JSON.stringify превращает объект в строку текста
  set(key, value) {
    localStorage.setItem('dashboard_' + key, JSON.stringify(value));
  },

  // Полный экспорт всех данных (пригодится для резервной копии)
  exportAll() {
    const out = {};
    ['tasks','notes','habits','transactions','subscriptions','goals','wishlist']
      .forEach(k => out[k] = this.get(k, []));
    return out;
  },

  // Полный импорт (восстановление из файла)
  importAll(data) {
    Object.keys(data).forEach(k => this.set(k, data[k]));
  }
};

// Стартовые категории задач (потом можно дать пользователю их редактировать)
const TASK_CATEGORIES = ['Работа', 'Учёба', 'Дом', 'Здоровье', 'Личное', 'Финансы'];
const FIN_CATEGORIES  = ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Обучение', 'Доход', 'Другое'];
