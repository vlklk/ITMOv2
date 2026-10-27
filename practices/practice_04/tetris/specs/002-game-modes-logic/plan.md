# Implementation Plan: Режимы игры и события для подписей — логика

**Branch**: `002-game-modes-logic` (рабочая ветка репозитория — `practice_5`) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-game-modes-logic/spec.md`; контракт с UI — [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) v1.0, §2.

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

В логику игры добавляются три режима (`marathon`, `sprint`, `ultra`), игровое время, исходы партии, бонусы за комбо и «Подряд», события для всплывающих подписей и рекорды по режимам. Подход — расширить существующие чистые модули, не меняя их прежнего поведения:

- `src/game.js`: константа `MODES`; `createGame(seed, modeId = "marathon")` с новыми полями состояния; новая функция `advanceTime(state, deltaMs)`; расширенная внутренняя фиксация фигуры (`lockPiece`) — комбо, «Подряд», бонусы, `levelUp`, финиш спринта, исход и результат; правило «каждый новый объект несёт только свои `events`, неизменённый — тот же объект».
- `src/record.js`: `readModeRecord(storage, modeId)` и `saveModeRecord(storage, modeId, result)` с ключами по режимам и итогом `{record, previous, isNew}`; `readRecord`/`saveRecord` не меняются.
- Тесты пишутся первыми (TDD), по одному поведению, с ID `LG FR-0xx` в имени и ручными литералами; отдельный `tests/contract.test.js` проверяет форму API из контракта §2.
- `src/ui.js`, `index.html`, `src/styles.css` в этой фиче не меняются: подключение `advanceTime`, `MODES`, событий и рекордов — задачи фичи UI (`specs/001-game-modes-ui`).

## Technical Context

**Language/Version**: JavaScript, ES-модули (ES2022); Node.js v25 для тестов (`"type": "module"`), современный браузер для игры.

**Primary Dependencies**: нет (принцип IV); только встроенные `node:test` и `node:assert/strict`.

**Storage**: Web Storage (`localStorage`) через `src/record.js`, хранилище передаётся параметром; ключи `tetris.record`, `tetris.record.sprint`, `tetris.record.ultra` (контракт §2.6).

**Testing**: `sh scripts/check.sh` → `node --test --test-reporter=dot tests/*.test.js`; сейчас 65 тестов, exit 0. Хранилище в тестах подменяется объектом `getItem`/`setItem`, в том числе бросающим.

**Target Platform**: браузер (статический сервер `python3 -m http.server 5173`) и Node.js для unit-тестов.

**Project Type**: одностраничная браузерная игра (single project): `src/`, `tests/` в корне `practices/practice_04/tetris/`.

**Performance Goals**: фиксация фигуры и `advanceTime` — O(размер поля 10×20) на вызов; не влияют на 60 кадров/с.

**Constraints**: чистые функции без часов, DOM и `Math.random` в `src/game.js`; сбои хранилища не выбрасываются; существующие 65 тестов A/B не меняются и проходят (B4); `docs/requirements.md`, `scripts/check.sh`, `.claude/`, `AGENTS.md` не меняются.

**Scale/Scope**: 3 режима, 6 типов событий, 4 исхода, 3 ключа хранения; изменяются 2 модуля, добавляются 5 файлов тестов.

Неизвестных (NEEDS CLARIFICATION) нет: все решения приняты в контракте v1.0 и в [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Конституция `.specify/memory/constitution.md` v1.0.0.

| Принцип / правило | Как план его соблюдает | До Phase 0 | После Phase 1 |
|---|---|---|---|
| **I. Чистая логика и слои** | Все правила — в `src/game.js` чистыми функциями; время приходит параметром `deltaMs` в `advanceTime`, часов в логике нет; seed — единственный источник случайности. Хранилище — только в `src/record.js` (параметр `storage`, сбои → `null`/прежний рекорд). `src/record.js` импортирует из `src/game.js` только неизменяемую `MODES` — без побочных эффектов. DOM и таймеры не затрагиваются | PASS | PASS |
| **II. TDD, тесты публичных функций** (NON-NEGOTIABLE) | В `tasks.md` каждая задача кода идёт после задачи падающего теста; тесты бьют по экспортам (`createGame`, `advanceTime`, `tick`, `softDrop`, `hardDrop`, `hold`, `moveLeft`/`moveRight`/`rotate`, `MODES`, `readModeRecord`, `saveModeRecord`); ожидания — ручные литералы; одно поведение на тест; имя начинается с ID (`LG FR-011: …`); рекорды — с подменой хранилища, включая бросающее. Бонусы проверяются через фиксацию, без новых вспомогательных экспортов | PASS | PASS |
| **III. Контракт требований с ID** | ID требований — `LG FR-0xx` (так их называет контракт); существующие тесты A/B не меняются, B4 — `sh scripts/check.sh`. `docs/requirements.md` не меняется; перенос фичи в него — только по явному поручению. Решения сверх спецификации (R3, R8, R12, R15 из research) записываются в `docs/HANDOFF.md` в финальной фазе | PASS | PASS |
| **IV. Без зависимостей и сборки** | Новых зависимостей, сборщиков, CDN нет; `package.json` не меняется | PASS | PASS |
| **V. Дизайн-токены и доступный интерфейс** | Интерфейс в этой фиче не меняется — не применяется (зона `specs/001-game-modes-ui`) | N/A | N/A |
| **Ворота качества** | `sh scripts/check.sh` → exit 0 после каждой задачи (хук `check-after-edit`); `scripts/check.sh` не ослабляется; перед кодом читается `docs/style-guide.md`; без `git commit` без поручения | PASS | PASS |

**Итог**: нарушений нет, раздел Complexity Tracking не нужен.

Повторная проверка после Phase 1 (data-model, contracts, quickstart): дизайн добавляет только поля состояния и две функции рекорда; в модели данных нет ссылок на часы и DOM; контракт хранится ссылкой, а не копией — источник истины один. Нарушений не появилось.

## Project Structure

### Documentation (this feature)

```text
specs/002-game-modes-logic/
├── spec.md              # спецификация (/speckit.specify, приведена к контракту v1.0)
├── plan.md              # этот файл (/speckit.plan)
├── research.md          # Phase 0: решения R1–R16
├── data-model.md        # Phase 1: режим, состояние, событие, исход, рекорд; переходы
├── quickstart.md        # Phase 1: как проверить фичу
├── contracts/
│   └── README.md        # ссылка на specs/shared/game-modes-contract.md §2 (не копия)
├── checklists/
│   └── requirements.md  # чек-лист качества спецификации
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root: `practices/practice_04/tetris/`)

```text
src/
├── game.js          # ИЗМЕНЯЕТСЯ: MODES, createGame(seed, modeId), advanceTime, lockPiece (комбо, «Подряд», события, исходы), правило events/того же объекта
├── record.js        # ИЗМЕНЯЕТСЯ: readModeRecord, saveModeRecord, ключи по режимам; readRecord/saveRecord без изменений
├── ui.js            # не меняется в этой фиче (интеграция — specs/001-game-modes-ui)
└── styles.css       # не меняется

tests/
├── game.test.js         # без изменений (A1–A6)
├── assist.test.js       # без изменений (B1–B2)
├── record.test.js       # без изменений (B3)
├── smoke.test.js        # без изменений
├── contract.test.js     # НОВЫЙ: форма API из контракта §2
├── modes.test.js        # НОВЫЙ: режимы, время, исходы, результат (LG FR-001…016)
├── scoring.test.js      # НОВЫЙ: комбо и «Подряд» (LG FR-020…024)
├── events.test.js       # НОВЫЙ: события и правило объекта (LG FR-040…043, FR-050)
└── mode-record.test.js  # НОВЫЙ: рекорды по режимам (LG FR-030…035)
```

**Structure Decision**: один проект без подкаталогов, как сейчас: логика и рекорд остаются в двух существующих модулях `src/game.js` и `src/record.js` (style guide п. 1), новые тесты — отдельными файлами в `tests/`, чтобы не трогать тесты A/B и чтобы `scripts/check.sh` (`tests/*.test.js`) подхватил их без изменений.

## Ключевые решения дизайна (кратко; подробно — [research.md](research.md))

1. **Время** — только `advanceTime(state, deltaMs)`; `elapsedMs` дробное, `result` спринта = `Math.round(elapsedMs)` на финише (R1, R6).
2. **Сброс `events`** — одна внутренняя функция «новое состояние» ставит `events: []`, если вызов не принёс событий; все ветки, возвращающие неизменённое состояние, возвращают вход (R2).
3. **Защита после конца** — по полю `over`, как сейчас, поэтому тесты A6/B2, которые выставляют `over: true` напрямую, продолжают работать (R3).
4. **Порядок шагов фиксации** — запись фигуры → очистка строк → очки по уровню до фиксации → `combo`/`backToBack` → бонусы → `lines`/`level` → события → финиш спринта (важнее переполнения) → появление следующей фигуры и `topOut` → `result` (R4).
5. **Ультра** — `advanceTime` обрезает время до 120 000, ставит `timeUp`, `result = score`, `events = [timeUp]`; фигура не фиксируется (R5).
6. **Рекорды** — `src/record.js` берёт направление сравнения из `MODES[i].better`; неизвестный режим → `RangeError` до обращения к хранилищу (R7, R15).

## Complexity Tracking

Нарушений Constitution Check нет — раздел не заполняется.
