// Фича 001 (UI) — потребительская проверка: только то из контракта
// specs/shared/game-modes-contract.md §2, что читает интерфейс. Правила логики
// здесь не перепроверяются (их тестирует фича 002). Тесты характеризующие:
// логика уже влита, поэтому они зелёные сразу; ломаются, если API разойдётся с UI.
import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game.js";
import * as record from "../src/record.js";

test("UI FR-001 / контракт §2.1: MODES — marathon, sprint, ultra в этом порядке (порядок стартового экрана)", () => {
  assert.deepEqual(
    game.MODES.map((mode) => mode.id),
    ["marathon", "sprint", "ultra"],
  );
});

test("UI FR-001 / контракт §2.1: цель спринта — 40 строк (число в тексте цели)", () => {
  assert.equal(game.MODES.find((mode) => mode.id === "sprint").goalLines, 40);
});

test("UI FR-001 / контракт §2.1: лимит ультры — 120000 мс (число в тексте цели)", () => {
  assert.equal(game.MODES.find((mode) => mode.id === "ultra").timeLimitMs, 120000);
});

test("UI FR-009 / контракт §2.3: advanceTime(s, 0) возвращает тот же объект", () => {
  const state = game.createGame(1, "sprint");
  assert.equal(game.advanceTime(state, 0), state);
});

test("UI FR-019 / контракт §2.2: createGame(1, 'sprint') — без событий, партия идёт, до цели 40 строк", () => {
  const state = game.createGame(1, "sprint");
  assert.deepEqual(
    { events: state.events, outcome: state.outcome, over: state.over, linesToGoal: state.linesToGoal, result: state.result },
    { events: [], outcome: "playing", over: false, linesToGoal: 40, result: null },
  );
});

test("UI FR-008 / контракт §2.2: ультра начинается с remainingMs 120000", () => {
  assert.equal(game.createGame(1, "ultra").remainingMs, 120000);
});

test("UI FR-029 / контракт §2.6: readModeRecord(null, 'ultra') — null (строки рекорда нет)", () => {
  assert.equal(record.readModeRecord(null, "ultra"), null);
});
