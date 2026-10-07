# a_q1_r3

- Вопрос: Как запустить тесты? Укажи файл-источник.
- Модель: `ollama/itmo-agent`, агент `local-guide`, новая сессия
- Время: 20 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*.{py,js,ts,go}"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py"} → completed

## Ответ модели

Чтобы запустить тесты, используйте команду в папке `/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo`:

```bash
python test_service.py
```

Файл-источник тестов: [`test_service.py`](file:///Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py) (строка 1-25).
