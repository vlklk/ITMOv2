---

description: "Задачи реализации логики режимов игры и событий для подписей"
---

# Tasks: Режимы игры и события для подписей — логика

**Input**: Design documents from `specs/002-game-modes-logic/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/README.md) → [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) §2, [quickstart.md](quickstart.md)

**Tests**: обязательны — конституция, принцип II (TDD, NON-NEGOTIABLE). Для каждого требования сначала тест, затем код: тест запускается `sh scripts/check.sh` и **должен упасть** до задачи реализации. Имя теста начинается с ID требования (`LG FR-011: …`; контрактные — `LG FR-0xx (§2.n): …`). Ожидания — литералы, посчитанные вручную, а не вычисленные кодом. Одно поведение на тест; `node:test` + `node:assert/strict`.

**Organization**: задачи сгруппированы по user stories из spec.md (US1–US5).

**Все пути** — от корня проекта `practices/practice_04/tetris/`. Перед любой задачей кода прочитать `docs/style-guide.md`. Не менять `tests/game.test.js`, `tests/assist.test.js`, `tests/record.test.js`, `tests/smoke.test.js`, `scripts/check.sh`, `docs/requirements.md`, `src/ui.js`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: к какой user story относится задача (US1…US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: подготовка к TDD без изменения поведения

- [X] T001 Прочитать `docs/style-guide.md`, `.claude/skills/test-driven-development/SKILL.md` и `.claude/skills/test-driven-development/writing-good-tests.md`; сверить план с контрактом `specs/shared/game-modes-contract.md` §2
- [X] T002 Зафиксировать базовую линию: `sh scripts/check.sh` → exit 0, 65 тестов (A1–A6, B1–B3, smoke); число записать в заметку к T034
- [X] T003 Создать вспомогательный модуль тестов `tests/support.js` (не `*.test.js`, без проверок): `stateWith(active, filled, extra)` по образцу `tests/game.test.js` (на базе `createGame(1)`), `fullRowsExcept(rows, gapX)` — клетки заполненных строк с пустым столбцом `gapX`, класс `MemoryStorage` (как в `tests/record.test.js`), `throwingStorage({ read, write })` — хранилище, бросающее при чтении и/или записи

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: режимы, новые поля состояния, `advanceTime` без концов партии, правило «тот же объект / свои `events`» — всё, на что опираются US1–US5

**⚠️ CRITICAL**: работа над user stories начинается только после этой фазы

- [X] T004 [P] **Контрактные тесты §2.1–§2.3** в `tests/contract.test.js` (до реализации, должны упасть): `LG FR-044 (§2.1)` — `MODES` заморожен (`Object.isFrozen` у массива и каждого элемента), id в порядке `["marathon", "sprint", "ultra"]`, у каждого ровно поля `id`, `goalLines`, `timeLimitMs`, `resultKind`, `better` со значениями из таблицы §2.1 (литералы `40`, `120000`, `"score"`/`"time"`, `"higher"`/`"lower"`, `null`); `LG FR-043 (§2.2)` — для каждого режима `createGame(1, id)` содержит поля `mode`, `score`, `lines`, `level`, `linesToGoal`, `elapsedMs`, `remainingMs`, `outcome`, `over`, `result`, `combo`, `backToBack`, `events` с начальными значениями `0`/`0`/`1`/(`40` у `sprint`, иначе `null`)/`0`/(`120000` у `ultra`, иначе `null`)/`"playing"`/`false`/`null`/`0`/`false`/`[]`; `LG FR-003 (§2.3)` — `createGame(1, "nope")` бросает `RangeError`; `typeof advanceTime === "function"`; правило объекта — `moveLeft` у левой стены возвращает вход (`assert.equal(next, state)`) — **характеризующий** пункт: так уже работает текущий код, он может быть зелёным сразу (заметка в `docs/HANDOFF.md`, T032). Импорт модуля — пространством имён (`import * as game`), чтобы отсутствие `advanceTime` роняло один тест, а не загрузку файла
- [X] T005 [P] Тесты LG FR-001, FR-002, FR-004, FR-005 в `tests/modes.test.js` (должны упасть): `LG FR-002: без режима партия — marathon`; `LG FR-002: createGame(1) и createGame(1, "marathon") дают одинаковые active и next`; `LG FR-002: режим sprint сохраняется в поле mode`; `LG FR-004: в режиме sprint первые две фигуры те же, что у marathon при seed 1` (ожидаемые типы — литералы из существующего теста `A1: игра начинается с первых двух фигур последовательности seed`, а не вызов `pieceSequence` в тесте; для seed 9 — `Z`, затем `L`, как в `B2: первый hold берёт новую следующую фигуру`). По находке L5 — **характеризующие** тесты FR-004 в других режимах (могут быть зелёными сразу, т. к. `createGame` до T006 игнорирует второй аргумент; заметка в `docs/HANDOFF.md`, T032): `LG FR-004: в sprint призрак T на пустом поле лежит на дне` (литерал `{type: "T", rotation: 0, x: 3, y: 18}` из теста B1); `LG FR-004: в ultra первый hold откладывает текущую фигуру и выводит следующую` (литералы из теста B2: `hold` = `"T"`, `active` = `{type: "O", rotation: 0, x: 4, y: 0}`)
- [X] T006 Реализовать в `src/game.js`: экспорт `MODES` (замороженный массив замороженных объектов по §2.1), внутренний поиск режима по id с `RangeError` для неизвестного, `createGame(seed, modeId = "marathon")` с новыми полями и начальными значениями из data-model §2. T004 (кроме пунктов про `advanceTime`) и T005 — зелёные; 65 прежних тестов — зелёные
- [X] T007 Тесты LG FR-007, FR-008, FR-009 в `tests/modes.test.js` (должны упасть): `LG FR-007: advanceTime 16 и затем 16.7 мс даёт elapsedMs 32.7`; `LG FR-007: advanceTime возвращает новый объект с events []`; `LG FR-008: deltaMs 0 / −5 / NaN / Infinity / "16" — тот же объект` (по тесту на каждое значение); `LG FR-008: после over = true advanceTime возвращает тот же объект`; `LG FR-009: в marathon и sprint remainingMs остаётся null после advanceTime(state, 1000)`; `LG FR-009: в ultra после advanceTime(state, 60000) remainingMs 60000`; `LG FR-007: hardDrop и tick не меняют elapsedMs`
- [X] T008 Реализовать `advanceTime(state, deltaMs)` в `src/game.js` без окончания партии: проверка `typeof deltaMs === "number" && Number.isFinite(deltaMs) && deltaMs > 0` и `!state.over`, иначе вход; `elapsedMs + deltaMs`; `remainingMs` для `ultra` = `max(0, 120000 − elapsedMs)` (research R1, R12, R14)
- [X] T009 [P] Тесты LG FR-042 (правило объекта) в `tests/events.test.js` (должны упасть): из состояния с `events: [{ type: "tetris", bonus: 0 }]` вызовы `moveLeft`, `moveRight`, `rotate`, `hold`, `tick` (без фиксации), `softDrop` (без фиксации), `hardDrop` (фиксация без строк) возвращают новый объект с `events` `[]` — по тесту на функцию; отменённый поворот, повторный `hold`, `moveRight` у правой стены возвращают вход (`assert.equal`)
- [X] T010 Реализовать в `src/game.js` единую внутреннюю сборку нового состояния, которая задаёт `events` (переданные или `[]`), и провести через неё все ветки `moveLeft`, `moveRight`, `rotate`, `hold`, `tick`, `softDrop`, `hardDrop`, `advanceTime`, `lockPiece`; ветки без изменений возвращают вход (research R2). Проверка «партия окончена» остаётся по `state.over` (R3)
- [X] T011 Чекпоинт: `sh scripts/check.sh` → exit 0; T004, T005, T007, T009 зелёные; 65 прежних тестов не изменены (`git diff --stat -- tests/game.test.js tests/assist.test.js tests/record.test.js tests/smoke.test.js` пусто)

**Checkpoint**: фундамент готов — US1, US2, US3, US4 можно начинать параллельно

---

## Phase 3: User Story 1 - Спринт 40: собрать 40 линий на время (Priority: P1) 🎯 MVP

**Goal**: партия `sprint` заканчивается финишем на 40+ линиях с результатом-временем; переполнение — без результата; уровни растут во всех режимах.

**Independent Test**: `createGame(seed, "sprint")` → `advanceTime` → фиксации до 40 линий → `outcome "sprintFinish"`, `result = Math.round(elapsedMs)`; `marathon` — прежнее поведение.

### Tests for User Story 1 ⚠️

> Написать первыми и убедиться, что падают

- [X] T012 [US1] Тесты LG FR-010…FR-013, FR-016 в `tests/modes.test.js`. Поле для тетриса — 4 нижние строки заполнены кроме столбца 5 (`fullRowsExcept([16, 17, 18, 19], 5)`), вертикальная I (`rotation 1, x 3`) уже стоит на дне колодца (`y 16`), как в `B1: вертикальная I над колодцем` в `tests/assist.test.js`; фиксация — `tick` (без очков за спуск): `LG FR-011: sprint, 38 линий, elapsedMs 83456, тетрис → lines 42, outcome "sprintFinish", over true, result 83456`; `LG FR-011: sprint, 39 линий, одна строка → lines 40, linesToGoal 0, sprintFinish`; `LG FR-011: elapsedMs 83455.6 → result 83456`; `LG FR-011: sprint, 20 линий, одна строка → linesToGoal 19, outcome "playing"`; `LG FR-012: финиш и переполнение одной фиксацией → sprintFinish` (O на дне в x 0–1, строка 19 заполнена в x 2–9, `lines: 39`, `next: "T"`, занятая клетка `[4, 0]`: после удаления строки 19 она сдвигается в `[4, 1]` и перекрывает точку появления T); `LG FR-013: sprint, переполнение → outcome "topOut", result null`; `LG FR-016: marathon, переполнение при score 1234 → outcome "topOut", result 1234`; `LG FR-016: marathon, 39 линий, одна строка → outcome "playing"`; `LG FR-010: после sprintFinish moveLeft, rotate, hold, tick, softDrop, hardDrop, advanceTime возвращают тот же объект` (по тесту на функцию или цикл с именем функции в сообщении)
- [X] T013 [US1] Тесты LG FR-006 в `tests/modes.test.js`: `LG FR-006: sprint, 9 линий, одна строка → level 2`; `LG FR-006: ultra, 19 линий, одна строка → level 3` (**характеризующие**: уровень по A5 уже растёт в любом состоянии, тесты могут быть зелёными сразу; кода не добавлять, заметка — в `docs/HANDOFF.md`, T032)

### Implementation for User Story 1

- [X] T014 [US1] Реализовать в `lockPiece` (`src/game.js`) по research R4, шаги 7, 9–11: пересчёт `linesToGoal` (`sprint`: `max(0, 40 − lines)`), исход `sprintFinish` при `lines ≥ 40` в `sprint` **до** проверки переполнения, `result = Math.round(elapsedMs)`; при `topOut` — `outcome "topOut"`, `over true`, `result`: `score` в `marathon`/`ultra`, `null` в `sprint`; следующая фигура выставляется и при финише (R13). Событие `sprintFinish` — в US5 (T028)
- [X] T015 [US1] Чекпоинт: `sh scripts/check.sh` → exit 0; US1 работает без US2–US5

**Checkpoint**: MVP — спринт играбелен на уровне логики

---

## Phase 4: User Story 2 - Ультра 2 минуты: максимум очков за время (Priority: P2)

**Goal**: партия `ultra` заканчивается `timeUp` ровно на 120 000 мс игрового времени, результат — очки.

**Independent Test**: `createGame(seed, "ultra")`, `advanceTime` в сумме до 120 000 → `outcome "timeUp"`, `remainingMs 0`, `result = score`.

### Tests for User Story 2 ⚠️

- [X] T016 [US2] Тесты LG FR-014, FR-015 в `tests/modes.test.js`: `LG FR-014: ultra, elapsedMs 119990, score 5300, advanceTime 16 → elapsedMs 120000, remainingMs 0, outcome "timeUp", over true, result 5300`; `LG FR-014: ultra, elapsedMs 0, advanceTime 120000 → timeUp`; `LG FR-014: при timeUp активная фигура и board не меняются, score остаётся 5300` (`assert.deepEqual` с литералом активной фигуры); `LG FR-014: ultra, elapsedMs 100000, advanceTime 1000 → outcome "playing", remainingMs 19000`; `LG FR-014: после timeUp advanceTime и hardDrop возвращают тот же объект`; `LG FR-015: ultra, переполнение при score 4200 → outcome "topOut", result 4200`; `LG FR-014: sprint, elapsedMs 600000, advanceTime 1000 → outcome "playing"` (у спринта нет предела времени). **Зависимость (M4)**: тест FR-015 опирается на `outcome "topOut"` и `result` из T014 (US1) — выполнять после T014

### Implementation for User Story 2

- [X] T017 [US2] Реализовать в `advanceTime` (`src/game.js`) ветку `ultra` (research R5): `elapsedMs = min(120000, elapsedMs + deltaMs)`, при 120 000 — `outcome "timeUp"`, `over true`, `result = score`, `remainingMs 0`, без фиксации фигуры. Событие `timeUp` — в US5 (T028)
- [X] T018 [US2] Чекпоинт: `sh scripts/check.sh` → exit 0; US1 и US2 работают независимо

---

## Phase 5: User Story 3 - Свой рекорд у каждого режима (Priority: P3)

**Goal**: `readModeRecord` / `saveModeRecord` с ключами по режимам и итогом `{record, previous, isNew}`; сбои хранилища не бросаются.

**Independent Test**: с `MemoryStorage` и бросающим хранилищем из `tests/support.js` — сценарии US3 AS1–AS8.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] **Контрактные тесты §2.6** в `tests/contract.test.js` (должны упасть): `LG FR-033 (§2.6)` — `saveModeRecord(new MemoryStorage(), "ultra", 10)` возвращает объект ровно с ключами `["isNew", "previous", "record"]` (отсортированные), типы `number`/`number`/`boolean`; `LG FR-035 (§2.6)` — `readModeRecord` для пустого хранилища возвращает `0`, для `null` — `null`; `LG FR-003 (§2.6)` — `readModeRecord(storage, "nope")` и `saveModeRecord(storage, "nope", 1)` бросают `RangeError`; `readRecord` и `saveRecord` по-прежнему экспортируются
- [X] T020 [P] [US3] Тесты LG FR-030…FR-035 в `tests/mode-record.test.js` (должны упасть): `LG FR-033: sprint без рекорда, 95000 → {record: 95000, previous: 0, isNew: true}`; `LG FR-032: sprint 95000 → 88120 → {record: 88120, previous: 95000, isNew: true}`; `LG FR-032: sprint 88120, результат 90000 → {record: 88120, previous: 88120, isNew: false}`; `LG FR-032: sprint 88120, результат 88120 → isNew false`; `LG FR-032: ultra 7000 → 9500 → isNew true`; `LG FR-032: marathon 12000, результат 11000 → isNew false`; `LG FR-032: результат 0 не становится рекордом` (`{record: 0, previous: 0, isNew: false}`, ключ не записан); `LG FR-032: результат null не записывается`; `LG FR-031: saveModeRecord sprint 95000 пишет "95000" в ключ "tetris.record.sprint"`; `LG FR-031: ultra пишет в "tetris.record.ultra"`; `LG FR-031: "12000" в "tetris.record" читается как рекорд marathon 12000`; `LG FR-030: рекорд одного режима не меняет два других` — для каждого из 3 режимов (SC-005: 9 пар с литералами); `LG FR-034: хранилище null → readModeRecord null, saveModeRecord null`; `LG FR-034: чтение бросает → null у обеих функций`; `LG FR-034: запись бросает при рекорде 95000 и результате 88120 → {record: 95000, previous: 95000, isNew: false}`; `LG FR-035: "abc", "0", "-5", "12.5" в "tetris.record.sprint" → readModeRecord 0` (по тесту на значение)

### Implementation for User Story 3

- [X] T021 [US3] Реализовать в `src/record.js` (research R7, R15, R16): таблица ключей (`marathon` → `tetris.record`, `sprint` → `tetris.record.sprint`, `ultra` → `tetris.record.ultra`); импорт `MODES` из `./game.js`; `readModeRecord(storage, modeId)` — `RangeError` для неизвестного id до обращения к хранилищу, `null` при сбое чтения, `0` для пустого или испорченного значения («не число, не целое, ≤ 0»), иначе целое; `saveModeRecord(storage, modeId, result)` — `null`, если чтение недоступно; запись только при `result` целом > 0 и (`previous === 0` или строго лучше по `better`); при сбое записи `record = previous`, `isNew = false`. `readRecord`, `saveRecord`, `localStorageOf` не менять
- [X] T022 [US3] Чекпоинт: `sh scripts/check.sh` → exit 0; `tests/record.test.js` (B3) не изменён и зелёный

---

## Phase 6: User Story 4 - Комбо и «Подряд» дают бонусные очки (Priority: P4)

**Goal**: поля `combo`, `backToBack` и бонусы 50 × (n − 1) × уровень и 400 × уровень во всех режимах.

**Independent Test**: подготовленные поля с заданными `combo`, `backToBack`, `level` → `hardDrop` → `score`, `combo`, `backToBack` равны ручным литералам из US4.

### Tests for User Story 4 ⚠️

- [X] T023 [US4] Тесты LG FR-020…FR-024 в `tests/scoring.test.js` (должны упасть). Фигура для одной/двух строк — горизонтальная I или O над подготовленными строками, лежащая на опоре (`hardDrop` с расстоянием 0, чтобы очки за спуск не смешивались; отдельный тест — со спуском). Сценарии US4 с уровнем 1, если не сказано иное: `LG FR-020: combo 0, одна строка → +100, combo 1`; `LG FR-021: combo 1, две строки → +350, combo 2`; `LG FR-021: combo 2, одна строка → +200, combo 3`; `LG FR-020: combo 3, фиксация без строк → combo 0, +0 бонуса`; `LG FR-023: backToBack true, combo 1, тетрис → +1250, backToBack true, combo 2`; `LG FR-022: backToBack true, две строки → backToBack false`; `LG FR-022: backToBack true, фиксация без строк → backToBack true, combo 0`; `LG FR-022: backToBack true, combo 0, тетрис → +1200` (400 «Подряд», без комбо); `LG FR-021: level 3, combo 1, одна строка → +450`; `LG FR-020: hold при combo 2, backToBack true не меняет их`; `LG FR-024: hardDrop на 10 клеток, combo 1, одна строка → +170` (20 за спуск + 100 + 50); `LG FR-024: бонус комбо начисляется в sprint и ultra` (combo 1, одна строка → +150 в каждом режиме)

### Implementation for User Story 4

- [X] T024 [US4] Реализовать в `lockPiece` (`src/game.js`) research R4, шаги 3–6: `combo` (`cleared > 0 ? combo + 1 : 0`), признак «Подряд» (`cleared === 4 && backToBack` до фиксации), новое `backToBack` (4 → `true`, 1–3 → `false`, 0 → без изменений), бонусы по уровню **до** фиксации; `hold`, сдвиги, повороты `combo`/`backToBack` не трогают
- [X] T025 [US4] Чекпоинт: `sh scripts/check.sh` → exit 0; тесты A4 (`tests/game.test.js`) зелёные без изменений

---

## Phase 7: User Story 5 - События игры для всплывающих подписей (Priority: P5)

**Goal**: `events` каждого вызова — типы, параметры, `bonus` и порядок по контракту §2.4.

**Independent Test**: вызовы, порождающие каждое событие, → `assert.deepEqual(next.events, [ …литералы… ])`.

### Tests for User Story 5 ⚠️

- [X] T026 [P] [US5] **Контрактные тесты §2.4** в `tests/contract.test.js` (должны упасть): `LG FR-040 (§2.4)` — у каждого события из набора сценариев (тетрис-после-тетриса со сменой уровня в `sprint` до финиша; `timeUp` в `ultra`) поле `type` из множества `tetris`, `backToBack`, `combo`, `levelUp`, `sprintFinish`, `timeUp` и числовое `bonus`; параметры: `combo` → `n`, `levelUp` → `level`, `sprintFinish` → `timeMs`, `timeUp` → `score`; `LG FR-041 (§2.4)` — порядок типов совпадает с подпоследовательностью `["tetris", "backToBack", "combo", "levelUp", "sprintFinish" | "timeUp"]`, финальное событие не больше одного и последнее; `timeUp` приходит только из `advanceTime`, `sprintFinish` — только из `hardDrop`/`tick`/`softDrop`
- [X] T027 [P] [US5] Тесты LG FR-040…FR-042 в `tests/events.test.js` (должны упасть), ожидания — литералы массивов: `LG FR-040: тетрис → [{type: "tetris", bonus: 0}]` (combo 0, backToBack false, уровень 1, 0 линий); `LG FR-040: combo 1, строка → [{type: "combo", bonus: 50, n: 2}]`; `LG FR-041: тетрис после тетриса → [tetris 0, backToBack 400, combo n 2 bonus 50]`; `LG FR-040: 9 линий, строка → [{type: "levelUp", bonus: 0, level: 2}]` — отдельно в `marathon`, `sprint`, `ultra`; `LG FR-041: sprint, 38 линий, elapsedMs 83456, тетрис → [tetris 0, levelUp level 5, sprintFinish timeMs 83456]`; `LG FR-040: ultra, elapsedMs 119990, score 5300, advanceTime 16 → [{type: "timeUp", bonus: 0, score: 5300}]`; `LG FR-042: следующий вызов после событий → events []`; `LG FR-042: одна-три строки без комбо и смены уровня → events []`; `LG FR-042: новая партия → events []`; `LG FR-040: сумма bonus событий = прибавка score − очки за строки − очки за спуск` (литерал: тетрис после тетриса, уровень 1 → 1250 − 800 = 450)

### Implementation for User Story 5

- [X] T028 [US5] Реализовать в `src/game.js` (research R4 шаг 8–9, R5, R11): события фиксации в порядке `tetris`, `backToBack` (bonus 400 × уровень), `combo` (`n`, bonus 50 × (n − 1) × уровень), `levelUp` (`level`, если `levelForLines(lines после) > level до`), затем `sprintFinish` (`timeMs = result`) последним; в `advanceTime` при `timeUp` — `events = [{ type: "timeUp", bonus: 0, score }]`
- [X] T029 [US5] Чекпоинт: `sh scripts/check.sh` → exit 0; все тесты `tests/contract.test.js` зелёные

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: детерминизм, чистота, документация, итоговая проверка

- [X] T030 [P] Тест LG FR-050 в `tests/events.test.js`: `LG FR-050: одинаковые seed, режим и последовательность вызовов дают равные состояния` — одна и та же фиксированная последовательность (`createGame(7, "ultra")`, `advanceTime` 500, `hardDrop`×5, `hold`, `advanceTime` 1000, `hardDrop`×5) дважды → `assert.deepEqual` итоговых состояний и списков `events` каждого шага (**характеризующий**: может быть зелёным сразу; заметка — в `docs/HANDOFF.md`, T032)
- [X] T031 [P] Проверка LG FR-051 по **коду без комментариев** (M5): `sed -e 's://.*$::' src/game.js | grep -nE "\b(Date|performance|Math\.random|setTimeout|setInterval|requestAnimationFrame|window|document|localStorage)\b"` — совпадений нет (в `src/game.js` нет строк с `//` внутри литералов, поэтому срез комментариев по `//` корректен); в `src/record.js` тем же способом — нет глобальных `window`/`document` (обращение `win.localStorage` к параметру допустимо)
- [X] T032 [P] Дописать в `docs/HANDOFF.md` раздел о фиче 002 (логика): что сделано, число тестов, и решения сверх спецификации для подтверждения — research R3 (проверка по `over`), R8 (бонусы без экспорта), R12 (логика не ограничивает `deltaMs` сверху), R13 (фигура выставляется после финиша), R15 (неподходящий `result` не записывается, без исключения); перечислить характеризующие тесты (L1: пункт правила объекта в T004, FR-004 в T005, FR-006 в T013, FR-050 в T030) — зелёные сразу, потому что закрепляют уже существующее поведение; напомнить, что интеграция в `src/ui.js` — задачи `specs/001-game-modes-ui`
- [X] T033 Сверить экспорты `src/game.js` и `src/record.js` с таблицами контракта `specs/shared/game-modes-contract.md` §2.3 и §2.6 (имена, аргументы по умолчанию, ошибки); расхождение — исправить код, а не контракт
- [X] T034 Пройти [quickstart.md](quickstart.md): `sh scripts/check.sh` → exit 0, тестов = 65 + новые; `git diff --stat` по четырём прежним файлам тестов пуст; команда `node -e …` из §3 печатает `ultra 120000 timeUp`; игра в браузере работает как прежний «Марафон», консоль без ошибок
- [X] T035 Дописать в `docs/requirements.md` (явное поручение ведущего по находке M7 analyze-отчёта) раздел «Фича C — режимы игры и подписи»: 3–6 строк в формате существующей таблицы (`ID | Требование | Как проверяем`, ID `C1…Cn`) со ссылками на `specs/002-game-modes-logic/spec.md`, `specs/001-game-modes-ui/spec.md` и `specs/shared/game-modes-contract.md`; остальное в файле не менять

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: после Setup — блокирует все user stories
- **US1 (Phase 3)**, **US3 (Phase 5)**, **US4 (Phase 6)**: после Foundational, друг от друга не зависят
- **US2 (Phase 4)**: после Foundational и T014 (US1) — тест FR-015 проверяет `outcome "topOut"` и `result` из T014 (M4)
- **US5 (Phase 7)**: после US1 (финиш спринта), US2 (`timeUp`) и US4 (`combo`, `backToBack`) — события описывают их правила
- **Polish (Phase 8)**: после всех stories

