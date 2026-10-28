// US4 — повторить партию или сменить режим: E12–E13.
import { scenario } from "../harness.js";

const BASE = "storage=session&clock=manual&gravity=off";

scenario("E12", "«К выбору режима» с паузы: без итога и без рекорда", "US4 AS3; FR-016", async (h) => {
  await h.load(`mode=ultra&seed=5&${BASE}`);
  h.start();
  h.advance(5000);
  h.key("Space");
  h.key("KeyP");
  h.click("#menu-button");
  h.expectScreen("start");
  h.expect("выбран тот же режим", "true", h.el('#mode-list [data-mode="ultra"]').getAttribute("aria-pressed"));
  h.expectVisible("#screen-over", false);
  h.expect("рекорд ультры не записан", null, h.getRecord("tetris.record.ultra"));
});

scenario("E13", "«Играть снова» / «Выбрать режим» и защита 0,7 с", "US4 AS1, AS2, AS4; FR-015", async (h) => {
  await h.load(`mode=sprint&seed=5&${BASE}`);
  h.start();
  h.dropUntilOver();
  h.expectScreen("over");
  h.click("#again-button");
  h.click("#modes-button");
  h.expectScreen("over");
  h.advance(700);
  h.click("#again-button");
  h.expectScreen("playing");
  h.expect("новое время", "0:00,00", h.text("#time"));
  h.expect("новые строки", "0 из 40", h.text("#lines"));
  h.dropUntilOver();
  h.advance(700);
  h.click("#modes-button");
  h.expectScreen("start");
  h.expect("выбран спринт", "true", h.el('#mode-list [data-mode="sprint"]').getAttribute("aria-pressed"));
});
