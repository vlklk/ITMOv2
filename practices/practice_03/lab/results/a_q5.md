# a_q5 — конфигурация A (local-guide)

- Вопрос: Сохраняются ли подписки после перезапуска процесса? Подтверди кодом.
- Модель: `ollama/itmo-agent`, агент `local-guide`, новая сессия
- Время: 34 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*.js", "path": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo"} → completed
- `glob` {"pattern": "**/**/*.js", "path": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py"} → completed

## Ответ модели

Я ищу код, подтверждающий поведение подписок при перезапуске процесса.
Файлы не найдены. Попробую почитать все доступные файлы в данной директории.
**Нет, подписки НЕ сохраняются после перезапуска процесса.**

Подтверждение (файл `test_service.py`, строка 7):
```python
subscribers.clear()
```

В тестах для каждого `setUp` вызывается очищение множества `subscribers`. Это означает, что при старте процесса (перед тестами) подписки сбрасываются в пустое множество.
