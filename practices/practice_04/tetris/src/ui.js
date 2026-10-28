// Интерфейс: DOM, клавиатура, часы, хранилище. Вся игровая логика — в game.js,
// рекорды — в record.js, показ чисел — в format.js. Порядок вызовов логики —
// контракт specs/shared/game-modes-contract.md §2.3.
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MODES,
  createGame,
  moveLeft,
  moveRight,
  rotate,
  softDrop,
  hardDrop,
  hold,
  tick,
  advanceTime,
  dropInterval,
  pieceCells,
  spawnPiece,
  ghostPiece,
} from "./game.js";
import { localStorageOf, readModeRecord, saveModeRecord } from "./record.js";
import { formatScore, formatSprintTime, formatUltraTime } from "./format.js";

const $ = (id) => document.getElementById(id);

const boardWrap = $("board-wrap");
const screens = { start: $("screen-start"), paused: $("screen-pause"), over: $("screen-over") };
const stats = { score: $("score"), level: $("level"), lines: $("lines"), record: $("record"), time: $("time") };
const caption = $("caption");
const announcer = $("announcer");

const modeById = (id) => MODES.find((mode) => mode.id === id);

// ---------- параметры проверок (specs/001-game-modes-ui/contracts/ui-test-hooks.md) ----------
// Без параметров игра ведёт себя как обычно; они дают только детерминизм.

const params = new URLSearchParams(location.search);
const seedParam = params.get("seed") ?? "";
const fixedSeed = /^-?\d+$/.test(seedParam) ? Number(seedParam) : null;
const manualClock = params.get("clock") === "manual";
const gravityOn = params.get("gravity") !== "off";

function pickStorage(kind) {
  if (kind === "off") return null;
  if (kind === "session" || kind === "readonly") {
    let session;
    try {
      session = window.sessionStorage;
    } catch {
      return null;
    }
    if (kind === "session") return session;
    // Чтение работает, запись бросает — как переполненное хранилище.
    return {
      getItem: (key) => session.getItem(key),
      setItem() {
        throw new Error("хранилище только для чтения");
      },
    };
  }
  return localStorageOf(window);
}

// null — хранилище недоступно, играем без рекордов.
const storage = pickStorage(params.get("storage"));

// ---------- часы интерфейса: реальные или ручные (событие tetris:advance) ----------

let manualNow = 0;
let timerId = 0;
const manualTimers = new Map();

function now() {
  return manualClock ? manualNow : performance.now();
}

function after(ms, fn) {
  if (!manualClock) return setTimeout(fn, ms);
  timerId += 1;
  manualTimers.set(timerId, { at: manualNow + ms, fn });
  return timerId;
}

function cancel(id) {
  if (manualClock) manualTimers.delete(id);
  else clearTimeout(id);
}

function runDueTimers() {
  for (;;) {
    let due = null;
    for (const [id, timer] of manualTimers) {
      if (timer.at <= manualNow && (due === null || timer.at < due[1].at)) due = [id, timer];
    }
    if (due === null) return;
    manualTimers.delete(due[0]);
    due[1].fn();
  }
}

// ---------- клетки поля и превью строятся один раз ----------

function buildCells(container, count) {
  const cells = [];
  for (let i = 0; i < count; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    container.append(cell);
    cells.push(cell);
  }
  return cells;
}

const boardCells = buildCells($("board"), BOARD_WIDTH * BOARD_HEIGHT);
const previewCells = buildCells($("next"), 8);
const holdCells = buildCells($("hold"), 8);

// Клетка фигуры (data-p) или клетка призрачной фигуры (data-g); key — имя атрибута.
function paint(cell, type, key = "p") {
  if (type) {
    if (cell.dataset[key] !== type) cell.dataset[key] = type;
  } else if (cell.dataset[key]) {
    delete cell.dataset[key];
  }
}

