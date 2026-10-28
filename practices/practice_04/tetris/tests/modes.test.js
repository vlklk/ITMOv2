// Фича 002 — режимы игры, игровое время, исходы и результат (LG FR-001…FR-016).
import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTime,
  createGame,
  ghostPiece,
  hardDrop,
  hold,
  moveLeft,
  rotate,
  softDrop,
  spawnPiece,
  tick,
} from "../src/game.js";
import { emptyLock, fullRowsExcept, singleLock, stateWith, tetrisLock, topOutLock } from "./support.js";

// ---------- режимы и партия ----------

test("LG FR-002: без режима партия — marathon", () => {
  assert.equal(createGame(1).mode, "marathon");
});

test("LG FR-002: режим sprint сохраняется в поле mode", () => {
  assert.equal(createGame(1, "sprint").mode, "sprint");
});

test("LG FR-002: createGame(seed) и createGame(seed, \"marathon\") дают одинаковые фигуры", () => {
  // Seed 9 даёт очередь Z, L, T (литералы из теста B2 в tests/assist.test.js).
  for (const state of [createGame(9), createGame(9, "marathon")]) {
    assert.equal(state.active.type, "Z");
    assert.equal(state.next, "L");
  }
});

test("LG FR-004: в sprint и ultra очередь фигур seed та же, что в marathon", () => {
  for (const modeId of ["sprint", "ultra"]) {
    const state = createGame(9, modeId);
    assert.equal(state.active.type, "Z", modeId);
    assert.equal(state.next, "L", modeId);
  }
});

// Характеризующие (L5): призрак и hold уже не зависят от режима.
test("LG FR-004: в sprint призрак T на пустом поле лежит на дне", () => {
  const state = stateWith(spawnPiece("T"), [], {}, "sprint");
  assert.deepEqual(ghostPiece(state), { type: "T", rotation: 0, x: 3, y: 18 });
});

test("LG FR-004: в ultra первый hold откладывает текущую фигуру и выводит следующую", () => {
  const state = stateWith({ type: "T", rotation: 1, x: 5, y: 7 }, [], { next: "O" }, "ultra");
  const after = hold(state);
  assert.equal(after.hold, "T");
  assert.deepEqual(after.active, { type: "O", rotation: 0, x: 4, y: 0 });
});

// ---------- игровое время ----------

test("LG FR-007: advanceTime складывает приращения, включая дробные: 16 + 16.7 = 32.7", () => {
  const after = advanceTime(advanceTime(createGame(1), 16), 16.7);
  assert.equal(after.elapsedMs, 32.7);
});

test("LG FR-007: advanceTime возвращает новый объект и не меняет вход", () => {
  const state = createGame(1);
  const after = advanceTime(state, 16);
  assert.notEqual(after, state);
  assert.equal(state.elapsedMs, 0);
});

test("LG FR-007: фиксация и шаг падения не меняют elapsedMs", () => {
  const timed = { ...emptyLock(), elapsedMs: 500 };
  assert.equal(tick(timed).elapsedMs, 500);
  assert.equal(hardDrop(stateWith(spawnPiece("T"), [], { elapsedMs: 500 })).elapsedMs, 500);
});

for (const [label, delta] of [
  ["0", 0],
  ["−5", -5],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["−Infinity", -Infinity],
  ["строка \"16\"", "16"],
  ["undefined", undefined],
]) {
  test(`LG FR-008: deltaMs ${label} — тот же объект`, () => {
    const state = createGame(1);
    assert.equal(advanceTime(state, delta), state);
  });
}

test("LG FR-008: после конца партии advanceTime возвращает тот же объект", () => {
  const over = { ...createGame(1), over: true };
  assert.equal(advanceTime(over, 16), over);
});

test("LG FR-009: в marathon и sprint remainingMs остаётся null", () => {
  for (const modeId of ["marathon", "sprint"]) {
    const after = advanceTime(createGame(1, modeId), 1000);
    assert.equal(after.elapsedMs, 1000, modeId);
    assert.equal(after.remainingMs, null, modeId);
  }
});

test("LG FR-009: в ultra после 60 000 мс осталось 60 000 мс", () => {
  assert.equal(advanceTime(createGame(1, "ultra"), 60000).remainingMs, 60000);
});

// ---------- «Спринт 40»: финиш, переполнение, результат ----------

test("LG FR-011: sprint, 38 линий, тетрис на 83 456 мс — финиш с результатом 83 456", () => {
  const after = tick(tetrisLock({ lines: 38, elapsedMs: 83456 }, "sprint"));
  assert.equal(after.lines, 42);
  assert.equal(after.outcome, "sprintFinish");
  assert.equal(after.over, true);
  assert.equal(after.result, 83456);
});

test("LG FR-011: sprint, 39 линий, одна строка — ровно 40, осталось 0, финиш", () => {
  const after = tick(singleLock({ lines: 39 }, "sprint"));
  assert.equal(after.lines, 40);
  assert.equal(after.linesToGoal, 0);
  assert.equal(after.outcome, "sprintFinish");
});

test("LG FR-011: результат спринта округляется до целых мс: 83 455,6 → 83 456", () => {
  const after = tick(singleLock({ lines: 39, elapsedMs: 83455.6 }, "sprint"));
  assert.equal(after.result, 83456);
});

