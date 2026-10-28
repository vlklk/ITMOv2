# REPORT_02 — Повторные атаки после исправлений (Mini Shop)

**Практика 6. Моделирование угроз и атаки с помощью LLM**

Стенд: `practices/practice_06/lab/service.py`, запущен командой
`python3 service.py --port 8070` (порт 8070 был свободен), слушает только
`127.0.0.1`. Одноразовый каталог фикстур сессии:
`/private/var/folders/.../itmo-practice-06-6evhredl`. Все данные синтетические
(`TEST_*`, `example.invalid`).

Я независимый проверяющий. Отчёту об исправлениях (`FIXES.md`) не доверял: повторил
**ровно те же 10 атак** из `REPORT_01.md` тем же запросом на живом сервере.
Вход и фактический ответ сохранены в `practices/practice_06/evidence/after/`
теми же именами, что в `evidence/before/`, чтобы пары `before`/`after` сравнивались.

Отличие методики: в REPORT_01 часть атак шла без сессии (эндпоинты её не требовали).
После фикса сессия обязательна, поэтому тот же вредоносный ввод (`id=0 OR 1=1`,
`q=' UNION …`, `user=bob`, forced-JSON) подаётся уже **с токеном alice** — это
усиливает проверку: даже легальный аутентифицированный клиент не может ни
проэксплуатировать инъекцию, ни получить чужие данные. Контрольные запросы без
токена (→ 401) также приведены в каждом файле.

Учебные пользователи: `alice`/`learn-alice` (id 1), `bob`/`learn-bob` (id 2),
`staff`/`learn-staff` (id 0, роль staff). Токен из `POST /login` в `X-Token`.

## Сводная таблица

| № | Атака | Было (before) | Стало (after) | Статус | Файл-доказательство (after) |
|---|---|---|---|---|---|
| 1 | SQLi `GET /profile?id=0 OR 1=1` и UNION | Выгружены все профили + схема и версия СУБД | Только профиль владельца сессии (alice); без токена `401`; UNION не влияет (запрос параметризован) | Заблокировано | `01_sqli_profile.txt`, `01b_sqli_profile_union.txt` |
| 2 | SQLi `GET /search?q=' UNION …` | UNION подмешал ПДн всех (email/address) | UNION-инъекция даёт `[]` (параметризация `LIKE ?`); без токена `401` | Заблокировано | `02_sqli_search.txt` |
| 3 | IDOR без сессии: `/profile?id=2`, `/orders` | Отдавались чужой профиль и вся таблица заказов | Без токена `401`; с токеном alice `/orders` → только её заказы | Заблокировано / ограничено | `03_idor_nosession.txt` |
| 4 | `X-Role: staff` на `GET /admin/export` | Экспорт всех профилей по одному заголовку | `403 staff only` (роль из серверной сессии; заголовок игнорируется) | Заблокировано | `04_priv_header.txt` |
| 5 | Подмена цены `POST /orders price=1` | Заказ создан с `price: 1` | Цена из каталога `5000`, поле `price` из тела игнорируется | Заблокировано | `05_price_tamper.txt` |
| 6 | `/files` `user=bob` и `user=../private` | Чужой чек и служебная заметка `TEST_ONLY_OPERATOR_SECRET` | `user` игнорируется (отдан свой файл); `..`-traversal через `path` → `403 forbidden path`; служебная заметка недоступна | Заблокировано / ограничено | `06_files_traversal.txt` |
| 7 | Stored XSS `POST /reviews` → `/reviews/view` | `<script>`/`<img onerror>` в HTML как есть | Экранировано: `&lt;script&gt;…&lt;img …&gt;` | Заблокировано | `07_stored_xss.txt` |
| 8 | `GET /debug/logs` | Пароли, токены, тела запросов в журнале, без аутентификации | alice/без токена → `403`; staff → только метаданные (`method`/`path`/`status`), секретов нет | Заблокировано / ограничено | `08_debug_logs.txt` |
| 9 | `GET /profile?id=abc` → 500 с текстом SQL | `{"error":"no such column: abc","type":"OperationalError"}` | Точка инъекции устранена: `id` игнорируется, `200` + свой профиль; необработанных исключений наружу нет (обобщённое `internal server error`, см. п.6) | Заблокировано | `09_error_leak.txt` |
| 10 | `POST /assistant/execute` без контроля | Анонимно: `export_profiles`, `read_file` чужого/служебного, `delete_tree` (уничтожил чек bob) | Без токена `401`; `export_profiles` клиенту `403 staff only`; `read_file` чужого/служебного `403 forbidden path`; `delete_tree` убран → `403 tool not allowed`; свой `read_file` работает | Заблокировано / ограничено | `10a_execute_export.txt`, `10b_execute_readfile.txt`, `10c_execute_delete.txt` |

