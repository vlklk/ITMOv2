# Specification Quality Checklist: Режимы игры и события для подписей — логика

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-27
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- Итерация 1 валидации: найдено и исправлено 2 замечания.
  - FR-051 упоминал «таймеры» — деталь реализации; переписан как «не зависит от реальных часов, экрана и непредсказуемой случайности».
  - US5, сценарий 5: тетрис на 38 линиях поднимает уровень 4 → 5, а событие «новый уровень» было пропущено — добавлено (с оговоркой FR-006).
- Итерация 2: все пункты, кроме маркеров, проходят.
- Осталось 3 маркера [NEEDS CLARIFICATION] (лимит промпта — 3), вопросы владельцу продукта и команде интерфейса:
  - FR-006 — растут ли уровень и скорость в «Спринте 40» и «Ультра» (по умолчанию записано: да, по A5).
  - FR-022 — прерывает ли фиксация без строк цепочку «Подряд» между двумя тетрисами (по умолчанию: нет, по общепринятым правилам).
  - FR-042 — способ выдачи событий интерфейсу: очередь с явной очисткой (по умолчанию) или только события последнего хода; согласовать с командой 1.
- Термины проекта «seed», «hold», «призрак», ссылки на ID A1–A9, B1–B4 и конституцию оставлены сознательно: это словарь контракта `docs/requirements.md`, а не детали реализации. Имён функций, файлов кода и ключей хранилища в спецификации нет.
- FR-040–FR-044 — граница с интерфейсом, помечены как допущение для согласования с командой 1 (спецификация `specs/001-*` не читалась).
