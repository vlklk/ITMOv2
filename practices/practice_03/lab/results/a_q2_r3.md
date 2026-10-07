# a_q2_r3

- Вопрос: Что будет при пустом имени подписчика? Подтверди кодом.
- Модель: `ollama/itmo-agent`, агент `local-guide`, новая сессия
- Время: 35 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*{User,Subscribe,*}.ts*"} → completed
- `glob` {"pattern": "**/*"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py"} → completed

## Ответ модели

Файл не найден. Я проведу поиск в текущей директории `/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo` и её подпапках, чтобы найти файлы, связанные с подписчиками (например, `subscribe`, `user` или `Subscriber`).
Изучу содержимое всех файлов в демо-папке.
При пустом имени подписчика (`""` или `" "`) происходит:

**Ошибка `ValueError("empty name")`**, как подтверждено кодом в файле [service.py](file:///Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py), строка 6.

**Подтверждение:**
В `[test_service.py](file:///Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py)`, строка 15-16, есть тест, который проверяет, что на пустую строку поднимается `ValueError`.
