// E0, E14 — обычный запуск и регрессия фич A/B.
import { scenario } from "../harness.js";

const MODES = ["marathon", "sprint", "ultra"];

scenario("E0", "Обычный запуск без параметров: «Марафон», старт, ← сдвигает фигуру", "B4, FR-002", async (h) => {
  await h.load("");
  h.expect("выбранный режим", "true", h.el('#mode-list [data-mode="marathon"]')?.getAttribute("aria-pressed"));
  h.start();
  const before = h.pieceCells();
  h.key("ArrowLeft");
  h.expect("фигура сдвинулась на клетку влево", before.map((i) => i - 1).join(","), h.pieceCells().join(","));
});

scenario("E14", "Регрессия A/B во всех режимах: призрак, hold и его бледное состояние", "FR-027, B4", async (h) => {
  for (const mode of MODES) {
    await h.load(`seed=11&clock=manual&gravity=off&storage=session`);
    h.start(mode);
    h.expectTrue(`${mode}: призрак виден`, h.ghostCount() === 4);
    h.key("KeyC");
    const held = h.all("#hold .cell[data-p]").length;
    h.expect(`${mode}: в «отложенной» фигура`, 4, held);
    h.expectTrue(`${mode}: hold израсходован`, h.el("#hold").hasAttribute("data-used"));
    const active = h.pieceCells().join(",");
    h.key("KeyC");
    h.expect(`${mode}: повторный hold ничего не меняет`, active, h.pieceCells().join(","));
    h.key("Space");
    h.expectTrue(`${mode}: после фиксации hold снова доступен`, !h.el("#hold").hasAttribute("data-used"));
  }
});
