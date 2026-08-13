# Visual 1:1 проверка — DistrictPage

Автоматизирано сравнение пиксел-по-пиксел на горния (header) и долния
(footer) панел на DistrictPage спрямо одобрена референция.

## Команди

```bash
# Първо стартиране → засява baseline от текущия preview
bun run visual:district

# Сравни текущото състояние с baseline (fail при >2% разлика)
bun run visual:district

# Презапиши baseline след одобрена дизайн промяна
bun run visual:district -- --update

# Към друг URL (напр. production)
bun run visual:district -- --url=https://imotinadezhda.lovable.app/cities/burgas/districts/lazur
```

## Папки

- `tests/visual/baseline/` — одобрени референции (commit-нати).
- `tests/visual/current/` — последен capture (gitignored).
- `tests/visual/diff/`    — diff визуализации (gitignored).

## Праг

`pixelmatch` threshold `0.1` (per-pixel), минимално съвпадение **97%**
(max diff 3% от общата площ). При fail скриптът връща exit code 1 и
записва diff PNG за преглед.

## Зависимости

Изисква Playwright Chromium:
```bash
bun add -d playwright && bunx playwright install chromium
```
