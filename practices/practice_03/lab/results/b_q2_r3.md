# b_q2_r3

- Вопрос: Что будет при пустом имени подписчика? Подтверди кодом.
- Модель: `ollama/itmo-agent`, агент `local-guide-strict`, новая сессия
- Время: 29 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "**/*.{py,js,ts,java,cpp}"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/test_service.py"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/service.py"} → completed

## Ответ модели

Я проверю поведение приложения при пустом имени подписчика, исследуя код в репозитории.
Получила результат. Теперь прочитаю оба файла, чтобы понять логику и проверить обработку пустых значений имен подписчиков.
При вызове `subscribe()` с пустым именем подписчика **бросается исключение ValueError** (сообщение «empty name»).

**Подтверждение кодом:**

*   **service.py:5-6**: Проверяет, является ли имя пустым после удаления пробелов (`if not name.strip()`), и если да — выполняет `raise ValueError("empty name")`.
*   **test_service.py:13-15**: Тест проверяет, что при вызове `subscribe(" ")` (пробель между символами) действительно выбрасывается `ValueError`.
