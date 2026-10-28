// Фича 002 — форма API логики из контракта specs/shared/game-modes-contract.md §2.
// Модули импортируются пространством имён: отсутствие одной функции роняет
// один тест, а не загрузку всего файла.
import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game.js";
import * as record from "../src/record.js";
import { MemoryStorage, stateWith, tetrisLock } from "./support.js";

// ---------- §2.1 Режимы ----------

test("LG FR-044 (§2.1): MODES — три режима в порядке marathon, sprint, ultra", () => {
  assert.deepEqual(
    game.MODES.map((mode) => mode.id),
    ["marathon", "sprint", "ultra"],
  );
});

test("LG FR-044 (§2.1): параметры режимов совпадают с таблицей контракта", () => {
  assert.deepEqual(game.MODES, [
    { id: "marathon", goalLines: null, timeLimitMs: null, resultKind: "score", better: "higher" },
    { id: "sprint", goalLines: 40, timeLimitMs: null, resultKind: "time", better: "lower" },
    { id: "ultra", goalLines: null, timeLimitMs: 120000, resultKind: "score", better: "higher" },
  ]);
});

test("LG FR-044 (§2.1): MODES и каждый режим заморожены", () => {
  assert.equal(Object.isFrozen(game.MODES), true);
  for (const mode of game.MODES) assert.equal(Object.isFrozen(mode), true, mode.id);
});

// ---------- §2.2 Состояние партии ----------

const COMMON_START = {
  score: 0,
  lines: 0,
  level: 1,
  elapsedMs: 0,
  outcome: "playing",
  over: false,
  result: null,
  combo: 0,
  backToBack: false,
  events: [],
};

const START_BY_MODE = [
  ["marathon", { linesToGoal: null, remainingMs: null }],
  ["sprint", { linesToGoal: 40, remainingMs: null }],
  ["ultra", { linesToGoal: null, remainingMs: 120000 }],
];

for (const [modeId, perMode] of START_BY_MODE) {
  test(`LG FR-043 (§2.2): новая партия ${modeId} начинается с полей контракта`, () => {
    const state = game.createGame(1, modeId);
    const picked = Object.fromEntries(
      Object.keys({ ...COMMON_START, ...perMode, mode: null }).map((key) => [key, state[key]]),
    );
    assert.deepEqual(picked, { ...COMMON_START, ...perMode, mode: modeId });
  });
}

// ---------- §2.3 Функции ----------

test("LG FR-003 (§2.3): createGame с неизвестным режимом бросает RangeError", () => {
  assert.throws(() => game.createGame(1, "nope"), RangeError);
});

test("LG FR-007 (§2.3): advanceTime экспортируется функцией", () => {
  assert.equal(typeof game.advanceTime, "function");
});

test("LG FR-042 (§2.2): вызов без изменений возвращает тот же объект", () => {
  const state = game.createGame(1);
  const atWall = { ...state, active: { type: "O", rotation: 0, x: 0, y: 5 } };
  assert.equal(game.moveLeft(atWall), atWall);
});

// ---------- §2.6 Рекорды по режимам ----------

test("LG FR-033 (§2.6): saveModeRecord возвращает ровно {record, previous, isNew}", () => {
  const saved = record.saveModeRecord(new MemoryStorage(), "ultra", 10);
  assert.deepEqual(Object.keys(saved).sort(), ["isNew", "previous", "record"]);
  assert.equal(typeof saved.record, "number");
  assert.equal(typeof saved.previous, "number");
  assert.equal(typeof saved.isNew, "boolean");
});

test("LG FR-035 (§2.6): readModeRecord — 0 для пустого хранилища, null без хранилища", () => {
  assert.equal(record.readModeRecord(new MemoryStorage(), "sprint"), 0);
  assert.equal(record.readModeRecord(null, "sprint"), null);
});

test("LG FR-003 (§2.6): неизвестный режим в функциях рекорда — RangeError", () => {
  assert.throws(() => record.readModeRecord(new MemoryStorage(), "nope"), RangeError);
  assert.throws(() => record.saveModeRecord(new MemoryStorage(), "nope", 1), RangeError);
});

test("LG FR-030 (§2.6): readRecord и saveRecord остаются функциями марафона", () => {
  assert.equal(typeof record.readRecord, "function");
  assert.equal(typeof record.saveRecord, "function");
});

// ---------- §2.4 События ----------

const EVENT_PARAMS = {
  tetris: [],
  backToBack: [],
  combo: ["n"],
  levelUp: ["level"],
  sprintFinish: ["timeMs"],
  timeUp: ["score"],
};
const EVENT_ORDER = ["tetris", "backToBack", "combo", "levelUp", "sprintFinish", "timeUp"];
const FINAL = ["sprintFinish", "timeUp"];

// Финишный тетрис спринта после тетриса со сменой уровня: все события фиксации сразу.
function finishingLock() {
  return game.tick(
    tetrisLock({ lines: 38, level: 4, backToBack: true, combo: 1, elapsedMs: 83456 }, "sprint"),
  ).events;
}

function timeUpEvents() {
  const ultra = stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { elapsedMs: 119990 }, "ultra");
  return game.advanceTime(ultra, 16).events;
}

test("LG FR-040 (§2.4): у каждого события известный type, числовой bonus и свои параметры", () => {
  for (const event of [...finishingLock(), ...timeUpEvents()]) {
    assert.ok(event.type in EVENT_PARAMS, event.type);
    assert.equal(typeof event.bonus, "number", event.type);
    assert.deepEqual(
      Object.keys(event).sort(),
      ["bonus", "type", ...EVENT_PARAMS[event.type]].sort(),
      event.type,
    );
  }
});

test("LG FR-041 (§2.4): события фиксации идут в порядке контракта, финальное — одно и последним", () => {
  const types = finishingLock().map((event) => event.type);
  assert.deepEqual(types, ["tetris", "backToBack", "combo", "levelUp", "sprintFinish"]);
  const ranks = types.map((type) => EVENT_ORDER.indexOf(type));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(types.filter((type) => FINAL.includes(type)).length, 1);
});

test("LG FR-041 (§2.4): timeUp приходит из advanceTime, sprintFinish — только из фиксации", () => {
  assert.deepEqual(timeUpEvents().map((event) => event.type), ["timeUp"]);
  const sprint = stateWith({ type: "T", rotation: 0, x: 4, y: 5 }, [], { lines: 39 }, "sprint");
  assert.deepEqual(game.advanceTime(sprint, 16).events, []);
});
