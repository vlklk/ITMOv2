# a_q1 — конфигурация A (local-guide)

- Вопрос: Как запустить тесты? Укажи файл-источник.
- Модель: `ollama/itmo-agent`, агент `local-guide`, новая сессия
- Время: 29 с, код выхода 0

## Вызовы инструментов

- `glob` {"pattern": "*/{setup.py,pipenv.lock,.gitignore,virtualenv.toml,mypy.ini,pytest.ini,requirements.txt,.pre-commit-config.yaml}"} → completed
- `glob` {"pattern": "**/{Makefile,*.mk,mise.json,mise.toml,wasm-pack.toml,wasm-pack.lock}"} → completed
- `glob` {"pattern": "**/*.{sh,bash,cz}"} → completed
- `read` {"filePath": "/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/Makefile"} → completed

## Ответ модели

Потому что я не вижу файлов конфигурации для запуска тестов (например, `pytest.ini`, `package.json` с секцией `test` или `Makefile`), проверю, есть ли в демо-проекте какой-либо файл со скриптами команд.
Файл для запуска тестов — [`Makefile`](/Users/lewolkogonov/ITMOv2/practices/practice_03/lab/demo/Makefile).

Проверю его содержимое, чтобы точно сказать, как запустить тесты.
Чтобы запустить тесты, используйте:

```bash
make test
```

или вручную:

```bash
python3 -m unittest -v
```