test("LG FR-011: sprint, 20 линий, одна строка — до цели 19, партия идёт", () => {
  const after = tick(singleLock({ lines: 20 }, "sprint"));
  assert.equal(after.linesToGoal, 19);
  assert.equal(after.outcome, "playing");
  assert.equal(after.result, null);
});

test("LG FR-012: финиш и переполнение одной фиксацией — засчитывается финиш", () => {
  // O на дне закрывает строку 19; клетка (4, 0) после удаления строки сдвигается
  // в (4, 1) и перекрывает точку появления T.
  const filled = [...fullRowsExcept([19], [0, 1]), [4, 0]];
  const state = stateWith({ type: "O", rotation: 0, x: 0, y: 18 }, filled, { next: "T", lines: 39 }, "sprint");
  const after = tick(state);
  assert.equal(after.outcome, "sprintFinish");
  assert.equal(after.lines, 40);
});

test("LG FR-013: sprint, переполнение на 20 линиях — topOut без результата", () => {
  const after = tick(topOutLock({ lines: 20 }, "sprint"));
  assert.equal(after.outcome, "topOut");
  assert.equal(after.over, true);
  assert.equal(after.result, null);
});

test("LG FR-016: marathon, переполнение при счёте 1234 — topOut, результат 1234", () => {
  const after = tick(topOutLock({ score: 1234 }));
  assert.equal(after.outcome, "topOut");
  assert.equal(after.result, 1234);
});

test("LG FR-016: marathon, 39 линий, одна строка — партия идёт, цели нет", () => {
  const after = tick(singleLock({ lines: 39 }));
  assert.equal(after.lines, 40);
  assert.equal(after.outcome, "playing");
  assert.equal(after.linesToGoal, null);
});

const AFTER_END = [
  ["moveLeft", moveLeft],
  ["rotate", rotate],
  ["hold", hold],
  ["tick", tick],
  ["softDrop", softDrop],
  ["hardDrop", hardDrop],
  ["advanceTime", (state) => advanceTime(state, 16)],
];

for (const [label, action] of AFTER_END) {
  test(`LG FR-010: после финиша спринта ${label} возвращает тот же объект`, () => {
    const finished = tick(singleLock({ lines: 39 }, "sprint"));
    assert.equal(action(finished), finished);
  });
}

// Характеризующие (L1): уровень по A5 уже растёт в любом состоянии.
test("LG FR-006: sprint, 9 линий, одна строка — уровень 2", () => {
  assert.equal(tick(singleLock({ lines: 9 }, "sprint")).level, 2);
});

test("LG FR-006: ultra, 19 линий, одна строка — уровень 3", () => {
  assert.equal(tick(singleLock({ lines: 19, level: 2 }, "ultra")).level, 3);
});

// ---------- «Ультра 2 минуты»: конец по времени ----------

// Свободная T в ультре с заданным временем и счётом.
function ultraAt(elapsedMs, score = 0) {
  return stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { elapsedMs, score }, "ultra");
}

test("LG FR-014: ultra, 119 990 мс и счёт 5300, ещё 16 мс — время вышло ровно на 120 000", () => {
  const after = advanceTime(ultraAt(119990, 5300), 16);
  assert.equal(after.elapsedMs, 120000);
  assert.equal(after.remainingMs, 0);
  assert.equal(after.outcome, "timeUp");
  assert.equal(after.over, true);
  assert.equal(after.result, 5300);
});

test("LG FR-014: ultra, сразу 120 000 мс — время вышло", () => {
  assert.equal(advanceTime(createGame(1, "ultra"), 120000).outcome, "timeUp");
});

test("LG FR-014: когда время вышло, падающая фигура не фиксируется и очков не прибавляется", () => {
  const state = ultraAt(119990, 5300);
  const after = advanceTime(state, 16);
  assert.deepEqual(after.active, { type: "T", rotation: 0, x: 4, y: 5 });
  assert.equal(after.board, state.board);
  assert.equal(after.score, 5300);
});

test("LG FR-014: ultra, 100 000 мс и ещё 1000 — партия идёт, осталось 19 000", () => {
  const after = advanceTime(ultraAt(100000), 1000);
  assert.equal(after.outcome, "playing");
  assert.equal(after.remainingMs, 19000);
});

test("LG FR-014: после конца времени advanceTime и hardDrop возвращают тот же объект", () => {
  const finished = advanceTime(ultraAt(119990), 16);
  assert.equal(advanceTime(finished, 16), finished);
  assert.equal(hardDrop(finished), finished);
});

test("LG FR-014: у спринта нет предела времени: 600 000 мс и ещё 1000 — партия идёт", () => {
  const sprint = stateWith(spawnPiece("T"), [], { elapsedMs: 600000 }, "sprint");
  assert.equal(advanceTime(sprint, 1000).outcome, "playing");
});

test("LG FR-015: ultra, переполнение при счёте 4200 — topOut, результат 4200", () => {
  const after = tick(topOutLock({ score: 4200, elapsedMs: 60000 }, "ultra"));
  assert.equal(after.outcome, "topOut");
  assert.equal(after.result, 4200);
});
