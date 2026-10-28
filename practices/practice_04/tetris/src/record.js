// B3: рекорд в Web Storage. Хранилище передаётся параметром, поэтому модуль
// не трогает DOM и проверяется в node с подменой хранилища.
// null вместо числа означает «хранилище недоступно — играем без рекорда».

import { MODES } from "./game.js";

const RECORD_KEY = "tetris.record";

// Фича 002: свой рекорд у каждого режима (контракт §2.6). Марафон остаётся
// в прежнем ключе, поэтому рекорд, сохранённый до режимов, не теряется.
const MODE_KEYS = {
  marathon: RECORD_KEY,
  sprint: "tetris.record.sprint",
  ultra: "tetris.record.ultra",
};

// Само обращение к window.localStorage бросает SecurityError, если сайту
// запрещено хранить данные; тогда хранилища нет.
export function localStorageOf(win) {
  try {
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

// Рекорд — неотрицательное целое; всё остальное в хранилище считается мусором.
export function readRecord(storage) {
  try {
    const value = Number(storage.getItem(RECORD_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return null;
  }
}

// Записывает счёт, только если он выше рекорда; возвращает действующий рекорд.
// Если записать новый рекорд не удалось, действующим остаётся прочитанный.
// null — только когда хранилища нет или из него нельзя читать.
export function saveRecord(storage, score) {
  const current = readRecord(storage);
  if (current === null || score <= current) return current;
  try {
    storage.setItem(RECORD_KEY, String(score));
    return score;
  } catch {
    return current;
  }
}

// Неизвестный режим — нарушение контракта вызова: бросаем до обращения к хранилищу.
function modeFor(modeId) {
  const mode = MODES.find((candidate) => candidate.id === modeId);
  if (!mode) throw new RangeError(`Неизвестный режим игры: ${modeId}`);
  return mode;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Рекорд режима: null — хранилища нет или из него нельзя читать; 0 — рекорда
// нет (или значение испорчено); иначе — целые очки или мс.
export function readModeRecord(storage, modeId) {
  const key = MODE_KEYS[modeFor(modeId).id];
  try {
    const value = Number(storage.getItem(key));
    return isPositiveInteger(value) ? value : 0;
  } catch {
    return null;
  }
}

// Сохраняет результат партии, если он строго лучше рекорда по направлению
// режима (better). Возвращает {record, previous, isNew} или null без хранилища.
// Если запись не удалась, действует прежний рекорд, а isNew = false.
export function saveModeRecord(storage, modeId, result) {
  const mode = modeFor(modeId);
  const previous = readModeRecord(storage, modeId);
  if (previous === null) return null;
  const beats = mode.better === "higher" ? result > previous : result < previous;
  if (!isPositiveInteger(result) || (previous > 0 && !beats)) {
    return { record: previous, previous, isNew: false };
  }
  try {
    storage.setItem(MODE_KEYS[mode.id], String(result));
    return { record: result, previous, isNew: true };
  } catch {
    return { record: previous, previous, isNew: false };
  }
}