// Превью 4×2: фигура в точке появления, прижатая к левому верхнему углу.
function paintPreview(cells, type) {
  const filled = new Set();
  if (type) {
    const shape = pieceCells(spawnPiece(type));
    const minX = Math.min(...shape.map(([x]) => x));
    const minY = Math.min(...shape.map(([, y]) => y));
    for (const [x, y] of shape) filled.add((y - minY) * 4 + (x - minX));
  }
  cells.forEach((cell, i) => paint(cell, filled.has(i) ? type : null));
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// ---------- тексты режимов (числа — из MODES) ----------

function modeTexts(mode) {
  if (mode.goalLines !== null) {
    const n = mode.goalLines;
    return { name: `Спринт ${n}`, goal: `собрать ${n} ${plural(n, "строку", "строки", "строк")} как можно быстрее` };
  }
  if (mode.timeLimitMs !== null) {
    const m = mode.timeLimitMs / 60000;
    const minutes = `${m} ${plural(m, "минуту", "минуты", "минут")}`;
    return { name: `Ультра ${m} ${plural(m, "минута", "минуты", "минут")}`, goal: `набрать максимум очков за ${minutes}` };
  }
  return { name: "Марафон", goal: "без конца, пока не переполнится поле" };
}

function formatResult(mode, value) {
  return mode.resultKind === "time" ? formatSprintTime(value) : formatScore(value);
}

// ---------- состояние интерфейса (data-model §2) ----------

let selectedMode = modeById(params.get("mode"))?.id ?? "marathon";
let state = createGame(newSeed(), selectedMode);
let screen = "start";
let records = {};
let lastSave = null;
let gravityElapsed = 0;
let resumeSkip = false;
let announced = new Set();
let finishedAt = -Infinity;
let captionTimer = 0;
let finishTimer = 0;

function newSeed() {
  return fixedSeed ?? Date.now();
}

function readRecords() {
  records = Object.fromEntries(MODES.map((mode) => [mode.id, readModeRecord(storage, mode.id)]));
}

// ---------- стартовый экран: список режимов ----------

const modeButtons = new Map();

for (const mode of MODES) {
  const { name, goal } = modeTexts(mode);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mode";
  button.dataset.mode = mode.id;
  button.innerHTML = `<span class="mode-name"></span><span class="mode-goal"></span>`;
  button.querySelector(".mode-name").textContent = name;
  button.querySelector(".mode-goal").textContent = goal;
  button.addEventListener("click", () => selectMode(mode.id));
  $("mode-list").append(button);
  modeButtons.set(mode.id, button);
}

function selectMode(id) {
  selectedMode = id;
  renderModes();
  // На стартовом экране колонка показывает набор значений выбранного режима.
  if (screen === "start" && state.mode !== id) {
    state = createGame(newSeed(), id);
    render();
  }
}

function renderModes() {
  for (const mode of MODES) {
    const button = modeButtons.get(mode.id);
    button.setAttribute("aria-pressed", String(mode.id === selectedMode));
    const value = records[mode.id];
    let line = button.querySelector("[data-record]");
    if (value === null) {
      line?.remove();
      continue;
    }
    if (!line) {
      line = document.createElement("span");
      line.className = "mode-record";
      line.dataset.record = "";
      button.append(line);
    }
    const label = mode.resultKind === "time" ? "лучшее время" : "рекорд";
    line.textContent = value > 0 ? `${label} ${formatResult(mode, value)}` : "рекорда пока нет";
  }
}

// ---------- отрисовка ----------

function renderTime() {
  const mode = modeById(state.mode);
  const timed = mode.goalLines !== null || mode.timeLimitMs !== null;
  if (!timed) return "";
  const text =
    mode.timeLimitMs !== null ? formatUltraTime(state.remainingMs) : formatSprintTime(state.result ?? state.elapsedMs);
  stats.time.textContent = text;
  stats.time.toggleAttribute("data-urgent", mode.timeLimitMs !== null && state.remainingMs < 10000);
  return text;
}

function render() {
  const mode = modeById(state.mode);
  const view = state.board.map((row) => [...row]);
  const ghost = state.board.map((row) => row.map(() => null));
  // После конца партии новая фигура может стоять поверх занятых клеток — призрак не нужен.
  if (!state.over) {
    for (const [x, y] of pieceCells(ghostPiece(state))) ghost[y][x] = state.active.type;
  }
  for (const [x, y] of pieceCells(state.active)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      view[y][x] = state.active.type;
      ghost[y][x] = null;
    }
  }
  view.flat().forEach((type, i) => paint(boardCells[i], type));
  ghost.flat().forEach((type, i) => paint(boardCells[i], type, "g"));

  paintPreview(previewCells, state.next);
  $("next").setAttribute("aria-label", `следующая фигура: ${state.next}`);

  const holdBox = $("hold");
  paintPreview(holdCells, state.hold);
  holdBox.toggleAttribute("data-empty", state.hold === null);
  holdBox.toggleAttribute("data-used", state.holdUsed);
  holdBox.setAttribute(
    "aria-label",
    state.hold === null
      ? "отложенной фигуры нет"
      : `отложенная фигура: ${state.hold}${state.holdUsed ? ", до следующей фигуры недоступна" : ""}`,
  );

  // Колонка по режиму (FR-006): время вместо уровня в спринте и ультре.
  const timed = mode.goalLines !== null || mode.timeLimitMs !== null;
  $("time-stat").hidden = !timed;
  $("level-stat").hidden = timed;
  $("time-label").textContent = mode.timeLimitMs !== null ? "осталось" : "время";
  renderTime();

  stats.score.textContent = formatScore(state.score);
  stats.level.textContent = String(state.level);
  stats.lines.textContent =
    mode.goalLines !== null ? `${Math.min(state.lines, mode.goalLines)} из ${mode.goalLines}` : String(state.lines);

  const value = records[state.mode];
  $("record-stat").hidden = value === null || value === undefined;
  if (value !== null && value !== undefined) {
    stats.record.textContent = value > 0 ? formatResult(mode, value) : "пока нет";
  }
}

