# Data Model: Режимы игры и всплывающие подписи — интерфейс

Phase 1 для [plan.md](plan.md). Состояние партии, события, исходы и рекорды принадлежат логике и описаны в контракте [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) §2.2–2.6 — здесь не повторяются. Ниже — только то, что хранит и показывает интерфейс (`src/ui.js`).

## 1. Экран (`screen`)

Значение отражается в `document.documentElement.dataset.screen`.

| Значение | Что видно | Ввод |
|---|---|---|
| `start` | стартовый экран: список режимов, рекорды, «Начать игру» | ↑/↓ — выбор режима; клик по режиму; «Начать игру» |
| `playing` | поле, колонка по режиму, подписи | игровые клавиши и кнопки касаний; P/Esc — пауза |
| `paused` | экран «Пауза», время режима, «Продолжить», «К выбору режима» | P/Esc — продолжить; кнопки |
| `finishing` | финальная подпись «Финиш!» / «Время вышло», ~1 с | игнорируется |
| `over` | экран итога по исходу; «Играть снова», «Выбрать режим» | кнопки (защита 0,7 с) |

**Переходы**

```text
start ──«Начать игру»──▶ playing
playing ──P/Esc, кнопка ǁ, blur, visibilitychange(hidden)──▶ paused
paused ──P/Esc, «Продолжить»──▶ playing          (первая дельта после продолжения не передаётся)
paused ──«К выбору режима»──▶ start               (состояние партии отбрасывается, рекорд не пишется)
playing ──over && outcome ∈ {sprintFinish, timeUp}──▶ finishing ──~1000 мс──▶ over
playing ──over && outcome = topOut──▶ over
over ──«Играть снова» (≥ 700 мс)──▶ playing        (тот же режим)
over ──«Выбрать режим» (≥ 700 мс)──▶ start          (выбран режим последней партии)
```

Правила: игровые функции логики вызываются только в `playing`; `advanceTime` — только в `playing`, `0 < deltaMs ≤ 1000`; при `over` — один `saveModeRecord`, если `result !== null` (контракт §2.3, шаги 3–7).

## 2. Состояние интерфейса

| Поле | Тип | Правило |
|---|---|---|
| `selectedMode` | id из `MODES` | при загрузке — `mode` из URL, если это id из `MODES`, иначе `"marathon"`; после партии — режим этой партии; не переживает перезагрузку (FR-002) |
| `state` | состояние логики | создаётся только `createGame(seed, selectedMode)` |
| `screen` | см. §1 | |
| `records` | `{ [id]: null \| 0 \| целое > 0 }` | из `readModeRecord` при показе стартового экрана и после сохранения |
| `lastSave` | `null \| { record, previous, isNew }` | ответ `saveModeRecord` последней партии; пометка — `isNew && previous > 0` |
| `caption` | `null \| { lines: string[], final: boolean, hideAt: мс }` | см. §3 |
| `announced` | множество порогов `60000`, `30000`, `10000` | уже объявленные пороги ультры в этой партии |
| `finishedAt` | мс часов UI | время перехода в `finishing`/`over`; защита кнопок 700 мс |
| `resumeSkip` | boolean | `true` после продолжения — первая дельта кадра отбрасывается |

## 3. Подпись (`caption`)

Строится только из `events` нового объекта состояния (контракт §2.2, правило объекта).

| Событие | Строка | Бонус |
|---|---|---|
| `tetris` | «Тетрис!» | — |
| `backToBack` | «Подряд» | «+N», если `bonus > 0` |
| `combo` (`n`) | «Комбо ×n» | «+N», если `bonus > 0` |
| `levelUp` (`level`) | «Уровень level» | — |
| `sprintFinish` | «Финиш!» | — |
| `timeUp` | «Время вышло» | — |

Правила валидации:
- порядок строк = порядок `events` (контракт §2.4: `tetris`, `backToBack`, `combo`, `levelUp`, финальное — последним);
- есть финальное событие → `lines` = только его строка, `final = true`;
- пустые `events` → подпись не меняется;
- новая группа заменяет текущую; `hideAt = now + 1500` (обычная), финальная скрывается при переходе в `over`;
- на `paused` и `over` подпись скрыта и не восстанавливается;
- текст группы одной строкой уходит в `#announcer` (`aria-live="polite"`).

## 4. Значения колонки по режиму

| Режим | Значения (id элементов) |
|---|---|
| `marathon` | `#score`, `#level`, `#lines`, `#record` |
| `sprint` | `#time` = `formatSprintTime(over ? result : elapsedMs)`, `#lines` = «min(lines, 40) из 40», `#score`, `#record` = `formatSprintTime(record)` |
| `ultra` | `#time` = `formatUltraTime(remainingMs)` (+ `data-urgent` при `remainingMs < 10000`), `#score`, `#lines`, `#record` |

`#record-stat` скрыт при `records[mode] === null`; при `0` — «нет».

## 5. Форматы (`src/format.js`)

| Функция | Вход | Выход (примеры-литералы) |
|---|---|---|
| `formatSprintTime(ms)` | целое или дробное ≥ 0 | `0` → «0:00,00»; `1234.9` → «0:01,23»; `98020` → «1:38,02»; `724550` → «12:04,55»; `3724550` → «1:02:04,55» |
| `formatUltraTime(ms)` | ≥ 0 | `120000` → «2:00»; `60001` → «1:01»; `10000` → «0:10»; `9401` → «0:09,5»; `1` → «0:00,1»; `0` → «0:00» |
| `formatScore(n)` | целое ≥ 0 | `12400` → «12 400» (неразрывный пробел `ru-RU`) |

## 6. Параметры проверок (URL)

Полностью — [contracts/ui-test-hooks.md](contracts/ui-test-hooks.md). Валидация: `seed` — целое по `/^-?\d+$/`; `mode` — id из `MODES`; `clock` — только `manual`; `gravity` — только `off`; `storage` — `session` | `off` | `readonly`. Всё прочее игнорируется.

## 7. Сущности сквозных проверок (`tests/e2e/`)

| Сущность | Поля |
|---|---|
| Сценарий | `id` (`E0`…`E14`), `title`, `refs` (ID требований), `params` (строка URL), `run(h)` — асинхронная функция над харнессом |
| Результат | `id`, `status` (`PASS` / `FAIL`), `details` (первое несовпадение: ожидали / получили), `errors` (ошибки страницы iframe) |
| План (`planner.js`) | `seed`, `mode`, `moves[]` (`keys[]`, `events[]`, `linesAfter`), `pieces` |
