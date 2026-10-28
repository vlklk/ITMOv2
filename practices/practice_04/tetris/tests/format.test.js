// Фича 001 (UI) — форматирование чисел и времени для экрана: specs/001-game-modes-ui/data-model.md §5.
// Ожидания — литералы, посчитанные вручную.
import test from "node:test";
import assert from "node:assert/strict";
import * as format from "../src/format.js";

// ---------- спринт: «м:сс,сс», сотые отбрасываются ----------

test("UI FR-007: formatSprintTime(0) — «0:00,00»", () => {
  assert.equal(format.formatSprintTime(0), "0:00,00");
});

test("UI FR-007: formatSprintTime(1234.9) — «0:01,23» (сотые отбрасываются, а не округляются)", () => {
  assert.equal(format.formatSprintTime(1234.9), "0:01,23");
});

test("UI FR-007: formatSprintTime(98020) — «1:38,02» (секунды и сотые с ведущим нулём)", () => {
  assert.equal(format.formatSprintTime(98020), "1:38,02");
});

test("UI FR-007: formatSprintTime(724550) — «12:04,55» (больше 10 минут)", () => {
  assert.equal(format.formatSprintTime(724550), "12:04,55");
});

test("UI FR-007: formatSprintTime(3724550) — «1:02:04,55» (от часа — часы и минуты с ведущим нулём)", () => {
  assert.equal(format.formatSprintTime(3724550), "1:02:04,55");
});

// ---------- ультра: «м:сс» вверх, последние 10 с — десятые вверх ----------

test("UI FR-008: formatUltraTime(120000) — «2:00»", () => {
  assert.equal(format.formatUltraTime(120000), "2:00");
});

test("UI FR-008: formatUltraTime(60001) — «1:01» (секунды округляются вверх)", () => {
  assert.equal(format.formatUltraTime(60001), "1:01");
});

test("UI FR-008: formatUltraTime(10000) — «0:10» (ровно 10 с — ещё без десятых)", () => {
  assert.equal(format.formatUltraTime(10000), "0:10");
});

test("UI FR-008: formatUltraTime(9401) — «0:09,5» (десятые округляются вверх)", () => {
  assert.equal(format.formatUltraTime(9401), "0:09,5");
});

test("UI FR-008: formatUltraTime(9400) — «0:09,4» (ровные десятые не растут)", () => {
  assert.equal(format.formatUltraTime(9400), "0:09,4");
});

test("UI FR-008: formatUltraTime(1000) — «0:01,0»", () => {
  assert.equal(format.formatUltraTime(1000), "0:01,0");
});

test("UI FR-008: formatUltraTime(1) — «0:00,1» (ноль не показывается до конца)", () => {
  assert.equal(format.formatUltraTime(1), "0:00,1");
});

test("UI FR-008: formatUltraTime(0) — «0:00»", () => {
  assert.equal(format.formatUltraTime(0), "0:00");
});

// ---------- очки ----------

test("UI FR-005: formatScore(12400) — «12 400» (неразрывный пробел разрядов)", () => {
  assert.equal(format.formatScore(12400), "12 400");
});
