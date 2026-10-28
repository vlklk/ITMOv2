// Планировщик ходов для сквозных проверок (research R6). Только публичный API
// src/game.js. Не источник ожиданий: во время прогона он лишь превращает seed
// в клавиши; ожидаемые значения — литералы в scenarios/fixtures.js (найдены в T013).
import { BOARD_HEIGHT, BOARD_WIDTH, createGame, rotate, moveLeft, moveRight, hardDrop } from "../../src/game.js";

// Все достижимые с точки появления положения: повороты 0–3, затем сдвиги.
function candidates(state) {
  const result = [];
  let rotated = state;
  for (let r = 0; r < 4; r++) {
    if (r > 0) {
      const next = rotate(rotated);
      if (next === rotated) break;
      rotated = next;
    }
    const rotateKeys = Array(r).fill("ArrowUp");
    result.push({ keys: [...rotateKeys, "Space"], after: hardDrop(rotated) });
    for (const [step, key] of [
      [moveLeft, "ArrowLeft"],
      [moveRight, "ArrowRight"],
    ]) {
      let moved = rotated;
      const moveKeys = [];
      for (;;) {
        const next = step(moved);
        if (next === moved) break;
        moved = next;
        moveKeys.push(key);
        result.push({ keys: [...rotateKeys, ...moveKeys, "Space"], after: hardDrop(moved) });
      }
    }
  }
  return result;
}

function features(board) {
  const heights = [];
  let holes = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let top = BOARD_HEIGHT;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (board[y][x] !== null) {
        top = y;
        break;
      }
    }
    heights.push(BOARD_HEIGHT - top);
    for (let y = top + 1; y < BOARD_HEIGHT; y++) if (board[y][x] === null) holes++;
  }
  return { heights, holes };
}

const sum = (list) => list.reduce((a, b) => a + b, 0);
const bumpiness = (list) => sum(list.slice(1).map((h, i) => Math.abs(h - list[i])));

// safe — аккуратная игра (коэффициенты El-Tetris); well — правый столбец под тетрис.
function evaluate(before, after, style) {
  if (after.outcome === "topOut") return -1e9;
  if (after.outcome === "sprintFinish") return 1e9;
  const cleared = after.lines - before.lines;
  const { heights, holes } = features(after.board);
  if (style === "safe") {
    return -0.51 * sum(heights) + 0.76 * cleared - 0.36 * holes - 0.18 * bumpiness(heights);
  }
  const left = heights.slice(0, BOARD_WIDTH - 1);
  const urgent = Math.max(...left) > 12;
  let score = -0.51 * sum(left) - 1.0 * holes - 0.18 * bumpiness(left) - 2 * heights[BOARD_WIDTH - 1];
  if (cleared === 4) score += 8;
  else if (cleared > 0) score += urgent ? 3 * cleared : -2 * cleared;
  return score;
}

// План партии: ходы { keys, events, score, lines, level, outcome } до конца или maxPieces.
export function playPlan(seed, mode, style, maxPieces = 200) {
  let state = createGame(seed, mode);
  const moves = [];
  while (!state.over && moves.length < maxPieces) {
    let best = null;
    for (const option of candidates(state)) {
      const value = evaluate(state, option.after, style);
      if (best === null || value > best.value) best = { ...option, value };
    }
    state = best.after;
    moves.push({
      keys: best.keys,
      events: state.events,
      score: state.score,
      lines: state.lines,
      level: state.level,
      outcome: state.outcome,
    });
  }
  return moves;
}

// Первый seed в [from, to], на котором предикат плана истинен.
export function findSeed(mode, style, predicate, from = 1, to = 200, maxPieces = 200) {
  for (let seed = from; seed <= to; seed++) {
    const moves = playPlan(seed, mode, style, maxPieces);
    const found = predicate(moves);
    if (found !== false && found !== undefined && found !== null) return { seed, moves, found };
  }
  return null;
}
