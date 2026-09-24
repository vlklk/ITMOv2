# Integration-проверки

Файл ведёт OpenCode. Обсудите с агентом содержание и проверьте предложенный diff. Все дополнения и исправления поручайте агенту в чате.

| Связь компонентов | Что может сломаться | Как воспроизводим | Ожидаемый результат | Подтверждение |
|---|---|---|---|---|
| FastAPI → ReviewService | ReviewService не получает diff или получает невалидный тип | Отправить POST /api/reviews с `{"diff": 123}` (int вместо str) | HTTP 422, ReviewService не вызывается | `app/api.py:36-37` — payload напрямую передаётся в review_service.review() |
| ReviewService → LLM | LLM недоступен или возвращает ошибку | Mock LLM, который бросает исключение при generate() | Контролируемый ответ (не HTTP 500), логируется ошибка (REL-1) | `app/review_service.py:20-21` — нет try/except вокруг llm.generate() |
| ReviewService → LLM (timeout) | LLM отвечает дольше 10 секунд | Mock LLM с задержкой 15 секунд в generate() | Через 10 сек — контролируемый ответ, запрос не зависает | `app/review_service.py:20-21` — нет timeout на вызове LLM |
| ReviewService → SecretFilter → LLM | SecretFilter не очищает diff перед отправкой | Передать diff с `password=supersecret123`, проверить промпт в LLM | В промпте `password=[REDACTED]`, секрет не попадает в LLM (SEC-1) | `app/review_service.py:20` — diff передаётся в промпт как есть |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-03
- Что проверил студент и какие исправления поручил агенту: проверили, что каждая проверка описывает реальную связь компонентов из TRAINING_PR.diff, что воспроизводимость обеспечена через mock, что ожидаемые результаты соответствуют правилам из [`context.md`](context.md) (REL-1, SEC-1)
