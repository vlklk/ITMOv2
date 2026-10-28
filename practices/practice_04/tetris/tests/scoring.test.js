// Фича 002 — бонусы за комбо и «Подряд» (LG FR-020…FR-024).
// Фигуры стоят на опоре, фиксация — tick: очков за спуск нет, если не сказано иное.
import test from "node:test";
import assert from "node:assert/strict";
import { hardDrop, hold, tick } from "../src/game.js";
import { doubleLock, emptyLock, fullRowsExcept, singleLock, stateWith, tetrisLock } from "./support.js";

// ---------- комбо ----------

test("LG FR-020: первая фиксация со строкой — +100, серия 1, без бонуса", () => {
  const after = tick(singleLock({ combo: 0 }));
  assert.equal(after.score, 100);
  assert.equal(after.combo, 1);
});

test("LG FR-021: серия 1, две строки — +300 и бонус 50, всего 350, серия 2", () => {
  const after = tick(doubleLock({ combo: 1 }));
  assert.equal(after.score, 350);
  assert.equal(after.combo, 2);
});

test("LG FR-021: серия 2, одна строка — +100 и бонус 100, всего 200, серия 3", () => {
  const after = tick(singleLock({ combo: 2 }));
  assert.equal(after.score, 200);
  assert.equal(after.combo, 3);
});

test("LG FR-020: фиксация без строк обнуляет серию и бонуса не даёт", () => {
  const after = tick(emptyLock({ combo: 3, score: 1000 }));
  assert.equal(after.combo, 0);
  assert.equal(after.score, 1000);
});

test("LG FR-021: бонус комбо считается по уровню до фиксации: уровень 3, серия 1 — 300 + 150", () => {
  const after = tick(singleLock({ combo: 1, level: 3, lines: 20 }));
  assert.equal(after.score, 450);
});

// ---------- «Подряд» ----------

test("LG FR-022: первый тетрис — 800 без бонуса «Подряд», цепочка начинается", () => {
  const after = tick(tetrisLock({ backToBack: false, combo: 0 }));
  assert.equal(after.score, 800);
  assert.equal(after.backToBack, true);
});

test("LG FR-023: тетрис после тетриса — 800 + 400 «Подряд» + 50 «Комбо ×2» = 1250", () => {
  const after = tick(tetrisLock({ backToBack: true, combo: 1 }));
  assert.equal(after.score, 1250);
  assert.equal(after.backToBack, true);
  assert.equal(after.combo, 2);
});

test("LG FR-022: две строки после тетриса обрывают цепочку «Подряд»", () => {
  assert.equal(tick(doubleLock({ backToBack: true })).backToBack, false);
});

test("LG FR-022: фиксация без строк цепочку «Подряд» не обрывает, но обнуляет серию", () => {
  const after = tick(emptyLock({ backToBack: true, combo: 1 }));
  assert.equal(after.backToBack, true);
  assert.equal(after.combo, 0);
});

test("LG FR-023: тетрис после фиксации без строк — 800 + 400 «Подряд», без комбо = 1200", () => {
  const after = tick(tetrisLock({ backToBack: true, combo: 0 }));
  assert.equal(after.score, 1200);
});

test("LG FR-020: hold не меняет серию и цепочку", () => {
  const state = stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { next: "O", combo: 2, backToBack: true });
  const after = hold(state);
  assert.equal(after.combo, 2);
  assert.equal(after.backToBack, true);
});

// ---------- сложение и режимы ----------

test("LG FR-024: жёсткий сброс на 10 клеток, серия 1, строка — 20 + 100 + 50 = 170", () => {
  const state = stateWith({ type: "I", rotation: 0, x: 3, y: 8 }, fullRowsExcept([19], [3, 4, 5, 6]), {
    next: "T",
    combo: 1,
  });
  assert.equal(hardDrop(state).score, 170);
});

for (const modeId of ["sprint", "ultra"]) {
  test(`LG FR-024: бонус комбо действует в ${modeId}: серия 1, строка — 150`, () => {
    assert.equal(tick(singleLock({ combo: 1 }, modeId)).score, 150);
  });
}