### User Story Dependencies

- **US1 (P1)**: только Foundational
- **US2 (P2)**: Foundational (`advanceTime` — T008) и T014 из US1 (`topOut`/`result` для FR-015)
- **US3 (P3)**: только Foundational (`MODES` — T006); код в другом модуле (`src/record.js`)
- **US4 (P4)**: только Foundational
- **US5 (P5)**: US1, US2, US4

### Within Each User Story

- Тест пишется и падает **до** реализации (принцип II); при падении исправляется код, а не тест
- Задачи, меняющие `src/game.js` (T006, T008, T010, T014, T017, T024, T028), выполняются последовательно — один файл
- Задачи с одним файлом тестов (`tests/modes.test.js`: T005, T007, T012, T013, T016; `tests/contract.test.js`: T004, T019, T026; `tests/events.test.js`: T009, T027, T030) последовательны внутри файла
- Чекпоинт фазы — `sh scripts/check.sh` exit 0

### Parallel Opportunities

- Phase 2: T004 (`tests/contract.test.js`), T005 (`tests/modes.test.js`) и T009 (`tests/events.test.js`) пишутся параллельно
- После Phase 2: US3 (`src/record.js`, `tests/mode-record.test.js`) идёт параллельно с US1/US2/US4 (`src/game.js`)
- Внутри US3: T019 и T020 — разные файлы
- Внутри US5: T026 и T027 — разные файлы
- Polish: T030, T031, T032 — разные файлы