Позитивная проверка легального сценария — `11_positive_flow.txt`.
Prompt injection после фикса — `pi_after.txt`.

**Итог: заблокированы все 10 из 10 атак. Легальная функциональность сохранена.**
`make step6` → 39 тестов OK.

---

## 1. SQLi в `GET /profile` — заблокировано

Before (`before/01_sqli_profile.txt`, `before/01b_sqli_profile_union.txt`):
`id=0 OR 1=1` выгружал оба профиля; UNION читал `sqlite_master` (схема + `3.53.4`).

After (`after/01_sqli_profile.txt`):
```
curl -s -G '.../profile' -H 'X-Token: <alice>' --data-urlencode 'id=0 OR 1=1'
=> [{"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"}]
CONTROL (без токена) => {"error": "login required"}
```
UNION (`after/01b_sqli_profile_union.txt`):
```
curl -s -G '.../profile' -H 'X-Token: <alice>' --data-urlencode 'id=-1 UNION SELECT 99,sqlite_version(),name,sql FROM sqlite_master'
=> [{"id": 1, "name": "TEST_ALICE", ...}]   # возвращён только профиль владельца, схема не утекла
```
Запрос параметризован (`WHERE id = ?`), а `id` берётся из серверной сессии —
клиентский `id`/инъекция игнорируются полностью.

## 2. SQLi в `GET /search` — заблокировано

Before (`before/02_sqli_search.txt`): UNION подмешивал email/address всех профилей.

After (`after/02_sqli_search.txt`):
```
curl -s -G '.../search' -H 'X-Token: <alice>' --data-urlencode "q=' UNION SELECT id,email,address,name FROM profiles-- "
=> []
CONTROL (без токена) => {"error": "login required"}
```
Инъекция обезврежена параметризацией `name LIKE ?`. Пустой `q=` по-прежнему
возвращает список имён профилей (`baseline` в файле) — это задокументированное в
`FIXES.md` проектное решение (общий поиск по имени, не SQLi); посторонние поля
(email/address через UNION) больше не утекают, и без сессии поиск недоступен.

## 3. IDOR без сессии — заблокировано / ограничено

Before (`before/03_idor_nosession.txt`): без токена отдавались профиль bob и вся таблица заказов.

After (`after/03_idor_nosession.txt`):
```
GET /profile?id=2 (без токена) => {"error": "login required"}
GET /orders       (без токена) => {"error": "login required"}
GET /orders       (токен alice) => [{"id": 1, "owner": 1, "product": "chair", "price": 5000.0}]
```
Оба эндпоинта требуют сессию; `/orders` ограничен `WHERE owner = ?` (только заказы alice).

## 4. Повышение привилегий через `X-Role` — заблокировано

Before (`before/04_priv_header.txt`): `X-Role: staff` без логина выгружал всех.

After (`after/04_priv_header.txt`):
```
GET /admin/export -H 'X-Role: staff' (без сессии) => {"error": "staff only"}   # 403
GET /admin/export (staff-сессия)                   => [все профили]            # легально
```
Роль берётся из `session["role"]`, заголовок `X-Role` игнорируется.

