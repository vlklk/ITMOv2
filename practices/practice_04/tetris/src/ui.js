// Интерфейс: DOM, клавиатура, таймер. Вся игровая логика — в game.js.
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  createGame,
  moveLeft,
  moveRight,
  rotate,
  softDrop,
  hardDrop,
  tick,
  dropInterval,
  pieceCells,
  spawnPiece,
} from "./game.js";

const $ = (id) => document.getElementById(id);

const boardWrap = $("board-wrap");
const screens = { start: $("screen-start"), pause: $("screen-pause"), over: $("screen-over") };
const stats = { score: $("score"), level: $("level"), lines: $("lines") };

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

function paint(cell, type) {
  if (type) {
    if (cell.dataset.p !== type) cell.dataset.p = type;
  } else if (cell.dataset.p) {
    delete cell.dataset.p;
  }
}

const numberFormat = new Intl.NumberFormat("ru-RU");

function render(state) {
  const view = state.board.map((row) => [...row]);
  for (const [x, y] of pieceCells(state.active)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) view[y][x] = state.active.type;
  }
  view.flat().forEach((type, i) => paint(boardCells[i], type));

  // Превью 4×2: фигура в точке появления, прижатая к левому верхнему углу.
  const cells = pieceCells(spawnPiece(state.next));
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const filled = new Set(cells.map(([x, y]) => (y - minY) * 4 + (x - minX)));
  previewCells.forEach((cell, i) => paint(cell, filled.has(i) ? state.next : null));
  $("next").setAttribute("aria-label", `следующая фигура: ${state.next}`);

  stats.score.textContent = numberFormat.format(state.score);
  stats.level.textContent = String(state.level);
  stats.lines.textContent = String(state.lines);
}

// ---------- режимы: start → playing ⇄ paused → over ----------

let state = createGame(Date.now());
let mode = "start";
let lastTime = 0;
let elapsed = 0;

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  const button = name && screens[name].querySelector("button");
  if (button) button.focus();
  else boardWrap.focus({ preventScroll: true });
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function startGame() {
  state = createGame(Date.now());
  mode = "playing";
  elapsed = 0;
  render(state);
  showScreen(null);
}

function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  showScreen("pause");
}

function resume() {
  if (mode !== "paused") return;
  mode = "playing";
  showScreen(null);
}

// Пробел, нажатый в момент проигрыша, не должен сразу «нажать» «Играть снова».
const RESTART_GUARD_MS = 700;
let finishedAt = 0;

function finish() {
  mode = "over";
  finishedAt = performance.now();
  $("over-summary").innerHTML =
    `Вы набрали <strong>${numberFormat.format(state.score)}</strong> ` +
    `${plural(state.score, "очко", "очка", "очков")} и собрали ` +
    `<strong>${state.lines}</strong> ${plural(state.lines, "строку", "строки", "строк")}.`;
  showScreen("over");
}

function apply(action) {
  if (mode !== "playing") return;
  state = action(state);
  render(state);
  if (state.over) finish();
}

// ---------- гравитация ----------

function frame(time) {
  const delta = Math.min(time - lastTime, 1000);
  lastTime = time;
  if (mode === "playing") {
    elapsed += delta;
    while (mode === "playing" && elapsed >= dropInterval(state.level)) {
      elapsed -= dropInterval(state.level);
      apply(tick);
    }
  }
  requestAnimationFrame(frame);
}

// ---------- клавиатура ----------

const KEY_ACTIONS = {
  ArrowLeft: moveLeft,
  ArrowRight: moveRight,
  ArrowDown: softDrop,
  ArrowUp: rotate,
  KeyX: rotate,
  Space: hardDrop,
};

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const isPauseKey = event.code === "KeyP" || event.code === "Escape";

  if (mode === "playing") {
    if (isPauseKey) {
      event.preventDefault();
      pause();
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat && action === hardDrop) return;
    apply(action);
  } else if (mode === "paused" && isPauseKey) {
    event.preventDefault();
    resume();
  }
});

// ---------- кнопки для касаний: удержание повторяет действие ----------

const TOUCH_ACTIONS = { left: moveLeft, right: moveRight, rotate, soft: softDrop, hard: hardDrop };
const REPEATING = new Set(["left", "right", "soft"]);

for (const button of document.querySelectorAll(".touch-button")) {
  const name = button.dataset.action;
  let delay = 0;
  let repeat = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (name === "pause") {
      if (mode === "playing") pause();
      else resume();
      return;
    }
    apply(TOUCH_ACTIONS[name]);
    if (REPEATING.has(name)) {
      delay = setTimeout(() => {
        repeat = setInterval(() => apply(TOUCH_ACTIONS[name]), 60);
      }, 180);
    }
  });
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("pointercancel", stop);
  // Клавиатурное нажатие (Enter) на кнопке — одно действие.
  button.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    if (name === "pause") (mode === "playing" ? pause : resume)();
    else apply(TOUCH_ACTIONS[name]);
  });
}

$("start-button").addEventListener("click", startGame);
$("again-button").addEventListener("click", () => {
  if (performance.now() - finishedAt >= RESTART_GUARD_MS) startGame();
});
$("resume-button").addEventListener("click", resume);
window.addEventListener("blur", pause);

render(state);
showScreen("start");
requestAnimationFrame((time) => {
  lastTime = time;
  requestAnimationFrame(frame);
});
