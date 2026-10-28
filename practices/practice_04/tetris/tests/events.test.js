// Фича 002 — события для подписей и правило объекта (LG FR-040…FR-042, FR-050).
import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTime,
  createGame,
  hardDrop,
  hold,
  moveLeft,
  moveRight,
  rotate,
  softDrop,
  spawnPiece,
  tick,
} from "../src/game.js";
import { doubleLock, emptyLock, singleLock, stateWith, tetrisLock } from "./support.js";

// ---------- LG FR-042: в новом объекте только события этого вызова ----------

const STALE = [{ type: "tetris", bonus: 0 }];

// Свободная T посреди пустого поля: любой ход меняет состояние.
function freeT() {
  return stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { next: "O", events: STALE });
}

const MOVES = [
  ["moveLeft", moveLeft, freeT],
  ["moveRight", moveRight, freeT],
  ["rotate", rotate, freeT],
  ["hold", hold, freeT],
  ["tick без фиксации", tick, freeT],
  ["softDrop без фиксации", softDrop, freeT],
  ["hardDrop без строк", hardDrop, freeT],
  ["tick с фиксацией без строк", tick, () => emptyLock({ events: STALE })],
  ["advanceTime", (state) => advanceTime(state, 16), freeT],
];

for (const [label, action, make] of MOVES) {
  test(`LG FR-042: ${label} не переносит прежние события в новый объект`, () => {
    const state = make();
    const after = action(state);
    assert.notEqual(after, state);
    assert.deepEqual(after.events, []);
  });
}

test("LG FR-042: отменённый поворот возвращает тот же объект", () => {
  // Вертикальная I у левой стены в колодце шириной 1: повернуть некуда.
  const filled = [];
  for (let y = 0; y < 20; y++) filled.push([3, y]);
  const state = stateWith({ type: "I", rotation: 1, x: 0, y: 5 }, filled, { events: STALE });
  assert.equal(rotate(state), state);
});

test("LG FR-042: повторный hold до фиксации возвращает тот же объект", () => {
  const held = hold(stateWith(spawnPiece("T"), [], { next: "O" }));
  assert.equal(hold(held), held);
});

test("LG FR-042: сдвиг вправо у правой стены возвращает тот же объект", () => {
  const state = stateWith({ type: "O", rotation: 0, x: 8, y: 5 }, [], { events: STALE });
  assert.equal(moveRight(state), state);
});

// ---------- LG FR-040, FR-041: состав, данные и порядок событий ----------

test("LG FR-040: тетрис — событие tetris без бонуса", () => {
  assert.deepEqual(tick(tetrisLock()).events, [{ type: "tetris", bonus: 0 }]);
});

test("LG FR-040: серия 1, одна строка — combo с n = 2 и бонусом 50", () => {
  assert.deepEqual(tick(singleLock({ combo: 1 })).events, [{ type: "combo", bonus: 50, n: 2 }]);
});

test("LG FR-041: тетрис после тетриса — tetris, backToBack 400, combo n 2 бонус 50", () => {
  assert.deepEqual(tick(tetrisLock({ backToBack: true, combo: 1 })).events, [
    { type: "tetris", bonus: 0 },
    { type: "backToBack", bonus: 400 },
    { type: "combo", bonus: 50, n: 2 },
  ]);
});

for (const modeId of ["marathon", "sprint", "ultra"]) {
  test(`LG FR-040: в ${modeId} десятая строка даёт levelUp с уровнем 2`, () => {
    assert.deepEqual(tick(singleLock({ lines: 9 }, modeId)).events, [
      { type: "levelUp", bonus: 0, level: 2 },
    ]);
  });
}

test("LG FR-041: финишный тетрис спринта на 38 линиях — tetris, levelUp 5, sprintFinish последним", () => {
  const state = tetrisLock({ lines: 38, level: 4, elapsedMs: 83456 }, "sprint");
  assert.deepEqual(tick(state).events, [
    { type: "tetris", bonus: 0 },
    { type: "levelUp", bonus: 0, level: 5 },
    { type: "sprintFinish", bonus: 0, timeMs: 83456 },
  ]);
});

test("LG FR-040: конец времени ультры — timeUp с итоговыми очками 5300", () => {
  const ultra = stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { elapsedMs: 119990, score: 5300 }, "ultra");
  assert.deepEqual(advanceTime(ultra, 16).events, [{ type: "timeUp", bonus: 0, score: 5300 }]);
});

test("LG FR-042: следующий вызов после события возвращает events []", () => {
  const afterTetris = tick(tetrisLock());
  assert.deepEqual(tick(afterTetris).events, []);
});

test("LG FR-042: одна-три строки без комбо и смены уровня — событий нет", () => {
  assert.deepEqual(tick(singleLock()).events, []);
  assert.deepEqual(tick(doubleLock()).events, []);
});

test("LG FR-042: новая партия начинается без событий", () => {
  assert.deepEqual(createGame(3, "ultra").events, []);
});

test("LG FR-040: сумма бонусов событий = прибавка счёта сверх очков за строки: 1250 − 800 = 450", () => {
  const after = tick(tetrisLock({ backToBack: true, combo: 1 }));
  assert.equal(after.score, 1250);
  assert.equal(
    after.events.reduce((sum, event) => sum + event.bonus, 0),
    450,
  );
});

// ---------- LG FR-050: детерминизм (характеризующий, L1) ----------

// Одна и та же последовательность вызовов; возвращает все промежуточные состояния.
function replay() {
  const steps = [
    (s) => advanceTime(s, 500),
    hardDrop, hardDrop, hardDrop, hardDrop, hardDrop,
    hold,
    (s) => advanceTime(s, 1000),
    hardDrop, hardDrop, hardDrop, hardDrop, hardDrop,
  ];
  const states = [createGame(7, "ultra")];
  for (const step of steps) states.push(step(states.at(-1)));
  return states;
}

test("LG FR-050: одинаковые seed, режим и вызовы дают одинаковые состояния и события", () => {
  assert.deepEqual(replay(), replay());
});
