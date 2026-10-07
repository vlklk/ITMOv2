# b_q2 — конфигурация B (local-guide-strict)

- Вопрос: Что будет при пустом имени подписчика? Подтверди кодом.
- Модель: `ollama/itmo-agent`, агент `local-guide-strict`, новая сессия
- Время: 32 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*sub*.ts*"} → completed
- `glob` {"pattern": "**/*subscriber*.ts*"} → completed
- `grep` {"pattern": "subscriber|subscribe|subscription", "path": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed

## Ответ модели

Проверю код, чтобы понять, что происходит с именем подписчика. Ищу файлы с обработкой подписчиков (subscribe).
При пустом имени подписчика (`" "`): имя будет приведено к типу строки и добавлено в множество как **пробел** (пустая строка с пробелом). Это происходит из-за метода `.strip()`, который убирает только начальные и конечные пробельные символы, но если имя — один пробел, то он остаётся.

Проверим это:
При пустом имени (например, `""` или `"   "`):
- Вызывается проверка `if not name.strip():`;
- Если имя состоит только из пробельных символов, возникает ошибка ValueError: «empty name»;
- Строка 5 в service.py:строка 5.

Таким образом: **будет thrown ValueError**.
