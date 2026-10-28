// Харнесс сквозных проверок: открывает настоящий index.html в iframe с параметрами
// детерминизма (specs/001-game-modes-ui/contracts/ui-test-hooks.md), шлёт ввод
// и проверяет только видимое состояние DOM. Без зависимостей.

export const scenarios = [];

// Регистрация сценария: id (E0…), заголовок, ссылки на требования, тело.
export function scenario(id, title, refs, run) {
  scenarios.push({ id, title, refs, run });
}

const RECORD_KEYS = ["tetris.record", "tetris.record.sprint", "tetris.record.ultra"];

const KEY_NAMES = {
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  Space: " ",
  KeyP: "p",
  KeyC: "c",
  KeyX: "x",
  Escape: "Escape",
};

class Failure extends Error {}

export class Harness {
  constructor(frame) {
    this.frame = frame;
    this.errors = [];
    this.params = "";
  }

  get win() {
    return this.frame.contentWindow;
  }

  get doc() {
    return this.frame.contentDocument;
  }

  // Новая загрузка страницы игры; ждём стартовый экран.
  async load(params = "") {
    this.params = params;
    this.errors = [];
    await new Promise((resolve) => {
      this.frame.addEventListener("load", resolve, { once: true });
      // nonce — чтобы браузер не взял из кэша прежнюю версию страницы с теми же параметрами.
      const nonce = `e2e=${Date.now()}`;
      this.frame.src = `../../index.html?${params ? `${params}&` : ""}${nonce}`;
    });
    const win = this.win;
    win.addEventListener("error", (event) => this.errors.push(String(event.message)));
    win.addEventListener("unhandledrejection", (event) => this.errors.push(String(event.reason)));
    await this.waitFor("стартовый экран", () => this.screen() === "start");
  }

  // Перезагрузка той же страницы (рекорды в sessionStorage сохраняются).
  async reload() {
    await this.load(this.params);
  }

  async waitFor(name, cond, timeout = 3000) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      try {
        if (cond()) return;
      } catch {
        // страница ещё не готова
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Failure(`не дождались: ${name}`);
  }

  // ---------- ввод ----------

  key(code) {
    const event = new this.win.KeyboardEvent("keydown", {
      code,
      key: KEY_NAMES[code] ?? code,
      bubbles: true,
      cancelable: true,
    });
    this.doc.dispatchEvent(event);
  }

  keys(codes) {
    for (const code of codes) this.key(code);
  }

  click(selector) {
    const el = this.doc.querySelector(selector);
    if (!el) throw new Failure(`нет элемента ${selector}`);
    el.click();
  }

  advance(ms) {
    this.win.dispatchEvent(new this.win.CustomEvent("tetris:advance", { detail: { ms } }));
  }

  // Несколько шагов времени по 1000 мс.
  seconds(n) {
    for (let i = 0; i < n; i++) this.advance(1000);
  }

  blur() {
    this.win.dispatchEvent(new this.win.Event("blur"));
  }

  setHidden(hidden) {
    Object.defineProperty(this.doc, "hidden", { configurable: true, get: () => hidden });
    this.doc.dispatchEvent(new this.win.Event("visibilitychange"));
  }

  // ---------- чтение ----------

  screen() {
    return this.doc.documentElement.dataset.screen;
  }

  el(selector) {
    return this.doc.querySelector(selector);
  }

  all(selector) {
    return [...this.doc.querySelectorAll(selector)];
  }

  text(selector) {
    const el = this.el(selector);
    if (!el) throw new Failure(`нет элемента ${selector}`);
    return el.textContent.replace(/\s+/g, " ").trim();
  }

  visible(selector) {
    const el = this.el(selector);
    return Boolean(el) && !el.closest("[hidden]") && el.getClientRects().length > 0;
  }

  // Индексы клеток поля с фигурами.
  pieceCells() {
    return this.all("#board .cell")
      .map((cell, i) => (cell.dataset.p ? i : -1))
      .filter((i) => i >= 0);
  }

  // Клетки фигур в верхних rows строках: сразу после появления там только
  // активная фигура, если стопка ниже (сценарий отвечает за это условие).
  topPieceCells(rows = 4) {
    return this.pieceCells().filter((i) => i < rows * 10);
  }

  ghostCount() {
    return this.all("#board .cell[data-g]").filter((cell) => !cell.dataset.p).length;
  }

  // ---------- рекорды в sessionStorage (общем с iframe) ----------

  clearRecords() {
    for (const key of RECORD_KEYS) sessionStorage.removeItem(key);
  }

  setRecord(key, value) {
    sessionStorage.setItem(key, value);
  }

  getRecord(key) {
    return sessionStorage.getItem(key);
  }

  // ---------- проверки ----------

  expect(name, expected, actual) {
    if (expected !== actual) throw new Failure(`${name}: ожидали «${expected}», получили «${actual}»`);
  }

  expectIncludes(name, needle, haystack) {
    if (!String(haystack).includes(needle)) throw new Failure(`${name}: ожидали «${needle}» в «${haystack}»`);
  }

  expectTrue(name, cond) {
    if (!cond) throw new Failure(name);
  }

  expectVisible(selector, visible = true) {
    this.expectTrue(`${selector} ${visible ? "должен быть виден" : "должен быть скрыт"}`, this.visible(selector) === visible);
  }

  expectScreen(name) {
    this.expect("экран", name, this.screen());
  }

  expectNoErrors() {
    if (this.errors.length > 0) throw new Failure(`ошибки страницы: ${this.errors.join("; ")}`);
  }

  // ---------- типовые шаги ----------

  // Выбрать режим кликом и начать партию.
  start(mode) {
    if (mode) this.click(`#mode-list [data-mode="${mode}"]`);
    this.click("#start-button");
    this.expectScreen("playing");
  }

  // Жёсткий сброс, пока партия не кончится (не больше limit раз).
  dropUntilOver(limit = 60) {
    for (let i = 0; i < limit && this.screen() === "playing"; i++) this.key("Space");
    this.expectTrue("партия должна закончиться жёсткими сбросами", this.screen() !== "playing");
  }

  // Сыграть ходы плана; перед каждой фигурой — msBefore игрового времени.
  play(moves, { msBefore = 0 } = {}) {
    for (const move of moves) {
      if (msBefore > 0) this.advance(msBefore);
      this.keys(move.keys);
    }
  }
}

// Прогон одного сценария в свежем харнессе.
export async function runScenario(frame, item) {
  const h = new Harness(frame);
  h.clearRecords();
  try {
    await item.run(h);
    h.expectNoErrors();
    return { id: item.id, status: "PASS", details: "", params: h.params };
  } catch (error) {
    const details = error instanceof Failure ? error.message : `${error?.name ?? "Error"}: ${error?.message ?? error}`;
    return { id: item.id, status: "FAIL", details, params: h.params };
  } finally {
    h.clearRecords();
  }
}
