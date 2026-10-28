// Общие заготовки для тестов фичи 002 (режимы игры). Не тест: scripts/check.sh
// запускает только tests/*.test.js. Проверок здесь нет — только поля и хранилища.
import { createGame } from "../src/game.js";

// Состояние партии режима modeId с заданной активной фигурой, занятыми клетками
// [x, y] и подменой полей extra — как stateWith в tests/game.test.js.
export function stateWith(active, filled = [], extra = {}, modeId = "marathon") {
  const state = createGame(1, modeId);
  const board = state.board.map((row) => [...row]);
  for (const [x, y] of filled) board[y][x] = "Z";
  return { ...state, ...extra, board, active };
}

// Клетки строк rows, занятые везде, кроме столбцов holes.
export function fullRowsExcept(rows, holes) {
  const gaps = Array.isArray(holes) ? holes : [holes];
  const cells = [];
  for (const y of rows) {
    for (let x = 0; x < 10; x++) if (!gaps.includes(x)) cells.push([x, y]);
  }
  return cells;
}

// Готовые фиксации. Активная фигура уже стоит на опоре, поэтому tick фиксирует
// её без очков за спуск.

// Тетрис: строки 16–19 заняты, кроме столбца 5; вертикальная I на дне колодца.
export function tetrisLock(extra = {}, modeId = "marathon") {
  const active = { type: "I", rotation: 1, x: 3, y: 16 };
  return stateWith(active, fullRowsExcept([16, 17, 18, 19], 5), { next: "T", ...extra }, modeId);
}

// Одна строка: строка 19 занята, кроме столбцов 3–6; горизонтальная I закрывает её.
export function singleLock(extra = {}, modeId = "marathon") {
  const active = { type: "I", rotation: 0, x: 3, y: 18 };
  return stateWith(active, fullRowsExcept([19], [3, 4, 5, 6]), { next: "T", ...extra }, modeId);
}

// Две строки: строки 18–19 заняты, кроме столбцов 4–5; O закрывает обе.
export function doubleLock(extra = {}, modeId = "marathon") {
  const active = { type: "O", rotation: 0, x: 4, y: 18 };
  return stateWith(active, fullRowsExcept([18, 19], [4, 5]), { next: "T", ...extra }, modeId);
}

// Фиксация без строк: O на дне пустого поля.
export function emptyLock(extra = {}, modeId = "marathon") {
  return stateWith({ type: "O", rotation: 0, x: 0, y: 18 }, [], { next: "T", ...extra }, modeId);
}

// Переполнение: O на дне, клетка (4, 1) перекрывает точку появления T (как в A6).
export function topOutLock(extra = {}, modeId = "marathon") {
  return stateWith({ type: "O", rotation: 0, x: 0, y: 18 }, [[4, 1]], { next: "T", ...extra }, modeId);
}

// Web Storage в памяти, как в tests/record.test.js.
export class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

// Хранилище, бросающее при чтении и/или записи (квота, запрет сайта).
export function throwingStorage({ read = false, write = false } = {}, items = {}) {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(items)) storage.setItem(key, value);
  return {
    getItem(key) {
      if (read) throw new Error("SecurityError");
      return storage.getItem(key);
    },
    setItem(key, value) {
      if (write) throw new Error("QuotaExceededError");
      storage.setItem(key, value);
    },
  };
}
