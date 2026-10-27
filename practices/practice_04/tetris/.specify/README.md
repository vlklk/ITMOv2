# Spec Kit в проекте

Официальные шаблоны [GitHub Spec Kit](https://github.com/github/spec-kit) **v1.2.3** (тег `v1.2.3`, лицензия MIT — `LICENSE-spec-kit`), скопированы без изменений:

- `templates/` — шаблоны `spec`, `plan`, `tasks`, `checklist`, `constitution`;
- `commands/` — промпты команд `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`;
- `memory/constitution.md` — конституция проекта (создаётся командой `constitution`).

**Отличие от `specify init`.** CLI `specify` и bash-скрипты Spec Kit в этой среде не запускались: политика безопасности агента запрещает исполнять скачанный внешний код. Поэтому шаги, которые в команде записаны как `Run {SCRIPT}`, агент выполняет вручную — создаёт каталог фичи `specs/NNN-short-name/`, пишет `.specify/feature.json` с полем `feature_directory`, копирует шаблон. Всё остальное — порядок шагов, шаблоны, проверки качества спецификации — по официальным промптам команд.

Цикл: `constitution` → `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`.