// ---------- подписи событий (data-model §3) ----------

const FINAL_EVENTS = new Set(["sprintFinish", "timeUp"]);

function eventText(event) {
  switch (event.type) {
    case "tetris":
      return "Тетрис!";
    case "backToBack":
      return "Подряд";
    case "combo":
      return `Комбо ×${event.n}`;
    case "levelUp":
      return `Уровень ${event.level}`;
    case "sprintFinish":
      return "Финиш!";
    case "timeUp":
      return "Время вышло";
    default:
      return "";
  }
}

function announce(text) {
  announcer.textContent = text;
}

function hideCaption() {
  cancel(captionTimer);
  caption.hidden = true;
  caption.replaceChildren();
}

function showEvents(events) {
  const final = events.find((event) => FINAL_EVENTS.has(event.type));
  const lines = [];
  for (const event of final ? [final] : events) {
    lines.push({ text: eventText(event), bonus: false });
    if (event.bonus > 0) lines.push({ text: `+${formatScore(event.bonus)}`, bonus: true });
  }
  caption.replaceChildren(
    ...lines.map(({ text, bonus }) => {
      const line = document.createElement("div");
      line.className = bonus ? "caption-line caption-line--bonus" : "caption-line";
      line.textContent = text;
      return line;
    }),
  );
  caption.toggleAttribute("data-final", Boolean(final));
  caption.hidden = false;
  cancel(captionTimer);
  if (!final) captionTimer = after(1500, hideCaption);
  announce(lines.map((line) => line.text).join(" "));
}

// Объявления остатка ультры диктору (FR-010).
const ULTRA_MARKS = [
  [60000, "осталась 1 минута"],
  [30000, "осталось 30 секунд"],
  [10000, "осталось 10 секунд"],
];

function announceTime() {
  if (state.remainingMs === null || state.over) return;
  for (const [mark, text] of ULTRA_MARKS) {
    if (state.remainingMs <= mark && !announced.has(mark)) {
      for (const [m] of ULTRA_MARKS) if (m >= mark) announced.add(m);
      announce(text);
    }
  }
}

