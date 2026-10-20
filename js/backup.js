/* ============================================================
   backup.js — экспорт и импорт всех данных в JSON-файл.
   
   Зачем это нужно уже сейчас:
   1) Резервная копия — если почистишь браузер, данные вернутся за 10 секунд.
   2) Перенос на другое устройство — скачал файл на ноутбуке, загрузил на телефоне.
      (Когда появится бэкенд и синхронизация, эта функция останется «запасной».)
   ============================================================ */

// —— ЭКСПОРТ: собираем все данные и «скачиваем» как файл ——————————
document.getElementById('export-btn').addEventListener('click', () => {
  const data = DB.exportAll();
  // Blob — объект с текстом/данными, из которого браузер делает файл для скачивания
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');       // невидимая ссылка
  a.href = URL.createObjectURL(blob);          // адрес файла в памяти браузера
  a.download = `dashboard-backup-${todayStr()}.json`; // имя файла при скачивании
  a.click();
});

// —— ИМПОРТ: выбираем файл и заменяем им все данные ————————————————
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click(); // открываем окно выбора файла
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();      // читает файл по частям
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result); // текст файла -> объект
      if (!confirm('Заменить ВСЕ текущие данными из файла?')) return;
      DB.importAll(data);
      App.refresh();
      alert('Данные загружены ✓');
    } catch (err) {
      alert('Файл повреждён или это не наш JSON :(');
    }
  };
  reader.readAsText(file);
});
