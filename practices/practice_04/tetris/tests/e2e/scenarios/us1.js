// US1 — выбрать режим и сыграть партию: E1–E5, E17.
import { scenario } from "../harness.js";
import { playPlan } from "../planner.js";
import { SPRINT } from "./fixtures.js";

const BASE = "clock=manual&gravity=off&storage=session";

scenario("E1", "Выбор каждого режима и старт: значения колонки по режиму", "US1 AS1–2, AS4; FR-001–FR-006", async (h) => {
  await h.load(`seed=11&${BASE}`);
  const ids = h.all("#mode-list [data-mode]").map((el) => el.dataset.mode);
  h.expect("порядок режимов", "marathon,sprint,ultra", ids.join(","));
  h.expectIncludes("цель спринта", "40 строк", h.text('[data-mode="sprint"]'));
  h.expectIncludes("цель ультры", "2 минуты", h.text('[data-mode="ultra"]'));
  const pressed = () => h.all("#mode-list [data-mode]").filter((el) => el.getAttribute("aria-pressed") === "true").map((el) => el.dataset.mode).join(",");
  h.expect("выбран по умолчанию", "marathon", pressed());
  h.key("ArrowDown");
  h.expect("↓ выбирает спринт", "sprint", pressed());
  h.key("ArrowUp");
  h.expect("↑ возвращает марафон", "marathon", pressed());

  h.start("marathon");
  h.expectVisible("#level-stat");
  h.expectVisible("#time-stat", false);

  await h.load(`seed=11&${BASE}`);
  h.start("sprint");
  h.expect("время спринта", "0:00,00", h.text("#time"));
  h.expect("строки спринта", "0 из 40", h.text("#lines"));
  h.expectVisible("#level-stat", false);
  h.expectVisible("#time-stat");

  await h.load(`seed=11&${BASE}`);
  h.start("ultra");
  h.expect("время ультры", "2:00", h.text("#time"));
  h.expectVisible("#level-stat", false);
});

scenario("E2", "Спринт до финиша: «Финиш!», экран «Финиш», время партии", "US1 AS3; FR-007, FR-012, FR-013", async (h) => {
  const moves = playPlan(SPRINT.seed, "sprint", SPRINT.style);
  h.expect("план совпадает с фикстурой (фигур)", SPRINT.pieces, moves.length);
  await h.load(`mode=sprint&seed=${SPRINT.seed}&${BASE}`);
  h.start();
  h.play(moves, { msBefore: 1000 });
  h.expectScreen("finishing");
  h.expectVisible("#caption");
  h.expectTrue("финальная подпись", h.el("#caption").hasAttribute("data-final"));
  h.expect("подпись", "Финиш!", h.text("#caption"));
  h.expect("строки", "40 из 40", h.text("#lines"));
  h.expect("время на финише", SPRINT.time, h.text("#time"));
  h.advance(1000);
  h.expectScreen("over");
  h.expect("заголовок итога", "Финиш", h.text("#over-title"));
  h.expectIncludes("время в итоге", SPRINT.time, h.text("#over-summary"));
});

scenario("E3", "Ультра: объявления, «0:01,0», «Время вышло», итог", "US1 AS4; FR-008, FR-010, FR-012, FR-013, FR-026", async (h) => {
  await h.load(`mode=ultra&seed=11&${BASE}`);
  h.start();
  h.seconds(60);
  h.expectIncludes("объявление минуты", "осталась 1 минута", h.text("#announcer"));
  h.seconds(30);
  h.expectIncludes("объявление 30 секунд", "30 секунд", h.text("#announcer"));
  h.seconds(20);
  h.expectIncludes("объявление 10 секунд", "10 секунд", h.text("#announcer"));
  h.seconds(9);
  h.expect("остаток", "0:01,0", h.text("#time"));
  h.expectTrue("последние секунды выделены", h.el("#time").hasAttribute("data-urgent"));
  h.advance(1000);
  h.expectScreen("finishing");
  h.expect("подпись", "Время вышло", h.text("#caption"));
  const cells = h.pieceCells().join(",");
  h.key("ArrowLeft");
  h.expect("ввод не действует", cells, h.pieceCells().join(","));
  h.advance(1000);
  h.expectScreen("over");
  h.expect("заголовок итога", "Время вышло", h.text("#over-title"));
  h.expectIncludes("очки в итоге", "очк", h.text("#over-summary"));
  h.expectIncludes("строки в итоге", "строк", h.text("#over-summary"));
  h.expectVisible("#caption", false);
});

scenario("E4", "Спринт, переполнение: «Игра окончена», время не засчитано", "US1 AS7, US2 AS6; FR-007, FR-013", async (h) => {
  await h.load(`mode=sprint&seed=5&${BASE}`);
  h.start();
  h.advance(2500);
  h.dropUntilOver();
  h.expectScreen("over");
  h.expect("заголовок итога", "Игра окончена", h.text("#over-title"));
  h.expectIncludes("итог", "из 40", h.text("#over-summary"));
  h.expectIncludes("итог", "время не засчитано", h.text("#over-summary"));
  h.expect("время в колонке", "0:02,50", h.text("#time"));
  h.expectVisible("#over-best", false);
  h.expect("рекорд спринта не записан", null, h.getRecord("tetris.record.sprint"));
});

scenario("E5", "Пауза (P, blur, скрытая вкладка) останавливает время", "US1 AS6; FR-009, FR-011", async (h) => {
  await h.load(`mode=sprint&seed=11&${BASE}`);
  h.start();
  h.advance(3000);
  h.expect("время", "0:03,00", h.text("#time"));
  h.key("KeyP");
  h.expectScreen("paused");
  h.expect("время на паузе", "0:03,00", h.text("#pause-time"));
  h.advance(5000);
  h.expect("на паузе время стоит", "0:03,00", h.text("#time"));
  h.key("KeyP");
  h.expectScreen("playing");
  h.advance(1000);
  h.expect("первая дельта после паузы отброшена", "0:03,00", h.text("#time"));
  h.advance(1000);
  h.expect("время идёт", "0:04,00", h.text("#time"));

  h.blur();
  h.expectScreen("paused");
  h.advance(2000);
  h.key("KeyP");
  h.advance(1000);
  h.advance(1000);
  h.expect("после паузы по blur", "0:05,00", h.text("#time"));

  h.setHidden(true);
  h.expectScreen("paused");
  h.advance(2000);
  h.setHidden(false);
  h.expectScreen("paused");
  h.key("KeyP");
  h.advance(1000);
  h.advance(1000);
  h.expect("после паузы по скрытой вкладке", "0:06,00", h.text("#time"));
});

scenario("E17", "Ультра, переполнение: «Игра окончена», очки в рекорд ультры", "Edge; FR-013; Р-1", async (h) => {
  await h.load(`mode=ultra&seed=5&${BASE}`);
  h.start();
  h.dropUntilOver();
  h.expectScreen("over");
  h.expect("заголовок итога", "Игра окончена", h.text("#over-title"));
  h.expectIncludes("очки в итоге", "очк", h.text("#over-summary"));
  h.expect("рекорд ультры = очки", h.text("#score").replace(/\s/g, ""), h.getRecord("tetris.record.ultra"));
});