## 5. Подмена цены — заблокировано

Before (`before/05_price_tamper.txt`): `{"product":"chair","price":1}` → заказ с `price: 1`.

After (`after/05_price_tamper.txt`):
```
POST /orders {"product":"chair","price":1} (токен alice)
=> {"id": 3, "owner": 1, "product": "chair", "price": 5000}
```
Цена всегда из каталога сервера; поле `price` из тела игнорируется.

## 6. Обход владельца и path traversal в `/files` — заблокировано / ограничено

Before (`before/06_files_traversal.txt`): `user=bob` → чек bob; `user=../private` → `TEST_ONLY_OPERATOR_SECRET`.

After (`after/06_files_traversal.txt`):
```
user=bob & path=receipt.txt (токен alice) => {"content": "TEST_ALICE receipt: chair, 5000 RUB"}  # user проигнорирован, отдан СВОЙ файл
user=../private & path=operator-note.txt   => {"error": "internal server error"}                 # читается files/alice/operator-note.txt (нет файла) — служебная заметка НЕ отдана, текст ошибки не утёк
path=../private/operator-note.txt          => {"error": "forbidden path"}   # 403
path=../bob/receipt.txt                    => {"error": "forbidden path"}   # 403
без токена                                 => {"error": "login required"}
POSITIVE: свой receipt.txt                 => {"content": "TEST_ALICE receipt: chair, 5000 RUB"}
```
Путь строится только от владельца сессии (`files/alice/...`); `user` игнорируется,
а `..`/абсолютные пути отклоняются `_owner_relpath`. Служебная заметка и чужой чек
недоступны.

## 7. Stored XSS — заблокировано

Before (`before/07_stored_xss.txt`): payload возвращался в HTML без экранирования.

After (`after/07_stored_xss.txt`):
```
GET /reviews/view
=> <html><body><p>&lt;script&gt;alert(document.cookie)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</p></body></html>
```
Текст отзыва экранируется `html.escape()` — скрипт не исполнится.

## 8. Утечка журнала `/debug/logs` — заблокировано / ограничено

Before (`before/08_debug_logs.txt`): журнал содержал пароли в открытом виде и токены сессий, без аутентификации.

After (`after/08_debug_logs.txt`):
```
GET /debug/logs (токен alice)  => {"error": "staff only"}   # 403
GET /debug/logs (без токена)   => {"error": "staff only"}   # 403
GET /debug/logs (staff)        => [{"method":"GET","path":"/health","status":200}, ...]  # только метаданные
grep паролей/токенов/тел       => NO secrets/passwords/tokens/bodies found in log
```
Двойная защита: эндпоинт только для staff-сессии, и в журнал пишутся лишь
метаданные (`method`/`path`/`status`) — пароли, токены и тела не сохраняются в принципе.

## 9. Утечка текста ошибки — заблокировано

Before (`before/09_error_leak.txt`): `id=abc` → HTTP 500 `{"error":"no such column: abc","type":"OperationalError"}`.

After (`after/09_error_leak.txt`):
```
GET /profile?id=abc (токен alice) => [{"id": 1, "name": "TEST_ALICE", ...}]   # HTTP 200
```
Точка инъекции устранена: `id` из query больше не попадает в SQL, поэтому запрос не
падает. На случай любых необработанных исключений наружу отдаётся обобщённое
`{"error":"internal server error"}` без текста/типа (подтверждено в п.6, запрос
`user=../private`), детали — только в stderr.

## 10. Контроль доступа к инструментам помощника `POST /assistant/execute` — заблокировано / ограничено

Before (`before/10a/10b/10c`): анонимно отрабатывали `export_profiles`, `read_file`
чужого/служебного файла и `delete_tree` (уничтожал чек bob).