// ---------- экраны: start → playing ⇄ paused → finishing → over ----------

function setScreen(name) {
  screen = name;
  document.documentElement.dataset.screen = name;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  const focusTarget = { start: "start-button", paused: "resume-button", over: "again-button" }[name];
  if (focusTarget) $(focusTarget).focus();
  else boardWrap.focus({ preventScroll: true });
}

function showStart() {
  hideCaption();
  readRecords();
  renderModes();
  render();
  setScreen("start");
}

function startGame(modeId = selectedMode) {
  cancel(finishTimer);
  selectedMode = modeId;
  state = createGame(newSeed(), modeId);
  gravityElapsed = 0;
  resumeSkip = false;
  announced = new Set();
  lastSave = null;
  readRecords();
  hideCaption();
  render();
  setScreen("playing");
}

function pause() {
  if (screen !== "playing") return;
  hideCaption();
  const mode = modeById(state.mode);
  const timed = mode.goalLines !== null || mode.timeLimitMs !== null;
  $("pause-time-line").hidden = !timed;
  if (timed) $("pause-time").textContent = renderTime();
  setScreen("paused");
}

function resume() {
  if (screen !== "paused") return;
  resumeSkip = true;
  setScreen("playing");
}

function toMenu() {
  if (screen !== "paused") return;
  selectedMode = state.mode;
  showStart();
}

// Конец партии (контракт §2.3, шаг 6): один раз сохранить результат,
// финальная подпись ~1 с, затем экран итога.
function finish() {
  finishedAt = now();
  lastSave = state.result !== null ? saveModeRecord(storage, state.mode, state.result) : null;
  readRecords();
  render();
  if (state.outcome === "sprintFinish" || state.outcome === "timeUp") {
    setScreen("finishing");
    finishTimer = after(1000, showOver);
  } else {
    showOver();
  }
}

function showOver() {
  hideCaption();
  const mode = modeById(state.mode);
  const finished = state.outcome === "sprintFinish";
  $("over-title").textContent = { sprintFinish: "Финиш", timeUp: "Время вышло" }[state.outcome] ?? "Игра окончена";

  const summary = $("over-summary");
  const linesText = `<strong>${state.lines}</strong> ${plural(state.lines, "строку", "строки", "строк")}`;
  if (finished) {
    summary.innerHTML = `<strong class="overlay-big">${formatSprintTime(state.result)}</strong> — время на ${mode.goalLines} ${plural(mode.goalLines, "строку", "строки", "строк")}.`;
  } else if (mode.goalLines !== null) {
    summary.innerHTML = `Собрано <strong>${Math.min(state.lines, mode.goalLines)}</strong> из ${mode.goalLines} строк — время не засчитано.`;
  } else {
    summary.innerHTML =
      `Вы набрали <strong>${formatScore(state.score)}</strong> ` +
      `${plural(state.score, "очко", "очка", "очков")} и собрали ${linesText}.`;
  }

  // «Лучшее» — только у финиша спринта и только при настоящем рекорде (M8).
  const best = $("over-best");
  const record = lastSave?.record ?? 0;
  best.hidden = !(finished && record > 0);
  best.textContent = best.hidden ? "" : `лучшее: ${formatSprintTime(record)}`;

  // Пометка — только побитый прежний рекорд (контракт §2.6, Р-16).
  $("over-mark").hidden = !(lastSave?.isNew && lastSave.previous > 0);
  setScreen("over");
}

function apply(action) {
  if (screen !== "playing") return;
  const next = action(state);
  if (next === state) return;
  state = next;
  render();
  if (state.events.length > 0) showEvents(state.events);
  announceTime();
  if (state.over) finish();
}

// ---------- шаг кадра (контракт §2.3, шаг 3) ----------

function step(delta) {
  if (screen !== "playing") return;
  // Первая дельта после продолжения из паузы в игру не передаётся.
  if (resumeSkip) {
    resumeSkip = false;
    return;
  }
  apply((s) => advanceTime(s, delta));
  if (!gravityOn) return;
  gravityElapsed += delta;
  while (screen === "playing" && gravityElapsed >= dropInterval(state.level)) {
    gravityElapsed -= dropInterval(state.level);
    apply(tick);
  }
}

