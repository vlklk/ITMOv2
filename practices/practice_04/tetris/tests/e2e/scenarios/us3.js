// US3 — всплывающие подписи: E9–E11, E15, E16.
import { scenario } from "../harness.js";
import { playPlan } from "../planner.js";
import { B2B, COMBO, LEVEL, SPRINT_TETRIS_LAST, TETRIS } from "./fixtures.js";

const BASE = "clock=manual&gravity=off&storage=session";
const lines = (h) => h.all("#caption .caption-line").map((el) => el.textContent.trim());

// Сыграть ходы плана до хода index включительно.
function playTo(h, moves, index) {
  h.play(moves.slice(0, index + 1));
}

scenario("E9", "«Тетрис!»: видна 1,4 с, скрыта к 1,7 с; управление работает", "US3 AS1, AS5, AS8; FR-020, FR-021, FR-024", async (h) => {
  const moves = playPlan(TETRIS.seed, "marathon", TETRIS.style);
  await h.load(`mode=marathon&seed=${TETRIS.seed}&${BASE}`);
  h.start();
  playTo(h, moves, TETRIS.move);
  h.expectVisible("#caption");
  h.expect("подпись", "Тетрис!", lines(h).join(" | "));
  h.expectIncludes("диктор", "Тетрис!", h.text("#announcer"));
  h.advance(1400);
  h.expectVisible("#caption");
  // Новая фигура только что появилась вверху, стопка на этом ходу ниже 4-й строки.
  const before = h.topPieceCells();
  h.expect("активная фигура вверху", 4, before.length);
  h.key("ArrowLeft");
  h.expect("фигура сдвинулась во время подписи", before.map((i) => i - 1).join(","), h.topPieceCells().join(","));
  h.advance(300);
  h.expectVisible("#caption", false);
});

scenario("E10", "«Комбо ×2» с бонусом, очки; «Комбо ×3» заменяет подпись", "US3 AS3, AS6; FR-018, FR-020", async (h) => {
  const moves = playPlan(COMBO.seed, "marathon", COMBO.style);
  await h.load(`mode=marathon&seed=${COMBO.seed}&${BASE}`);
  h.start();
  playTo(h, moves, COMBO.move);
  h.expect("подпись", `Комбо ×2 | +${COMBO.bonus2}`, lines(h).join(" | "));
  h.expect("очки", COMBO.score2, h.text("#score"));
  h.advance(1000);
  h.keys(moves[COMBO.move + 1].keys);
  h.expect("подпись заменена", `Комбо ×3 | +${COMBO.bonus3}`, lines(h).join(" | "));
  h.advance(1400);
  h.expectVisible("#caption");
  h.advance(300);
  h.expectVisible("#caption", false);
});

scenario("E11", "Подпись скрыта на паузе; финальная вытесняет обычные; скрыта на итоге", "FR-019, FR-020, FR-026", async (h) => {
  const tetrisMoves = playPlan(TETRIS.seed, "marathon", TETRIS.style);
  await h.load(`mode=marathon&seed=${TETRIS.seed}&clock=manual&gravity=off`);
  h.start();
  playTo(h, tetrisMoves, TETRIS.move);
  h.expectVisible("#caption");
  h.key("KeyP");
  h.expectVisible("#caption", false);
  h.key("KeyP");
  h.expectVisible("#caption", false);

  const sprintMoves = playPlan(SPRINT_TETRIS_LAST.seed, "sprint", SPRINT_TETRIS_LAST.style);
  h.expect("план совпадает с фикстурой (фигур)", SPRINT_TETRIS_LAST.pieces, sprintMoves.length);
  await h.load(`mode=sprint&seed=${SPRINT_TETRIS_LAST.seed}&${BASE}`);
  h.start();
  h.play(sprintMoves, { msBefore: 1000 });
  h.expectScreen("finishing");
  h.expectTrue("финальная подпись", h.el("#caption").hasAttribute("data-final"));
  h.expect("только «Финиш!»", "Финиш!", lines(h).join(" | "));
  h.advance(1000);
  h.expectScreen("over");
  h.expectVisible("#caption", false);
});

scenario("E15", "«Подряд»: тетрис после тетриса с бонусом", "US3 AS2; FR-017, FR-018; Р-4", async (h) => {
  const moves = playPlan(B2B.seed, "marathon", B2B.style);
  await h.load(`mode=marathon&seed=${B2B.seed}&${BASE}`);
  h.start();
  playTo(h, moves, B2B.move);
  h.expect("подпись", `Тетрис! | Подряд | +${B2B.bonus}`, lines(h).join(" | "));
});

scenario("E16", "«Уровень N» и порядок строк группы", "US3 AS4, AS8; FR-017, FR-019, FR-024", async (h) => {
  const moves = playPlan(LEVEL.seed, "marathon", LEVEL.style);
  await h.load(`mode=marathon&seed=${LEVEL.seed}&${BASE}`);
  h.start();
  playTo(h, moves, LEVEL.move);
  h.expect("строки по порядку", LEVEL.lines.join(" | "), lines(h).join(" | "));
  h.expect("уровень в колонке", LEVEL.level, h.text("#level"));
  h.expect("диктор — вся группа одной строкой", LEVEL.lines.join(" "), h.text("#announcer"));
});
