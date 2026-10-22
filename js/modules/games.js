/* ============================================================
   games.js — мини-игры на экране «Сегодня» (для ребёнка)
   1) Переводчик: маленький словарик EN→RU, угадываем перевод
      среди 4 вариантов. Счёт сохраняется в localStorage.
   2) Географ: столица какой это страны? (свой список пар).
   3) «Факт дня»: показываем один факт, кнопка «ещё» листает.
   Всё офлайн — никаких внешних запросов.
   ============================================================ */

// —— Словарик для игры 1 ——————————————————————
const WORDS = [
  ['cat','кошка'], ['dog','собака'], ['sun','солнце'], ['moon','луна'],
  ['water','вода'], ['bread','хлеб'], ['house','дом'], ['tree','дерево'],
  ['book','книга'], ['friend','друг'], ['school','школа'], ['happy','счастливый'],
  ['blue','синий'], ['green','зелёный'], ['big','большой'], ['small','маленький'],
  ['run','бегать'], ['jump','прыгать'], ['sleep','спать'], ['eat','есть/кушать'],
  ['apple','яблоко'], ['milk','молоко'], ['bird','птица'], ['fish','рыба'],
  ['star','звезда'], ['snow','снег'], ['rain','дождь'], ['fire','огонь'],
  ['door','дверь'], ['window','окно'], ['table','стол'], ['chair','стул'],
];

// —— Столицы для игры 2 ————————————————————————
const CAPITALS = [
  ['Россия','Москва'], ['Франция','Париж'], ['Германия','Берлин'], ['Италия','Рим'],
  ['Испания','Мадрид'], ['Англия','Лондон'], ['Япония','Токио'], ['Китай','Пекин'],
  ['США','Вашингтон'], ['Канада','Оттава'], ['Бразилия','Бразилиа'], ['Египет','Каир'],
  ['Турция','Анкара'], ['Греция','Афины'], ['Польша','Варшава'], ['Норвегия','Осло'],
  ['Швеция','Стокгольм'], ['Финляндия','Хельсинки'], ['Индия','Нью-Дели'], ['Австралия','Канберра'],
];

// —— Факты дня ——————————————————————————————————
const FACTS = [
  '🐙 У осьминога три сердца и голубая кровь!',
  '🍯 Мёд не портится вообще — нашли съедобный мёд возрастом 3000 лет!',
  '🌋 На Венере день длиннее, чем год.',
  '🦈 Акулы существуют дольше, чем деревья.',
  '🧠 Человеческий мозг вырабатывает достаточно электричества, чтобы зажечь лампочку.',
  '🐝 Пчела может узнать лицо человека.',
  '🌍 Банан — ягода, а клубника — нет!',
  '🦒 У жирафа такое же количество шейных позвонков, как у человека — семь.',
  '⚡ Молния в пять раз горячее поверхности Солнца.',
  '🐬 Дельфины спят с одним открытым глазом.',
  '🪐 День на Юпитере длится всего 10 часов.',
  '🦶 Слоны — единственные животные, которые не могут прыгать.',
  '💧 Пресной воды на Земле меньше 3%.',
  '📚 Самая старая книге в мире — китайская «Алмазная сутра» (868 год).',
];

// Случайный элемент массива
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Смешать 4 варианта, правильный — помечаем
function makeOptions(correct, all, selfKey) {
  const wrongs = [];
  while (wrongs.length < 3) {
    const w = pick(all);
    if (w[selfKey] !== correct[selfKey] && !wrongs.includes(w)) wrongs.push(w);
  }
  return shuffle([correct, ...wrongs]); // перемешиваем порядок
}

// Текущее состояние игр (переменные живут внутри модуля)
let wordScore = DB.get('wordScore', 0);
let capScore  = DB.get('capScore', 0);
let curWord, curCap, factIdx = Math.floor(Math.random() * FACTS.length);

// —— Игра 1: карточка переводчика ————————————————
function newWordRound() {
  curWord = pick(WORDS);
  const opts = makeOptions({ en: curWord[0], ru: curWord[1] },
                            WORDS.map(w => ({ en: w[0], ru: w[1] })), 'ru');
  document.getElementById('game-word').innerHTML = `
    <div class="q-box">
      <div class="q-big">${esc(curWord[0])}</div>
      <div class="q-sub">Что это значит?</div>
      <div class="answers">
        ${opts.map(o => `<button class="btn answer" data-a="${esc(o.ru)}">${esc(o.ru)}</button>`).join('')}
      </div>
      <div class="score-line">🏆 Очки: <b id="ws-${Date.now()}">${wordScore}</b></div>
    </div>`;
  document.querySelectorAll('#game-word .answer').forEach(b => b.onclick = () => {
    if (b.dataset.a === curWord[1]) {
      wordScore++; DB.set('wordScore', wordScore);
      b.classList.add('right');
    } else { b.classList.add('wrong'); wordScore = Math.max(0, wordScore - 1); DB.set('wordScore', wordScore); }
    setTimeout(newWordRound, 700);
  });
}

// —— Игра 2: географ ——————————————————————————————
function newCapRound() {
  curCap = pick(CAPITALS);
  const opts = makeOptions({ c: curCap[0], s: curCap[1] },
                            CAPITALS.map(x => ({ c: x[0], s: x[1] })), 's');
  document.getElementById('game-cap').innerHTML = `
    <div class="q-box">
      <div class="q-big">🌍 ${esc(curCap[0])}</div>
      <div class="q-sub">Столица этой страны?</div>
      <div class="answers">
        ${opts.map(o => `<button class="btn answer" data-a="${esc(o.s)}">${esc(o.s)}</button>`).join('')}
      </div>
      <div class="score-line">🏆 Очки: <b>${capScore}</b></div>
    </div>`;
  document.querySelectorAll('#game-cap .answer').forEach(b => b.onclick = () => {
    if (b.dataset.a === curCap[1]) {
      capScore++; DB.set('capScore', capScore); b.classList.add('right');
    } else { b.classList.add('wrong'); capScore = Math.max(0, capScore - 1); DB.set('capScore', capScore); }
    setTimeout(newCapRound, 700);
  });
}

// —— Игра 3: факт дня ——————————————————————————————
function showFact() {
  document.getElementById('game-fact').innerHTML = `
    <div class="q-box">
      <div class="fact-text">${FACTS[factIdx]}</div>
      <button class="btn secondary" id="fact-next">Ещё факт 🎲</button>
    </div>`;
  document.getElementById('fact-next').onclick = () => {
    factIdx = (factIdx + 1) % FACTS.length;
    showFact();
  };
}

// Общий виджет: вставляется в страницу «Сегодня»
function renderGamesWidget(container) {
  container.innerHTML = `
    <h3 style="margin-bottom:10px">🎮 Игры и развитие</h3>
    <div class="games-grid">
      <div class="game-card" id="game-word"></div>
      <div class="game-card" id="game-cap"></div>
      <div class="game-card wide" id="game-fact"></div>
    </div>`;
  newWordRound();
  newCapRound();
  showFact();
}

window.GamesModule = { renderGamesWidget };
