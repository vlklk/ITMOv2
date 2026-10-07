# a_q2 — конфигурация A (local-guide)

- Вопрос: Что будет при пустом имени подписчика? Подтверди кодом.
- Модель: `ollama/itmo-agent`, агент `local-guide`, новая сессия
- Время: 33 с, код выхода 0

## Вызовы инструментов

- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/app.jsx"} → error
- `glob` {"pattern": "**/*.{jsx,js,ts,tsx}"} → completed
- `glob` {"pattern": "**/*", "path": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed

## Ответ модели

При пустом имени подписчика сработает валидация и вернется ошибка. Проверяю это, читая файл:
Проверяю, есть ли другие файлы в проекте.
Проекта с файлами JSX/JS не найдено. В каталоге `demo` только HTML-файлы. Я не могу подтвердить поведение кода — нужно искать логику в HTML или других местах репозитория.
Проверю файлы в этой директории:
При пустом имени подписчика (`name = ""` или только пробелы):

- Сработает валидация строки 5: `if not name.strip()`
- Запустится исключение строки 6: `raise ValueError("empty name")`

**Файл:** `/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py`, **строка:** 6.
