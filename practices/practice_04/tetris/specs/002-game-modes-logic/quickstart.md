# Quickstart: проверка логики режимов игры

**Feature**: [spec.md](spec.md) | **Контракт**: [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) §2 | **Модель**: [data-model.md](data-model.md)

## Предусловия

- Node.js ≥ 20 (проверено на v25), Python 3 — только для просмотра в браузере.
- Каталог: `practices/practice_04/tetris/`. Зависимостей нет, установка не нужна.

## 1. Автоматическая проверка (основная)

```sh
sh scripts/check.sh
```

Ожидается exit 0 и:

- все 65 прежних тестов A1–A6, B1–B3 проходят **без изменений файлов** `tests/game.test.js`, `tests/assist.test.js`, `tests/record.test.js`, `tests/smoke.test.js` (B4, SC-001);
- проходят новые файлы: `tests/contract.test.js` (форма API §2), `tests/modes.test.js`, `tests/scoring.test.js`, `tests/events.test.js`, `tests/mode-record.test.js`;
- у каждого нового теста имя начинается с `LG FR-0xx`.

Проверка, что прежние тесты не тронуты:

```sh
git diff --stat -- tests/game.test.js tests/assist.test.js tests/record.test.js tests/smoke.test.js   # пусто
```

## 2. Сценарии, которые должны подтверждаться тестами

| Сценарий | Ожидаемый итог | Где правило |
|---|---|---|
| `createGame(1)` без режима | `mode "marathon"`, `outcome "playing"`, `elapsedMs 0`, `events []` | spec US1 AS1, контракт §2.3 |
| `createGame(1, "nope")` | `RangeError` | FR-003 |
| Спринт: 38 линий, `elapsedMs` 83 456, тетрис | `lines 42`, `outcome "sprintFinish"`, `result 83456`, события `tetris`, `levelUp` (5), `sprintFinish` | US1 AS2, US5 AS5 |
| Ультра: `elapsedMs` 119 990, `score` 5 300, `advanceTime(state, 16)` | `elapsedMs 120000`, `remainingMs 0`, `outcome "timeUp"`, `result 5300`, `events [timeUp]` | US2 AS2 |
| `advanceTime(state, -5)` / `NaN` / после конца | тот же объект | FR-008 |
| Тетрис после тетриса на уровне 1 | `+1250`, события `tetris` (0), `backToBack` (400), `combo` n=2 (50) | US4 AS5, US5 AS3 |
| Рекорд спринта 95 000 → результат 88 120 | `{record 88120, previous 95000, isNew true}` | US3 AS2 |
| Хранилище бросает при чтении | `readModeRecord` и `saveModeRecord` → `null`, без исключения | US3 AS7 |

## 3. Ручная проверка в node (по желанию)

```sh
node -e 'import("./src/game.js").then(g => { const s = g.createGame(1, "ultra"); console.log(s.mode, s.remainingMs, g.advanceTime(s, 120000).outcome); })'
```

Ожидается: `ultra 120000 timeUp`.

## 4. В браузере

Эта фича не меняет интерфейс: после неё игра в браузере выглядит и ведёт себя как «Марафон» до фичи (`python3 -m http.server 5173` → `http://localhost:5173/`, консоль без ошибок). Выбор режима, таймер и подписи появляются после реализации фичи UI (`specs/001-game-modes-ui`), которая использует этот API.
