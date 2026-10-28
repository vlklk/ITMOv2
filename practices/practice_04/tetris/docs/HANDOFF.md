# Handoff: состояние проекта

## Сделано

- **Фича A** (коммит `fcdf6e7`): играбельный тетрис — логика в `src/game.js` (A1–A6, 38 тестов в `tests/game.test.js`), интерфейс «тетрадь в клетку» (`index.html`, `src/ui.js`, `src/styles.css`, план — `docs/design-plan.md`).
- **Фича B** (коммит `5cd7ad3`, сделана в отдельном worktree и влита `--ff-only`): призрачная фигура и hold в `src/game.js` (`tests/assist.test.js`), рекорд в `localStorage` через `src/record.js` (`tests/record.test.js`).
- По итогам независимого review фичи B исправлен `saveRecord` и закреплён отдельный модуль рекорда в `docs/style-guide.md` и `AGENTS.md`.
- **Фича C, логика** (`specs/002-game-modes-logic`, без коммита): режимы `marathon` / `sprint` / `ultra` и игровое время, исходы и результат, бонусы комбо и «Подряд», события для подписей, рекорды по режимам — по контракту `specs/shared/game-modes-contract.md` §2.
  - `src/game.js`: константа `MODES`; `createGame(seed, modeId = "marathon")` с полями `mode`, `elapsedMs`, `remainingMs`, `linesToGoal`, `outcome`, `result`, `combo`, `backToBack`, `events`; новая `advanceTime(state, deltaMs)`; фиксация считает бонусы, события, финиш спринта и `topOut`; каждый новый объект несёт только свои `events`, вызов без изменений возвращает тот же объект.
  - `src/record.js`: `readModeRecord(storage, modeId)` и `saveModeRecord(storage, modeId, result)` → `{record, previous, isNew}`; ключи `tetris.record` (марафон, прежний), `tetris.record.sprint`, `tetris.record.ultra`; `readRecord`/`saveRecord` не менялись.
  - Тесты: 121 новый в `tests/contract.test.js`, `tests/modes.test.js`, `tests/scoring.test.js`, `tests/events.test.js`, `tests/mode-record.test.js` (заготовки — `tests/support.js`); 65 прежних не менялись.
  - Интерфейс (`src/ui.js`, `index.html`, `src/styles.css`) не менялся: выбор режима, таймер, подписи и рекорды по режимам подключает фича UI (`specs/001-game-modes-ui`). До этого игра в браузере работает как прежний «Марафон».

## Как проверить

- `sh scripts/check.sh` — 186 тестов (65 фич A/B + 121 фичи C, логика), ожидается exit 0.
- Вид: `python3 -m http.server 5173` в корне проекта → `http://localhost:5173/`, консоль без ошибок.

## Источники

- Требования: `docs/requirements.md`. Правила: `AGENTS.md`, `docs/style-guide.md`.
- Подтверждения работы агентов: `../evidence/tetris/` (отчёты исполнителей, журналы хука, review, скриншоты).

## Ограничения и открытые вопросы

- Решения сверх спецификации, которые стоит подтвердить: I появляется во второй строке; при переходе на новый уровень очки за строки считаются по старому уровню; мягкий спуск фигуры на опоре сразу фиксирует её; hold отменяется, если выходящей фигуре некуда встать; надпись «Это новый рекорд.» не показывается в первой партии.
- Решения фичи C (логика) сверх спецификации, которые стоит подтвердить (`specs/002-game-modes-logic/research.md`):
  - R3: «партия окончена» по-прежнему проверяется по полю `over`, а не по `outcome` — тесты A6/B2 выставляют `over: true` напрямую; инвариант `over === (outcome !== "playing")` держит логика.
  - R8: расчёт бонусов не экспортируется отдельными функциями; бонусы проверяются через фиксацию.
  - R12: логика не ограничивает `deltaMs` сверху (1000 мс — гарантия интерфейса по контракту §2.3); отбрасываются только `deltaMs ≤ 0`, нечисловые и бесконечные значения.
  - R13: при финише спринта следующая фигура всё равно выставляется в точку появления, даже если пересекает занятые клетки.
  - R15: `saveModeRecord` с результатом, который не является целым > 0 (0, `null`, дробь), ничего не пишет и возвращает `{record: previous, previous, isNew: false}` без исключения.
- Характеризующие тесты фичи C (зелёные сразу, т. к. закрепляют уже существующее поведение, находка L1): правило «тот же объект» для `moveLeft` у стены (`tests/contract.test.js`), призрак и hold в `sprint`/`ultra` и уровень по A5 в `sprint`/`ultra` (`tests/modes.test.js`, LG FR-004, FR-006), детерминизм LG FR-050 (`tests/events.test.js`).
- Вживую не проверены: `prefers-reduced-motion`, недоступный `localStorage` в реальном браузере, реальные касания.
- Анимации очистки строк нет. Шрифты грузятся из Google Fonts; без сети — системные запасные.
- Возможное следующее поручение: анимация очистки строк с учётом `prefers-reduced-motion` (через TDD — только логика; вид — через MCP браузера).
