## Задача 1 — Анализ на изпратените CRM файлове

CRM архивът (`crm-files.zip`, 44 файла) съдържа:

**Routes (`src/routes/admin.*.tsx`)** — 26 страници: dashboard (`admin.index`), `clients`, `properties`, `quarters`, `cities`, `brokers`, `inquiries`, `matches`, `tasks`, `calendar`, `chat`, `contracts`, `documents`, `extracted`, `finance`, `marketing`, `owners`, `contacts`, `audit` (+ `audit.$id`), `database`, `dns`, `profile`, `ai`, `settings` (+ `settings.images`, `settings.page-builder`, `settings.page-editor`).

**Admin компоненти (`src/components/admin/`)**: `admin-shell.tsx` (sidebar layout + theming wrapper), `ai-bubble.tsx`, `broker-roles-dialog`, `client-details-sheet`, `client-scan-modal`, `doc-scanner`, `mortgage-send-modal`, `mortgage-stages-modal`.

**Server logic (`src/lib/`)**: `crm.functions.ts`, `crm-scan.functions.ts` (+ test), `ai-assistant.functions.ts` (Gemini 2.5 Pro + tools: search_clients/get_client/search_properties/get_property/save_contract), `auth/assert-admin.ts` (+ test).

**Theme system**: `use-crm-theme.ts` чете/пише `profiles.crm_theme` (JSON колона), 6 пресета (burgundy, midnight, forest, royal, light, graphite). `admin-shell` инжектира CSS променливи `--crm-surface`, `--crm-accent` и т.н. **Темата вече е персонална (per-user)** — идеална основа за задача 2.

**Извод**: инфраструктурата за персонална тема съществува. Липсва само AI tool, който да я променя автоматично.

---

## Задача 2 — AI редизайнер на CRM с персонални промени

### Какво ще направя

Добавям нов tool `update_crm_theme` в `ai-assistant.functions.ts`, който позволява на асистента да променя CRM темата на **текущо логнатия user** (никой друг не вижда промяната). Промените са моментални и trackvат се само за него чрез `profiles.crm_theme`.

### Tool design

```ts
update_crm_theme({
  surface?: string,        // hex/rgb за основен фон
  surfaceTo?: string,      // вторичен фон (за градиент)
  accent?: string,         // основен акцент (бутони, активни)
  accentSoft?: string,     // полу-прозрачен акцент
  text?: string,           // основен текст
  textMuted?: string,      // вторичен текст
  border?: string,         // граници
  preset?: "burgundy"|"midnight"|"forest"|"royal"|"light"|"graphite"
})
```

Handler логика:
- Ако `preset` е даден → зарежда базата от `CRM_THEME_PRESETS`, после overlay-ва дадените цветове.
- Иначе чете текущата тема от `profiles.crm_theme`, мерджва само дадените полета.
- Записва обратно в `profiles.crm_theme` за `context.userId` (RLS-safe).
- Валидира hex/rgb формат.

### System prompt update

Добавям секция:
> "Можеш да променяш CRM темата на потребителя чрез `update_crm_theme`. Когато потребителят каже неща като 'направи целия CRM жълто и зелено' или 'смени темата на тъмно синьо', извикай tool-а с подходящи hex цветове. Промените са лични — виждат се само от него. Винаги потвърждавай след промяна и предлагай 'върни' ако не хареса."

### Frontend reactivity

`useCrmTheme` вече има `setTheme(next)` setter. За да видим промените веднага след AI отговор без refresh, ще добавя:
- Експорт `refreshCrmTheme()` helper който re-fetch-ва от Supabase.
- В `admin.ai.tsx` след успешен AI reply → `queryClient.invalidate` + trigger refresh на темата.

Алтернатива (по-проста): след AI отговор, ако reply съдържа маркер `[THEME_UPDATED]`, презареждаме темата. AI tool result слага този маркер.

Ще избера втория подход (по-малко промени в архитектурата).

### Какво НЕ променям

- Темата на публичния сайт (нерелевантно — заявката е за CRM).
- Глобална тема за всички users (само персонална, както поиска).
- Дизайн система на shadcn компонентите (само CSS променливите).

---

## Файлове за промяна

1. `src/lib/ai-assistant.functions.ts` — нов tool `update_crm_theme`, обновен system prompt, hex валидация.
2. `src/hooks/use-crm-theme.ts` — експорт `refreshCrmTheme` функция (или event-based reload).
3. `src/routes/admin.ai.tsx` — детекция на `[THEME_UPDATED]` маркер и trigger reload.
4. `src/components/admin/admin-shell.tsx` — слуша за theme update events (ако трябва).

Без миграция — `profiles.crm_theme` колоната вече съществува.

---

Потвърди и започвам имплементация.