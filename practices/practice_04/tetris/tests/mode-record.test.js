// Фича 002 — рекорды по режимам (LG FR-030…FR-035). Хранилище подменяется
// объектом с интерфейсом Web Storage, в том числе бросающим ошибки.
import test from "node:test";
import assert from "node:assert/strict";
import { readModeRecord, readRecord, saveModeRecord } from "../src/record.js";
import { MemoryStorage, throwingStorage } from "./support.js";

function storageWith(items) {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(items)) storage.setItem(key, value);
  return storage;
}

// ---------- сравнение и итог сохранения ----------

test("LG FR-033: sprint без рекорда, 95 000 мс — первый рекорд, прежнего нет", () => {
  assert.deepEqual(saveModeRecord(new MemoryStorage(), "sprint", 95000), {
    record: 95000,
    previous: 0,
    isNew: true,
  });
});

test("LG FR-032: sprint, рекорд 95 000, результат 88 120 — меньшее время становится рекордом", () => {
  const storage = storageWith({ "tetris.record.sprint": "95000" });
  assert.deepEqual(saveModeRecord(storage, "sprint", 88120), {
    record: 88120,
    previous: 95000,
    isNew: true,
  });
});

test("LG FR-032: sprint, рекорд 88 120, результат 90 000 — рекорд не меняется", () => {
  const storage = storageWith({ "tetris.record.sprint": "88120" });
  assert.deepEqual(saveModeRecord(storage, "sprint", 90000), {
    record: 88120,
    previous: 88120,
    isNew: false,
  });
  assert.equal(storage.getItem("tetris.record.sprint"), "88120");
});

test("LG FR-032: sprint, равное время 88 120 — не новый рекорд", () => {
  const storage = storageWith({ "tetris.record.sprint": "88120" });
  assert.equal(saveModeRecord(storage, "sprint", 88120).isNew, false);
});

test("LG FR-032: ultra, рекорд 7000, результат 9500 — больше очков становится рекордом", () => {
  const storage = storageWith({ "tetris.record.ultra": "7000" });
  assert.deepEqual(saveModeRecord(storage, "ultra", 9500), {
    record: 9500,
    previous: 7000,
    isNew: true,
  });
});

test("LG FR-032: marathon, рекорд 12 000, результат 11 000 — рекорд не меняется", () => {
  const storage = storageWith({ "tetris.record": "12000" });
  assert.deepEqual(saveModeRecord(storage, "marathon", 11000), {
    record: 12000,
    previous: 12000,
    isNew: false,
  });
});

test("LG FR-032: результат 0 очков рекордом не становится и не записывается", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(saveModeRecord(storage, "ultra", 0), { record: 0, previous: 0, isNew: false });
  assert.equal(storage.getItem("tetris.record.ultra"), null);
});

test("LG FR-032: результат null (проигранный спринт) не записывается", () => {
  const storage = storageWith({ "tetris.record.sprint": "88120" });
  assert.deepEqual(saveModeRecord(storage, "sprint", null), {
    record: 88120,
    previous: 88120,
    isNew: false,
  });
  assert.equal(storage.getItem("tetris.record.sprint"), "88120");
});

// ---------- ключи хранения ----------

test("LG FR-031: рекорд sprint пишется строкой в ключ tetris.record.sprint", () => {
  const storage = new MemoryStorage();
  saveModeRecord(storage, "sprint", 95000);
  assert.equal(storage.getItem("tetris.record.sprint"), "95000");
});

test("LG FR-031: рекорд ultra пишется в ключ tetris.record.ultra", () => {
  const storage = new MemoryStorage();
  saveModeRecord(storage, "ultra", 9500);
  assert.equal(storage.getItem("tetris.record.ultra"), "9500");
});

test("LG FR-031: рекорд, сохранённый до режимов в tetris.record, читается как рекорд marathon", () => {
  const storage = storageWith({ "tetris.record": "12000" });
  assert.equal(readModeRecord(storage, "marathon"), 12000);
  assert.equal(readRecord(storage), 12000);
});

// ---------- независимость режимов (SC-005: 9 пар) ----------

const OTHER_KEYS = {
  marathon: ["tetris.record.sprint", "tetris.record.ultra"],
  sprint: ["tetris.record", "tetris.record.ultra"],
  ultra: ["tetris.record", "tetris.record.sprint"],
};

for (const [modeId, otherKeys] of Object.entries(OTHER_KEYS)) {
  test(`LG FR-030: результат ${modeId} не меняет рекорды двух других режимов`, () => {
    const storage = storageWith({
      "tetris.record": "12000",
      "tetris.record.sprint": "88120",
      "tetris.record.ultra": "7000",
    });
    const before = Object.fromEntries(otherKeys.map((key) => [key, storage.getItem(key)]));
    // 50 000 лучше любого из рекордов: больше 12 000 и 7000 очков, меньше 88 120 мс.
    assert.equal(saveModeRecord(storage, modeId, 50000).isNew, true, modeId);
    for (const key of otherKeys) assert.equal(storage.getItem(key), before[key], key);
  });
}

test("LG FR-030: каждый режим читает только свой рекорд", () => {
  const storage = storageWith({
    "tetris.record": "12000",
    "tetris.record.sprint": "88120",
    "tetris.record.ultra": "7000",
  });
  assert.equal(readModeRecord(storage, "marathon"), 12000);
  assert.equal(readModeRecord(storage, "sprint"), 88120);
  assert.equal(readModeRecord(storage, "ultra"), 7000);
});

// ---------- сбои хранилища ----------

test("LG FR-034: без хранилища рекордов нет: обе функции возвращают null", () => {
  assert.equal(readModeRecord(null, "ultra"), null);
  assert.equal(saveModeRecord(null, "ultra", 9500), null);
});

test("LG FR-034: если чтение бросает ошибку, обе функции возвращают null без исключения", () => {
  const storage = throwingStorage({ read: true });
  assert.equal(readModeRecord(storage, "sprint"), null);
  assert.equal(saveModeRecord(storage, "sprint", 88120), null);
});

test("LG FR-034: если запись нового рекорда бросает, действует прежний: isNew false", () => {
  const storage = throwingStorage({ write: true }, { "tetris.record.sprint": "95000" });
  assert.deepEqual(saveModeRecord(storage, "sprint", 88120), {
    record: 95000,
    previous: 95000,
    isNew: false,
  });
});

// ---------- испорченные значения ----------

for (const garbage of ["abc", "0", "-5", "12.5", ""]) {
  test(`LG FR-035: значение ${JSON.stringify(garbage)} в рекорде sprint читается как 0`, () => {
    assert.equal(readModeRecord(storageWith({ "tetris.record.sprint": garbage }), "sprint"), 0);
  });
}