---

## Parallel Example: User Story 3

```bash
# Тесты US3 — параллельно (разные файлы):
Task: "T019 Контрактные тесты §2.6 в tests/contract.test.js"
Task: "T020 Тесты LG FR-030…FR-035 в tests/mode-record.test.js"

# Затем реализация:
Task: "T021 readModeRecord / saveModeRecord в src/record.js"
```

## Parallel Example: User Story 5

```bash
Task: "T026 Контрактные тесты §2.4 в tests/contract.test.js"
Task: "T027 Тесты LG FR-040…FR-042 в tests/events.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (режимы, поля, `advanceTime`, правило объекта)
3. Phase 3: US1 — спринт до финиша
4. **STOP and VALIDATE**: `sh scripts/check.sh` exit 0, 65 прежних тестов не тронуты
5. Показать: логика спринта готова для подключения UI

### Incremental Delivery

1. Setup + Foundational → фундамент
2. US1 (спринт) → проверка → MVP
3. US2 (ультра) → проверка
4. US3 (рекорды) — можно параллельно с US1/US2 (другой модуль)
5. US4 (комбо и «Подряд») → проверка
6. US5 (события) → проверка контрактных тестов §2.4
7. Polish → quickstart

### Parallel Team Strategy

1. Вместе: Setup + Foundational
2. Затем: разработчик A — US1 → US2 → US4 → US5 (`src/game.js`, последовательно); разработчик B — US3 (`src/record.js`)
3. Polish — вместе

---

## Notes

- [P] — разные файлы, нет зависимостей от незавершённых задач
- [Story] связывает задачу с user story для трассировки
- Контрактные тесты разбиты по разделам контракта и фазам (T004 — §2.1–2.3, T019 — §2.6, T026 — §2.4), чтобы каждый чекпоинт был зелёным; вместе они составляют `tests/contract.test.js`
- `git commit` — только по поручению пользователя
- Не удалять и не ослаблять тесты; `scripts/check.sh` не менять
