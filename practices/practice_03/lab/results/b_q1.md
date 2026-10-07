# b_q1 — конфигурация B (local-guide-strict)

- Вопрос: Как запустить тесты? Укажи файл-источник.
- Модель: `ollama/itmo-agent`, агент `local-guide-strict`, новая сессия
- Время: 21 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*"} → completed
- `grep` {"pattern": "test|spec", "include": "*.{json,js,md}"} → completed

## Ответ модели

Чтобы ответить на этот вопрос, нужно проверить наличие файлов для запуска тестов (например, package.json с скриптами или Makefile).
Файл-источник для запуска тестов — [Makefile](file:///Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/Makefile).  
В файле `Makefile` есть команда `test`.

Также в [README.md](file:///Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/README.md) указано, что проверки выполняются через команду `make test`.
