# Data Model: Режимы игры и события для подписей — логика

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

Типы и единицы полей, видимых UI, определены в контракте [`specs/shared/game-modes-contract.md`](../shared/game-modes-contract.md) §2.2–2.6 и здесь не переопределяются. Этот документ добавляет то, что нужно для реализации и тестов: правила валидации, связи сущностей и переходы состояния партии.

## 1. Режим (`MODES[i]`)

| Поле | Значения | Правило |
|---|---|---|
| `id` | `"marathon"` \| `"sprint"` \| `"ultra"` | уникален; порядок в `MODES` — именно такой (FR-044) |
| `goalLines` | `40` у `sprint`, иначе `null` | — |
| `timeLimitMs` | `120000` у `ultra`, иначе `null` | — |
| `resultKind` | `"score"` (`marathon`, `ultra`) \| `"time"` (`sprint`) | — |
| `better` | `"higher"` (`marathon`, `ultra`) \| `"lower"` (`sprint`) | направление сравнения рекорда (FR-032) |

- `MODES` и каждый элемент заморожены (R10).
- Поиск режима по id: неизвестный id → `RangeError` (FR-003).

## 2. Партия (состояние игры)

Существующие поля (`board`, `active`, `next`, `bag`, `rng`, `score`, `lines`, `level`, `over`, `hold`, `holdUsed`) сохраняют смысл. Новые поля и их начальные значения в `createGame(seed, modeId)`:

| Поле | Начало | Валидация / инвариант |
|---|---|---|
| `mode` | `modeId` (по умолчанию `"marathon"`) | один из `MODES[i].id`; не меняется |
| `elapsedMs` | `0` | число ≥ 0, может быть дробным; меняется только в `advanceTime`; в `ultra` ≤ 120 000 |
| `remainingMs` | `120000` в `ultra`, иначе `null` | `ultra`: `max(0, 120000 − elapsedMs)` |
| `linesToGoal` | `40` в `sprint`, иначе `null` | `sprint`: `max(0, 40 − lines)` |
| `outcome` | `"playing"` | `"playing"` \| `"topOut"` \| `"sprintFinish"` \| `"timeUp"`; меняется один раз |
| `over` | `false` | `over === (outcome !== "playing")` |
| `result` | `null` | `null`, пока `outcome === "playing"`; после конца — по таблице §4 |
| `combo` | `0` | целое ≥ 0 |
| `backToBack` | `false` | логическое |
| `events` | `[]` | только события последнего вызова, в порядке §3 |

**Правило объекта** (контракт §2.2): вызов без изменений возвращает вход (`===`); любой новый объект содержит свои `events` или `[]` (R2).

## 3. Событие

`{ type, bonus, ...параметры }`; `bonus` — целое ≥ 0, есть всегда.

| `type` | Параметры | `bonus` | Источник |
|---|---|---|---|
| `tetris` | — | `0` | фиксация, `cleared === 4` |
| `backToBack` | — | `400 × level до фиксации` | фиксация, `cleared === 4 && backToBack до фиксации` |
| `combo` | `n` = `combo после фиксации` (≥ 2) | `50 × (n − 1) × level до фиксации` | фиксация со строками при `combo после ≥ 2` |
| `levelUp` | `level` = новый уровень | `0` | фиксация, `levelForLines(lines после) > level до` |
| `sprintFinish` | `timeMs` = `Math.round(elapsedMs)` | `0` | фиксация в `sprint`, `lines после ≥ 40` |
| `timeUp` | `score` = итоговые очки | `0` | `advanceTime` в `ultra`, `elapsedMs` достиг 120 000 |

Порядок в одном `events`: `tetris`, `backToBack`, `combo`, `levelUp`, затем не больше одного из `sprintFinish` / `timeUp` — последним. Сумма `bonus` = прибавка `score` сверх очков за строки (A4) и спуск (A3).

## 4. Исход и результат

| `outcome` | Режим | Условие | `result` |
|---|---|---|---|
| `playing` | все | партия идёт | `null` |
| `topOut` | все | следующая фигура не помещается в точку появления (A6) | `marathon`, `ultra` — `score`; `sprint` — `null` |
| `sprintFinish` | `sprint` | после фиксации `lines ≥ 40` (важнее `topOut` той же фиксации) | `Math.round(elapsedMs)` |
| `timeUp` | `ultra` | `elapsedMs` достиг 120 000 | `score` |

## 5. Переходы состояния партии

```text
                    createGame(seed, modeId)
                             │
                             ▼
                      ┌─────────────┐  moveLeft/moveRight/rotate/hold, tick/softDrop без фиксации,
                      │   playing   │  фиксация без конца партии, advanceTime без конца времени
                      └─────────────┘  → снова playing (новый объект или тот же)
          фиксация:      │      │      │
   lines ≥ 40 в sprint   │      │      │ advanceTime: elapsedMs = 120000 в ultra
          ▼              │      │      ▼
   ┌──────────────┐      │      │   ┌─────────┐
   │ sprintFinish │      │      │   │ timeUp  │
   └──────────────┘      │      │   └─────────┘
                         ▼      
            фиксация: следующей фигуре негде появиться
                    ┌─────────┐
                    │ topOut  │
                    └─────────┘
   Из sprintFinish, timeUp, topOut любой вызов возвращает тот же объект.
```

Переходы `combo` / `backToBack` на каждой фиксации:

| Фиксация | `combo` | `backToBack` |
|---|---|---|
| 0 строк | `0` | без изменений |
| 1–3 строки | `combo + 1` | `false` |
| 4 строки | `combo + 1` | `true` |
| hold, сдвиг, поворот, шаг без фиксации, `advanceTime` | без изменений | без изменений |

## 6. Рекорд режима и итог сохранения (`src/record.js`)

| Сущность | Значение | Правило |
|---|---|---|
| Ключ хранения | `marathon` → `tetris.record`; `sprint` → `tetris.record.sprint`; `ultra` → `tetris.record.ultra` | миграции нет (FR-031) |
| Рекорд (`readModeRecord`) | `null` \| `0` \| целое > 0 | `null` — хранилища нет или чтение бросает; `0` — нет рекорда или значение испорчено (не число, не целое, ≤ 0) |
| Итог (`saveModeRecord`) | `null` \| `{ record, previous, isNew }` | `null` — хранилище недоступно для чтения; `previous` — рекорд до сохранения (`0` — не было); `isNew` — записан новый рекорд |

Сравнение: результат — новый рекорд, если он целое > 0 и (`previous === 0` или строго лучше `previous` по `better`). При сбое записи — `record = previous`, `isNew = false`. Неизвестный `modeId` → `RangeError` (FR-003, R15).

Связи: `Партия.mode` → `Режим.id`; `Партия.result` + `Партия.mode` → вход `saveModeRecord`; `Режим.better` → правило сравнения рекорда.