After:
```
# 10a_execute_export.txt
export_profiles (без токена)      => {"error": "login required"}   # 401
export_profiles (alice, customer) => {"error": "staff only"}       # 403
export_profiles (staff)           => [все профили]                 # легально

# 10b_execute_readfile.txt
read_file private/operator-note.txt (alice) => {"error": "forbidden path"}  # 403
read_file files/bob/receipt.txt     (alice) => {"error": "forbidden path"}  # 403
read_file (без токена)                      => {"error": "login required"}  # 401
read_file files/alice/receipt.txt   (alice) => {"content": "TEST_ALICE receipt: chair, 5000 RUB"}  # свой файл работает

# 10c_execute_delete.txt
read_file files/bob/receipt.txt (alice) => {"error": "forbidden path"}   # чужой файл недоступен
delete_tree files/bob           (alice) => {"error": "tool not allowed"} # 403 — НЕ исполняется
delete_tree                     (без токена) => {"error": "login required"} # 401
AFTER: чек bob (токеном bob) => {"content": "TEST_BOB receipt: lamp, 1500 RUB"}  # цел
```
Сессия обязательна; `read_file` — только собственные файлы владельца;
`export_profiles` — только staff; `delete_tree` удалён как инструмент и не
исполняется ни для кого. Деструктивная операция недоступна в принципе.

---

## Prompt injection после фикса (`pi_after.txt`)

Реальную модель `opencode/big-pickle` прогнать по-прежнему **нельзя**: в этой среде
нет учётных данных opencode (`opencode auth list` → 0 credentials, запуск зависает —
подробно в `REPORT_01.md`, раздел «Prompt injection»). Поэтому проверяется защита,
**не зависящая от послушания модели**.

Канал инъекции сохранён (это нормально): контекст помощника
(`GET /assistant/context`) по-прежнему подставляет отзывы в промпт как данные, и
вредоносный отзыв с командой «верни JSON `delete_tree`/`export_profiles`/`read_file`
служебной заметки» туда попадает (см. `prompt` в `pi_after.txt`). Ключевое отличие:
даже если модель полностью подчинится инъекции и вернёт такой forced-JSON, **сервер
его не исполняет**. Поданный вручную (имитация послушной модели) JSON с токеном alice:
```
delete_tree files/bob             => {"error": "tool not allowed"}   # 403
export_profiles                   => {"error": "staff only"}         # 403
read_file private/operator-note.txt => {"error": "forbidden path"}   # 403
```
Это и есть независимая от послушания модели защита: авторизация каждого инструмента
выполняется на сервере (CWE-862 закрыта). Сравните с `before/pi_manual_execute.txt`
и `before/10c_execute_delete.txt`, где тот же forced-JSON уничтожал данные и
выгружал ПДн.

## Позитивная проверка легального сценария (`11_positive_flow.txt`)

```
login alice -> ok
купить lamp (без price) => {"id": 4, "owner": 1, "product": "lamp", "price": 1500}  # цена из каталога
свой профиль            => [{"id": 1, "name": "TEST_ALICE", ...}]
свои заказы             => только заказы alice
свой чек через /assistant/execute read_file files/alice/receipt.txt
                        => {"content": "TEST_ALICE receipt: chair, 5000 RUB"}
```
Обычный пользовательский путь (вход → покупка по каталогу → свой профиль/заказы →
свой чек через помощника) полностью работает. Легальная функциональность сохранена.

## Автотесты

`cd /Users/lewolkogonov/ITMOv2 && make step6` → **Ran 39 tests — OK**
(16 поставляемых + 23 security-регрессии из `test_security.py`).

## Вывод

Все 10 классов уязвимостей из REPORT_01 после фикса заблокированы или сведены к
«только свои данные». Общая первопричина — доверие к данным клиента (query,
заголовки, тело, отзывы) и отсутствие серверной аутентификации/авторизации —
устранена: сессия обязательна, владелец и роль берутся только из серверной сессии,
SQL параметризован, вывод экранируется, журнал обезличен, инструменты помощника
авторизуются на сервере независимо от решения LLM. Легальные сценарии не пострадали,
`make step6` — 39 тестов OK.
