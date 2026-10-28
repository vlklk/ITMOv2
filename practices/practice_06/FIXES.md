# FIXES — исправления Mini Shop (practice_06)

Правился только `lab/service.py`. `lab/sandbox.py` не менялся, сервер по-прежнему
слушает только `127.0.0.1`, зависимостей сверх стандартной библиотеки нет.
TDD: регрессии закодированы в `lab/test_security.py` (23 теста). На уязвимом коде
21 из них падал (2 — позитивные/функциональные проверки проходили и до фикса);
после правок проходят все 39 тестов (`16` поставляемых + `23` security).

## Ключевые изменения в архитектуре `service.py`

- `rows(query, params=())` — все запросы теперь параметризованы.
- `dispatch()` вызывает `_route()` и пишет в журнал только **метаданные**
  (`method`, `path`, `status`) — без тел, заголовков, паролей и токенов.
- `_route()` в начале один раз резолвит сессию: `session = sessions[X-Token]`.
  Владелец и роль берутся только из серверной сессии.
- `/login` сохраняет имя пользователя в сессию (`user`) — нужно для построения
  путей `files/<owner>/`.
- Хелперы `_owner_relpath()` / `_owner_file_arg()` держат файловый доступ
  в пределах `files/<owner>/` (запрет абсолютных путей, `..`, `\`, `:`).

## Таблица: уязвимость → исправление → тест

| # (REPORT_01) | Уязвимость | Что изменено в `service.py` (строки) | Закрывающий тест (`test_security.py`) |
|---|---|---|---|
| 1 | SQLi в `/profile` | Параметризация `WHERE id = ?` + `id` из сессии (`98`) | `test_sqli_profile_is_parameterized` |
| 2 | SQLi в `/search` | Параметризация `name LIKE ?` (`103`) | `test_sqli_search_is_parameterized` |
| 1 (доп.) | SQLi в `/assistant/context` | `WHERE id = ? AND owner = ?` (`153`) | `test_sqli_assistant_context_is_parameterized` |
| 3 | Нет сессии + IDOR (`/profile`, `/orders`) | 401 без сессии; `/profile` → только владелец (`97-98`); `/orders` → `WHERE owner = ?` (`108-109`) | `test_profile_requires_session`, `test_orders_requires_session`, `test_profile_idor_returns_owner`, `test_orders_scoped_to_owner` |
| 4 | Повышение привилегий через `X-Role` | Роль из `session["role"]`, заголовок игнорируется (`124`) | `test_admin_export_ignores_x_role_header` |
| 5 | Подмена цены | `price = self.products[product]`, поле из тела игнорируется (`117`) | `test_price_tampering_is_ignored` |
| 6 | IDOR + path traversal в `/files` | Сессия обязательна; путь `files/<owner>/<path>`, валидация `_owner_relpath` (`129-134`) | `test_files_ignores_user_param`, `test_files_path_traversal_denied`, `test_files_requires_session` |
| 7 | Stored XSS | `html.escape(r['text'])` в `/reviews/view` (`147`) | `test_stored_xss_is_escaped` |
| 8 | Утечка журнала `/debug/logs` | Только staff-сессия (`138`); журнал = только метаданные (`dispatch`, стр. ~75) | `test_debug_logs_requires_staff`, `test_debug_logs_omit_secrets` |
| 9 | Утечка текста ошибки (500) | Обобщённое `{"error":"internal server error"}`; детали — в stderr (`207`) | `ErrorLeakTest.test_internal_error_is_generic` |
| 10 | Нет контроля доступа к инструментам помощника | Сессия обязательна (`168`); `read_file` только свои файлы (`173-175`); `export_profiles` только staff (`179`); `delete_tree`/неизвестное → `403` (`184`) | `test_execute_requires_session`, `test_execute_read_file_other_owner_denied`, `test_execute_read_private_note_denied`, `test_execute_export_profiles_customer_denied`, `test_execute_delete_tree_forbidden`, `test_execute_export_profiles_staff_allowed`, `test_execute_unknown_tool_rejected` |

## Решения по спорным местам

- **`/search`** — по ТЗ закрываются только SQLi и отсутствие сессии; эндпоинт
  остаётся поиском профилей по имени, но с параметризованным `LIKE ?` и
  обязательной сессией. Привязку поиска к владельцу ТЗ не требовало (это общий
  поиск профилей), поэтому владельцем не ограничиваем.
- **`/debug/logs`** — выбран вариант «и доступ только staff, и не логировать
  секреты»: в журнал пишутся только метаданные запроса (`method`, `path`,
  `status`), тела/заголовки/пароли/токены не сохраняются в принципе; сам
  эндпоинт доступен только по staff-сессии.
- **`delete_tree`** — полностью убран как инструмент помощника: сервер его не
  исполняет ни для кого (возвращает `403 tool not allowed`). Это самый
  безопасный вариант — деструктивная операция недоступна через вывод LLM
  независимо от prompt injection. Прямой `sandbox.delete_tree` (и его тесты
  границы стенда) не трогались.

## Проверка

- `cd practices/practice_06/lab && python3 -m unittest -v` → **39 passed, OK**.
- `cd /Users/lewolkogonov/ITMOv2 && make step6` → **OK** (39 tests).
