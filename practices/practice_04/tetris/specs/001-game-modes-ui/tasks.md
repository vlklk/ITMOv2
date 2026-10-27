---

description: "Задачи реализации интерфейса режимов игры и всплывающих подписей"
---

# Tasks: Режимы игры и всплывающие подписи — интерфейс

**Input**: Design documents from `specs/001-game-modes-ui/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md); API логики — [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) §2

**Tests**: запрошены ведущим — сквозные проверки `tests/e2e/` (сценарии E0–E14) пишутся **до** кода своей истории и сначала дают FAIL; `src/format.js` — по TDD (конституция II).

**Organization**: задачи сгруппированы по историям спеки (US1–US4); каждая история проверяется своими сценариями e2e независимо.

**Зависимость от 002**: Phase 3+ начинаются только после того, как логика 002 влита и T001 прошла. UI использует только API контракта §2; `src/game.js` и `src/record.js` команда UI не меняет.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (другой файл, нет зависимости от незавершённых задач)
- **[Story]**: история спеки (US1…US4)
- Пути — от корня проекта `practices/practice_04/tetris/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: проверить предусловия и подготовить каталог сквозных проверок и план дизайна

- [ ] T001 Проверить предусловие 002 (только чтение): `sh scripts/check.sh` exit 0; `src/game.js` экспортирует `MODES`, `advanceTime`, `createGame(seed, modeId)`, состояние содержит `mode`, `elapsedMs`, `remainingMs`, `linesToGoal`, `outcome`, `over`, `result`, `events`; `src/record.js` экспортирует `readModeRecord`, `saveModeRecord` (контракт §2.1–2.6). Если чего-то нет — остановиться и сообщить ведущему
- [ ] T002 [P] Дописать раздел «Режимы и подписи» в `docs/design-plan.md` по skill `.claude/skills/frontend-design/`: стартовый экран со списком режимов на сетке листа, строка времени вместо уровня, `data-urgent` последних 10 с, подписи красной ручкой в нижней половине поля (не строки появления), экраны итога и кнопки; проверка против шаблонных решений; без новых цветов и шрифтов (FR-022, FR-023)
- [ ] T003 [P] Создать страницу-раннер `tests/e2e/index.html`: кнопка «Запустить все», список сценариев с запуском по одному, таблица «ID — сценарий — параметры — PASS/FAIL — подробности», итог «N из M PASS», `document.title` `e2e: PASS` / `e2e: FAIL`; подключает `harness.js` и `scenarios/*.js` как ES-модули; без зависимостей и CDN (research R7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: форматирование времени, хуки детерминизма в UI, харнесс и планировщик — без них не работает ни одна история

**⚠️ CRITICAL**: работа над историями начинается только после этой фазы

- [ ] T004 [P] Написать падающие тесты `tests/format.test.js` (`node:test` + `node:assert/strict`, одно поведение на тест, литералы из data-model §5): `UI FR-007: formatSprintTime(1234.9) — «0:01,23» (сотые отбрасываются)`, `0` → «0:00,00», `98020` → «1:38,02», `724550` → «12:04,55», `3724550` → «1:02:04,55»; `UI FR-008: formatUltraTime(120000) — «2:00»`, `60001` → «1:01», `10000` → «0:10», `9401` → «0:09,5», `1` → «0:00,1», `0` → «0:00»; `formatScore(12400)` → «12 400»
- [ ] T005 Реализовать `src/format.js` (чистые функции без DOM, часов и хранилища) до зелёных T004; `sh scripts/check.sh` exit 0
- [ ] T006 [P] Написать `tests/ui-contract.test.js` — потребительская проверка того, что читает UI (имена `UI L-1: …` и т. п.): `MODES` — ids `marathon`, `sprint`, `ultra` в этом порядке, `goalLines` спринта 40, `timeLimitMs` ультры 120000; `createGame(1, "sprint")` даёт `events` `[]`, `outcome` `"playing"`, `linesToGoal` 40; `advanceTime(s, 0) === s`; `readModeRecord(null, "ultra") === null`. Только литералы; правила логики не перепроверять (их тестирует 002)
- [ ] T007 Добавить в `src/ui.js` разбор параметров проверок по `contracts/ui-test-hooks.md` §1: `seed` (`/^-?\d+$/`), `mode` (только id из `MODES`), `clock=manual`, `gravity=off`, `storage=session|off|readonly`; прочее игнорировать; без параметров поведение прежнее (B4)
- [ ] T008 Ввести в `src/ui.js` часы интерфейса (`now`, «через N мс», «отменить»): обычный режим — `performance.now`/`setTimeout`/`requestAnimationFrame`; `clock=manual` — событие `tetris:advance` с `detail.ms`, нарезка на куски ≤ 1000, синхронная обработка (ui-test-hooks §2); перевести на часы защиту перезапуска 700 мс и повтор кнопок касания
- [ ] T009 Переписать цикл кадра в `src/ui.js` по контракту §2.3: в `playing` `deltaMs = min(now − last, 1000)` → `advanceTime` → шаги `tick` по `dropInterval(state.level)` (не при `gravity=off`); после каждого вызова — если объект `!==` прежнему: обновить вид, прочитать `events` и `over`; при `over` прекратить игровые вызовы; первую дельту после продолжения отбрасывать (data-model §2 `resumeSkip`)
- [ ] T010 Выбор хранилища в `src/ui.js` по параметру `storage` (research R4): `session` → `window.sessionStorage`, `off` → `null`, `readonly` → обёртка `sessionStorage` с бросающим `setItem`; без параметра — `localStorageOf(window)`
- [ ] T011 Отражать экран в `document.documentElement.dataset.screen` (`start|playing|paused|finishing|over`) в `src/ui.js` — `showScreen` и все переходы data-model §1
- [ ] T012 [P] Написать харнесс `tests/e2e/harness.js`: `load(params)` — новый iframe `../../index.html?…`, ожидание `data-screen="start"`, сбор `error`/`unhandledrejection` iframe; `key(code)`, `click(id | selector)`, `advance(ms)`, `blur()`, `setHidden(bool)`, `text(sel)`, `visible(sel)`, `screen()`, `waitFor(cond, 3000)`, `expectEqual(name, expected, actual)`; очистка и запись ключей `tetris.record*` в `sessionStorage`; регистрация сценариев и вывод результата в таблицу раннера
- [ ] T013 [P] Написать планировщик `tests/e2e/planner.js` по research R6: импорт `src/game.js`; для каждой фигуры перебор поворотов 0–3 и сдвигов −5…+5 только через `rotate`, `moveLeft`, `moveRight`, `hardDrop`; оценка поля (высота, дыры, неровность, строки; режим «колодец» для тетриса); выход `{ seed, mode, moves: [{ keys, events, linesAfter }], pieces }`; `findSeed(mode, predicate, range)`
- [ ] T014 Сценарий E0 в `tests/e2e/scenarios/base.js`: без параметров — `data-screen="start"`, выбран «Марафон», `#start-button` → `playing`, `ArrowLeft` сдвигает фигуру (клетки `[data-p]` сместились на 1 влево) (B4, FR-002)

**Checkpoint**: `sh scripts/check.sh` exit 0; раннер открывается, E0 — PASS

---

## Phase 3: User Story 1 — Выбрать режим и сыграть партию в нём (Priority: P1) 🎯 MVP

**Goal**: три режима на стартовом экране, колонка по режиму, время, пауза, финальная подпись и экраны итога по исходу

**Independent Test**: сценарии E1–E5 — PASS (quickstart §2)

### Tests for User Story 1 ⚠️

> Написать сценарии, запустить, убедиться, что они FAIL, затем реализовывать

- [ ] T015 [US1] Сценарий E1 в `tests/e2e/scenarios/us1.js` (`seed=11&clock=manual&gravity=off&storage=session`): `#mode-list [data-mode]` — в порядке `marathon, sprint, ultra`, у каждого название и цель («40 строк», «2 минуты»); `ArrowDown` переводит `aria-pressed` на «Спринт 40», `ArrowUp` — назад; для каждого режима старт и набор колонки: марафон — `#level-stat` виден, `#time-stat` скрыт; спринт — `#time` «0:00,00», `#lines` «0 из 40», `#level-stat` скрыт; ультра — `#time` «2:00» (US1 AS1–2, AS4; FR-001–FR-006)
- [ ] T016 [US1] Сценарий E2 в `tests/e2e/scenarios/us1.js`: seed спринта из `findSeed` (финиш за ≤ 150 фигур) записать литералом; `mode=sprint&clock=manual&gravity=off&storage=session`; перед каждой фигурой `advance(1000)`, затем клавиши плана; после последней фигуры — `data-screen="finishing"`, `#caption[data-final]` «Финиш!», `#lines` «40 из 40»; `advance(1000)` → `over`, `#over-title` «Финиш», время в `#over-summary` = `formatSprintTime(pieces × 1000)`, записанное литералом (US1 AS3; FR-007, FR-012, FR-013)
- [ ] T017 [US1] Сценарий E3 в `tests/e2e/scenarios/us1.js` (`mode=ultra&clock=manual&gravity=off&storage=session`): `advance(1000)` ×119 → `#time` «0:01», `#time[data-urgent]`; `advance(1000)` → `finishing`, подпись «Время вышло»; `ArrowLeft` не меняет поле; `advance(1000)` → `over`, `#over-title` «Время вышло», очки и строки в итоге (US1 AS4; FR-008, FR-012, FR-013)
- [ ] T018 [US1] Сценарий E4 в `tests/e2e/scenarios/us1.js` (`mode=sprint&seed=5&clock=manual&gravity=off&storage=session`): `Space` до `data-screen="over"` (не больше 60 раз) → `#over-title` «Игра окончена», `#over-summary` содержит «из 40» и «время не засчитано»; ключ `tetris.record.sprint` в `sessionStorage` не появился (US1 AS7, US2 AS6; FR-013)
- [ ] T019 [US1] Сценарий E5 в `tests/e2e/scenarios/us1.js` (`mode=sprint&clock=manual&gravity=off`): `advance(3000)` → `#time` «0:03,00»; `KeyP` → `paused`, `#pause-time` «0:03,00»; `advance(5000)` → без изменений; `KeyP`, `advance(1000)` → «0:03,00» (первая дельта после продолжения отброшена, контракт §2.3 шаг 5), ещё `advance(1000)` → «0:04,00»; то же через `blur()` и через `setHidden(true)` + `visibilitychange` (US1 AS6; FR-009, FR-011, Edge «вкладка скрыта»)

### Implementation for User Story 1

- [ ] T020 [US1] Разметка стартового экрана в `index.html`: `#mode-list` с кнопками `[data-mode]` (название, цель, слот `[data-record]`), `#start-button` «Начать игру»; колонка: `#time-stat` / `#time`, `#level-stat` вокруг уровня; экран паузы: `#pause-time`; экран итога: `#over-title`, `#over-summary`, `#over-mark` (ui-test-hooks §3)
- [ ] T021 [US1] Список режимов в `src/ui.js`: строить из `MODES` в его порядке; тексты названий и целей в UI, числа — из `goalLines` / `timeLimitMs`; `selectedMode` по data-model §2 (URL `mode` → иначе `"marathon"`; после партии — её режим); `ArrowUp`/`ArrowDown` на `start` меняют выбор; клик по режиму выбирает; «Начать игру» → `createGame(seed, selectedMode)` (FR-001–FR-004)
- [ ] T022 [US1] Колонка по режиму в `src/ui.js` (data-model §4): спринт — `#time` из `formatSprintTime(elapsedMs)` (после конца — из `result`), `#lines` «min(lines, 40) из 40»; ультра — `formatUltraTime(remainingMs)`, `data-urgent` при `remainingMs < 10000`; `#level-stat` скрыт в спринте и ультре; обновление каждый кадр (FR-006–FR-008)
- [ ] T023 [US1] Объявления времени ультры в `src/ui.js`: `#announcer` (`aria-live="polite"`, добавить в `index.html`) при первом `remainingMs ≤ 60000`, `≤ 30000`, `≤ 10000` — «осталась 1 минута» / «30 секунд» / «10 секунд»; `#time` без `aria-live` (FR-010)
- [ ] T024 [US1] Пауза в `src/ui.js`: `#pause-time` с временем режима и «время остановлено» в спринте и ультре; пауза по `visibilitychange` при `document.hidden` (в дополнение к `blur`); `resumeSkip` после продолжения (FR-009, FR-011)
- [ ] T025 [US1] Конец партии в `src/ui.js`: при `over` и `outcome` `sprintFinish`/`timeUp` — `finishing` с финальной подписью ~1000 мс по часам UI, ввод игнорируется, затем `over`; при `topOut` — сразу `over` (FR-012; контракт §2.3 шаг 6)
- [ ] T026 [US1] Экран итога по исходу в `src/ui.js` (FR-013, контракт §2.5): марафон `topOut` — как сейчас; спринт `sprintFinish` — «Финиш», `formatSprintTime(result)`; спринт `topOut` — «Игра окончена», «собрано N из 40 строк», «время не засчитано»; ультра `timeUp` — «Время вышло», очки и строки; ультра `topOut` — «Игра окончена», очки и строки
- [ ] T027 [P] [US1] Стили в `src/styles.css` по разделу T002: список режимов, выбранный режим, `#time-stat`, `#time[data-urgent]` (`--mark`), экран итога; только `var(--…)`, новые размеры — токенами в `:root`; 360 px; `:focus-visible` (FR-030)

**Checkpoint**: E0–E5 — PASS; `sh scripts/check.sh` exit 0; MVP можно показывать

---

## Phase 4: User Story 2 — Видеть свой рекорд в каждом режиме (Priority: P1)

**Goal**: рекорд каждого режима на стартовом экране, в колонке и на итоге; пометка нового рекорда; работа без хранилища

**Independent Test**: сценарии E6–E8 — PASS

### Tests for User Story 2 ⚠️

- [ ] T028 [P] [US2] Сценарий E6 в `tests/e2e/scenarios/us2.js` (`storage=session&clock=manual&gravity=off`, seed спринта из E2): записать `tetris.record` = `"12400"` → у марафона `[data-record]` «12 400», у спринта и ультры «рекорда пока нет»; финиш спринта (план E2) → без `#over-mark` (первая партия), после «Выбрать режим» у спринта — время партии; записать `tetris.record.sprint` = `"999999"` и повторить → `#over-mark` «Это новый рекорд.»; записать `"1000"` и повторить → пометки нет, в итоге «лучшее» 0:01,00; перезагрузить iframe → рекорд виден на стартовом экране; в ультре `#record` — рекорд ультры (US2 AS1–4; FR-005, FR-014, FR-028)
- [ ] T029 [P] [US2] Сценарий E7 в `tests/e2e/scenarios/us2.js` (`storage=off&clock=manual&gravity=off`): нет `[data-record]` на стартовом экране, `#record-stat` скрыт во всех режимах, после конца партии нет `#over-mark`; все три режима стартуют; ошибок iframe нет (US2 AS5; FR-029, SC-010)
- [ ] T030 [P] [US2] Сценарий E8 в `tests/e2e/scenarios/us2.js` (`storage=readonly`): `tetris.record.ultra` = `"1"` записан раннером напрямую; ультра: 3 × `Space` (очки за жёсткий сброс > 1), `advance(1000)` ×120 до `timeUp` → нет `#over-mark`, на стартовом экране у ультры «1» (Edge «запись не удалась»; FR-029)

### Implementation for User Story 2

- [ ] T031 [US2] Рекорды на стартовом экране в `src/ui.js`: `readModeRecord(storage, id)` для каждого id из `MODES` при каждом показе `start`; `null` — убрать `[data-record]`; `0` — «рекорда пока нет»; `> 0` — `formatScore` или `formatSprintTime` по `resultKind` (FR-005)
- [ ] T032 [US2] Рекорд в колонке и на итоге в `src/ui.js`: `#record` — рекорд текущего режима в его формате, `#record-stat` скрыт при `null`; при `over` — один `saveModeRecord(storage, mode, result)`, если `result !== null`; `#over-mark` при `isNew && previous > 0`; «лучшее: …» в итоге спринта — из `record`; UI сам не сравнивает (FR-014, FR-029, Р-16, Р-17)
- [ ] T033 [P] [US2] Стили строки рекорда в списке режимов в `src/styles.css` (графит, Golos tabular-nums; без новых цветов)

**Checkpoint**: E0–E8 — PASS; рекорд, сохранённый до фичи, виден у «Марафона»

---

## Phase 5: User Story 3 — Видеть всплывающие подписи о событиях (Priority: P2)

**Goal**: «Тетрис!», «Подряд», «Комбо ×N», «Уровень N» с бонусом; не мешают управлению; озвучка; уменьшение движения

**Independent Test**: сценарии E9–E11 — PASS

### Tests for User Story 3 ⚠️

- [ ] T034 [P] [US3] Сценарий E9 в `tests/e2e/scenarios/us3.js`: seed марафона из `findSeed` (план даёт событие `tetris`) — литералом; клавиши плана до тетриса; сразу после `Space` — `#caption` видим, `.caption-line` «Тетрис!»; `advance(1400)` — видим; `advance(300)` — скрыт; во время подписи `ArrowLeft` сдвигает фигуру; `#announcer` содержит «Тетрис!» (US3 AS1, AS5, AS8; FR-020, FR-021, FR-024)
- [ ] T035 [US3] Сценарий E10 в `tests/e2e/scenarios/us3.js`: seed с событием `combo` `n = 2` — литералом; после хода — `.caption-line` «Комбо ×2» и «+N», где N — `bonus` события из плана; `#score` равен очкам состояния планировщика после хода (US3 AS3; FR-018, Р-2)
- [ ] T036 [US3] Сценарий E11 в `tests/e2e/scenarios/us3.js`: при видимой подписи `KeyP` → подпись скрыта; `KeyP` → не вернулась; спринт: последний ход плана E2 — если он с событием `tetris`, показана только «Финиш!» (`data-final`), иначе проверить, что при финальном событии нет обычных строк (FR-019, FR-020, FR-026)

### Implementation for User Story 3

- [ ] T037 [US3] Слой подписей в `index.html`: `#caption` поверх `#board` внутри `#board-wrap`, `aria-hidden="true"` (озвучка — через `#announcer`), без фокусируемых элементов
- [ ] T038 [US3] Подписи в `src/ui.js` по data-model §3: из `events` нового объекта; тексты событий; «+N» при `bonus > 0`; порядок = порядок `events`; финальное — только оно, `data-final`; замена группы; скрытие через 1500 мс по часам UI; скрыть на `paused` и `over`; текст группы одной строкой в `#announcer` (FR-017–FR-020, FR-024, FR-026)
- [ ] T039 [P] [US3] Стили подписей в `src/styles.css`: красная ручка `--mark`, Neucha, нижняя половина поля, `pointer-events: none`, умещается в 10 клеток на 360 px; появление коротким fade/сдвигом, при `prefers-reduced-motion: reduce` — без движения и масштаба (FR-021–FR-023, FR-025)

**Checkpoint**: E0–E11 — PASS

---

## Phase 6: User Story 4 — Повторить партию или сменить режим (Priority: P3)

**Goal**: «Играть снова» и «Выбрать режим» на итоге, «К выбору режима» на паузе, защита 0,7 с

**Independent Test**: сценарии E12–E13 — PASS

### Tests for User Story 4 ⚠️

- [ ] T040 [P] [US4] Сценарий E12 в `tests/e2e/scenarios/us4.js` (`mode=ultra&storage=session&clock=manual&gravity=off`): старт, `advance(5000)`, `Space`, `KeyP`, `click("#menu-button")` → `data-screen="start"`, выбрана «Ультра», `#screen-over` не показывался, ключа `tetris.record.ultra` нет (US4 AS3; FR-016)
- [ ] T041 [P] [US4] Сценарий E13 в `tests/e2e/scenarios/us4.js` (`mode=sprint&seed=5&storage=session&clock=manual&gravity=off`): довести до `topOut` (`Space`); сразу `click("#again-button")` и `click("#modes-button")` → остаётся `over`; `advance(700)` → `#again-button` → `playing`, `#time` «0:00,00», `#lines` «0 из 40»; снова до `over`, `advance(700)`, `#modes-button` → `start`, выбран «Спринт 40» (US4 AS1, AS2, AS4; FR-015)

### Implementation for User Story 4

- [ ] T042 [US4] Кнопки в `index.html`: `#menu-button` «К выбору режима» на экране паузы, `#modes-button` «Выбрать режим» на экране итога рядом с `#again-button`
- [ ] T043 [US4] Обработчики в `src/ui.js`: `#menu-button` — отбросить состояние без логики и рекорда, `start` с тем же `selectedMode`; `#again-button` — новая партия того же режима; `#modes-button` — `start` с режимом последней партии; защита 700 мс по часам UI на обеих кнопках итога (FR-015, FR-016)

**Checkpoint**: E0–E13 — PASS

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T044 [P] Сценарий E14 в `tests/e2e/scenarios/base.js`: для каждого режима — призрак `.cell[data-g]` виден под фигурой; `KeyC` → в `#hold` появилась фигура, `#hold[data-used]`; повторный `KeyC` ничего не меняет; `Space` → `data-used` снят (FR-027, B4)
- [ ] T045 Прогон всех сценариев: MCP встроенного браузера `preview_start` `name: "tetris"` → `/tests/e2e/index.html` → «Запустить все»; итог «15 из 15 PASS», `document.title` `e2e: PASS`; `read_console_messages` без ошибок (quickstart §2)
- [ ] T046 Визуальная самокритика по skill `frontend-design`: скриншоты MCP на 360×740 и десктопе — стартовый экран, колонка трёх режимов, подпись из четырёх событий, экраны итога всех исходов, пауза; исправить `src/styles.css` (SC-006, SC-007)
- [ ] T047 Ручные проверки quickstart §3: настоящие Tab/↑/↓/Enter/Пробел, видимый фокус, `prefers-reduced-motion`, VoiceOver (одна фраза на группу, объявления ультры), реальная ультра 120 с ± 0,1 с, обычный запуск без параметров (SC-001, SC-004, SC-008, FR-024, FR-025)
- [ ] T048 `sh scripts/check.sh` exit 0 (B4; `tests/format.test.js`, `tests/ui-contract.test.js` и все тесты A/B/002 зелёные)
- [ ] T049 Обновить `docs/HANDOFF.md`: что сделано в 001, новый модуль `src/format.js`, параметры URL и событие `tetris:advance` (ссылка на `specs/001-game-modes-ui/contracts/ui-test-hooks.md`), как запускать e2e, что проверено вручную, открытые вопросы (ID фичи в `docs/requirements.md` — только по поручению)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Предусловие**: логика 002 влита (T001) — блокирует всё, кроме T002–T004, T012, T013 (их можно начинать по контракту).
- **Setup (Phase 1)** → **Foundational (Phase 2)** → истории.
- **US1 (Phase 3)** — первая: даёт экраны, цикл и конец партии, на которые опираются остальные.
- **US2 (Phase 4)** зависит от T025–T026 (конец партии, экран итога) и T021 (стартовый экран).
- **US3 (Phase 5)** зависит от T009 (чтение `events`) и T025 (финальная подпись); от US2 не зависит.
- **US4 (Phase 6)** зависит от T026 (экран итога) и T024 (пауза); от US2/US3 не зависит.
- **Polish (Phase 7)** — после всех нужных историй.

### User Story Dependencies

- US1 (P1): после Phase 2 — независима.
- US2 (P1): после US1 (экраны начала и итога).
- US3 (P2): после Phase 2 и T025 из US1; параллельно с US2 и US4.
- US4 (P3): после T024 и T026 из US1; параллельно с US2 и US3.

### Within Each User Story

- Сценарии e2e истории → запустить, FAIL → разметка `index.html` → `src/ui.js` → `src/styles.css` → сценарии PASS.
- `src/format.js`: T004 (FAIL) → T005 (PASS).
- Задачи в одном файле (`src/ui.js`, `index.html`, `scenarios/us1.js`) выполняются по порядку ID.

### Parallel Opportunities

- Phase 1: T002 и T003.
- Phase 2: T004, T006, T012, T013 — разные файлы; T007–T011 — последовательно (один `src/ui.js`).
- Сценарии разных историй (`us2.js`, `us3.js`, `us4.js`) — параллельно друг с другом.
- Стили истории ([P] в `src/styles.css`) — параллельно с `src/ui.js` той же истории, но не с другими задачами стилей.

---

## Parallel Example: User Story 1

```text
# После Phase 2, параллельно:
Task: "T027 [P] [US1] Стили списка режимов, #time-stat, экрана итога в src/styles.css"
Task: "T015–T019 [US1] Сценарии E1–E5 в tests/e2e/scenarios/us1.js"   # один файл — по порядку
# Затем по порядку в src/ui.js: T021 → T022 → T023 → T024 → T025 → T026
```

## Parallel Example: истории после US1

```text
Task: "T028–T030 [US2] Сценарии E6–E8 в tests/e2e/scenarios/us2.js"
Task: "T034–T036 [US3] Сценарии E9–E11 в tests/e2e/scenarios/us3.js"
Task: "T040–T041 [US4] Сценарии E12–E13 в tests/e2e/scenarios/us4.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 — убедиться, что логика 002 на месте.
2. Phase 1–2: план дизайна, раннер, `src/format.js` (TDD), хуки детерминизма, новый цикл кадра, харнесс, планировщик, E0.
3. Phase 3: E1–E5 (FAIL) → реализация → E0–E5 PASS.
4. **STOP and VALIDATE**: три режима играются до своего итога; `sh scripts/check.sh` exit 0.

### Incremental Delivery

1. MVP (US1) → показать.
2. US2 — рекорды по режимам → E6–E8.
3. US3 — подписи → E9–E11.
4. US4 — повтор и смена режима → E12–E13.
5. Polish → E14, полный прогон, скриншоты, ручные проверки, HANDOFF.

### Parallel Team Strategy

Один `src/ui.js` — узкое место: реализацию историй в нём ведёт один исполнитель последовательно; параллельно другие пишут сценарии e2e (`scenarios/us*.js`), планировщик и стили.

---

## Notes

- Всего 49 задач; каждая — с путём к файлу.
- `src/game.js`, `src/record.js`, `docs/requirements.md`, `scripts/check.sh`, `.claude/`, `AGENTS.md`, `package.json` не меняются; без `git commit`.
- Ожидаемые значения в тестах и сценариях — литералы (seed, время, тексты), а не вычисления тем же кодом UI; планировщик даёт только ходы и события логики.
- Если сценарий падает — чинится код UI, а не сценарий (конституция II).
