// US2 — рекорд в каждом режиме: E6–E8.
import { scenario } from "../harness.js";
import { playPlan } from "../planner.js";
import { SPRINT } from "./fixtures.js";

const recordText = (h, mode) => h.text(`#mode-list [data-mode="${mode}"] [data-record]`);

// Из экрана паузы — к выбору режима.
function toMenu(h) {
  h.key("KeyP");
  h.click("#menu-button");
  h.expectScreen("start");
}

function finishSprint(h, moves) {
  h.start("sprint");
  h.play(moves, { msBefore: 1000 });
  h.advance(1000);
  h.expectScreen("over");
}

scenario("E6", "Рекорд режима: прежний — у «Марафона», новый, не побит, после перезагрузки", "US2 AS1–4; FR-005, FR-013, FR-014, FR-028", async (h) => {
  const moves = playPlan(SPRINT.seed, "sprint", SPRINT.style);
  h.setRecord("tetris.record", "12400");
  await h.load(`seed=${SPRINT.seed}&storage=session&clock=manual&gravity=off`);
  h.expect("рекорд марафона", "рекорд 12 400", recordText(h, "marathon"));
  h.expect("рекорд спринта", "рекорда пока нет", recordText(h, "sprint"));
  h.expect("рекорд ультры", "рекорда пока нет", recordText(h, "ultra"));

  h.start("ultra");
  h.expect("рекорд ультры в колонке", "пока нет", h.text("#record"));
  toMenu(h);

  finishSprint(h, moves);
  h.expectVisible("#over-mark", false);
  h.click("#modes-button");
  h.expect("рекорд спринта после первой партии", `лучшее время ${SPRINT.time}`, recordText(h, "sprint"));

  h.setRecord("tetris.record.sprint", "999999");
  finishSprint(h, moves);
  h.expectVisible("#over-mark");
  h.expect("пометка", "Это новый рекорд.", h.text("#over-mark"));
  h.click("#modes-button");

  h.setRecord("tetris.record.sprint", "1000");
  finishSprint(h, moves);
  h.expectVisible("#over-mark", false);
  h.expectVisible("#over-best");
  h.expectIncludes("лучшее время", "0:01,00", h.text("#over-best"));

  await h.reload();
  h.expect("рекорд спринта после перезагрузки", "лучшее время 0:01,00", recordText(h, "sprint"));
});

scenario("E7", "Хранилище недоступно: нет строк рекорда, все режимы играются", "US2 AS5; FR-029, SC-010", async (h) => {
  await h.load("seed=5&storage=off&clock=manual&gravity=off");
  h.expect("строк рекорда на стартовом экране", 0, h.all("[data-record]").length);
  for (const mode of ["marathon", "ultra"]) {
    h.start(mode);
    h.expectVisible("#record-stat", false);
    toMenu(h);
  }
  h.start("sprint");
  h.expectVisible("#record-stat", false);
  h.dropUntilOver();
  h.expectScreen("over");
  h.expectVisible("#over-mark", false);
  h.expectVisible("#over-best", false);
});

scenario("E8", "Запись рекорда не удалась: без пометки, рекорд прежний", "Edge; FR-029", async (h) => {
  h.setRecord("tetris.record.ultra", "1");
  await h.load("mode=ultra&seed=5&storage=readonly&clock=manual&gravity=off");
  h.start();
  h.keys(["Space", "Space", "Space"]);
  h.seconds(120);
  h.expectScreen("finishing");
  h.advance(1000);
  h.expectScreen("over");
  h.expectVisible("#over-mark", false);
  h.click("#modes-button");
  h.expect("рекорд ультры прежний", "рекорд 1", recordText(h, "ultra"));
});
