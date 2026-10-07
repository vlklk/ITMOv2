# c_q5 — конфигурация C (local-guide-strict + thinking)

- Вопрос: Сохраняются ли подписки после перезапуска процесса? Подтверди кодом.
- Модель: `ollama/itmo-agent-think`, агент `local-guide-strict`, новая сессия
- Время: 20 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*.{py,js}"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed

## Ответ модели

Нет, подписки **не сохраняются** после перезапуска процесса (перезапуска Python-интерпретатора), так как переменные состояния `subscribers` объявляются заново при каждом запуске.

Подтверждаю: файл `/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py`:строка 1 показывает, что `subscribers = set()` создаётся каждый раз при загрузке скрипта.