if (manualClock) {
  window.addEventListener("tetris:advance", (event) => {
    let ms = event.detail?.ms;
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return;
    while (ms > 0) {
      const chunk = Math.min(ms, 1000);
      ms -= chunk;
      manualNow += chunk;
      step(chunk);
      runDueTimers();
    }
  });
} else {
  let lastTime = 0;
  const frame = (time) => {
    const delta = Math.min(time - lastTime, 1000);
    lastTime = time;
    if (delta > 0) step(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(frame);
  });
}

// ---------- клавиатура ----------

const KEY_ACTIONS = {
  ArrowLeft: moveLeft,
  ArrowRight: moveRight,
  ArrowDown: softDrop,
  ArrowUp: rotate,
  KeyX: rotate,
  Space: hardDrop,
  KeyC: hold,
  ShiftLeft: hold,
  ShiftRight: hold,
};

function moveSelection(step) {
  const ids = MODES.map((mode) => mode.id);
  const index = (ids.indexOf(selectedMode) + step + ids.length) % ids.length;
  selectMode(ids[index]);
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const isPauseKey = event.code === "KeyP" || event.code === "Escape";

  if (screen === "start") {
    if (event.code === "ArrowDown" || event.code === "ArrowUp") {
      event.preventDefault();
      moveSelection(event.code === "ArrowDown" ? 1 : -1);
    }
  } else if (screen === "playing") {
    if (isPauseKey) {
      event.preventDefault();
      pause();
      return;
    }
    // Экранные и удалённые клавиатуры иногда шлют Shift с пустым code — тогда по key.
    const action = KEY_ACTIONS[event.code] ?? (event.key === "Shift" ? hold : undefined);
    if (!action) return;
    event.preventDefault();
    if (event.repeat && (action === hardDrop || action === hold)) return;
    apply(action);
  } else if (screen === "paused" && isPauseKey) {
    event.preventDefault();
    resume();
  } else if (screen === "finishing" && KEY_ACTIONS[event.code]) {
    event.preventDefault();
  }
});

// ---------- кнопки для касаний: удержание повторяет действие ----------

const TOUCH_ACTIONS = {
  left: moveLeft,
  right: moveRight,
  rotate,
  soft: softDrop,
  hard: hardDrop,
  hold,
};
const REPEATING = new Set(["left", "right", "soft"]);

function togglePause() {
  if (screen === "playing") pause();
  else resume();
}

for (const button of document.querySelectorAll(".touch-button")) {
  const name = button.dataset.action;
  let repeat = 0;
  const stop = () => cancel(repeat);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (name === "pause") {
      togglePause();
      return;
    }
    apply(TOUCH_ACTIONS[name]);
    if (REPEATING.has(name)) {
      const again = () => {
        apply(TOUCH_ACTIONS[name]);
        repeat = after(60, again);
      };
      repeat = after(180, again);
    }
  });
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("pointercancel", stop);
  // Клавиатурное нажатие (Enter) на кнопке — одно действие.
  button.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    if (name === "pause") togglePause();
    else apply(TOUCH_ACTIONS[name]);
  });
}

// ---------- кнопки экранов ----------

// Пробел, нажатый в момент конца партии, не должен сразу нажать кнопку итога.
const RESTART_GUARD_MS = 700;
const guarded = (fn) => () => {
  if (screen === "over" && now() - finishedAt >= RESTART_GUARD_MS) fn();
};

$("start-button").addEventListener("click", () => {
  if (screen === "start") startGame(selectedMode);
});
$("again-button").addEventListener("click", guarded(() => startGame(state.mode)));
$("modes-button").addEventListener(
  "click",
  guarded(() => {
    selectedMode = state.mode;
    showStart();
  }),
);
$("resume-button").addEventListener("click", resume);
$("menu-button").addEventListener("click", toMenu);
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

showStart();
