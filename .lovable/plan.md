# Визуален редактор на страници

Нова секция `/admin/settings/page-editor` — отваря избрана страница (Home / Sale / Rent / About / Contacts) в iframe с overlay за редактиране. Работи в 3 фази, за да получиш бързо стойност без да чупим production сайта.

## Фаза 1 — Подредба на секции (drag & drop + show/hide) ⭐ започвам с това

- Изброявам всички секции на избраната страница (Hero, Търсачка, Градове, Featured имоти, Quarters, За нас банер и т.н.) като карти в страничен панел.
- Drag handle до всяка карта → местиш с мишката нагоре/надолу. Реалния preview в iframe се обновява веднага.
- Toggle "око" → скриване/показване на секция на публичния сайт.
- Бутон "Запази" → записва подредбата в нова таблица `page_layouts (page_key, sections jsonb, updated_by, updated_at)`.
- Публичните компоненти (HomePage, search.tsx, about.tsx) четат подредбата и рендерират секциите в новия ред, скривайки изключените.
- Има бутон "Възстанови оригинала".

**Защо първо това:** дава ти 80% от контрола (кое къде стои, кое се вижда) без риск да счупим дизайна, защото компонентите остават както са.

## Фаза 2 — Inline редактор на текст и снимки

- Кликаш върху всеки текст в preview-то → редактираш на място (заглавия, подзаглавия, бутони, описания).
- Кликаш върху всяка снимка → upload на нова.
- Промените се пазят в `page_content (page_key, slot_key, value jsonb)` и компонентите ги четат с fallback към текущите defaults.
- Бутон "AI помощ" до всяко текстово поле → отваря prompt ("направи го по-кратко", "по-продаващ тон" и т.н.) и презаписва текста чрез Lovable AI (Gemini 2.5 Flash).

## Фаза 3 — Свободно местене и преоразмеряване (AI асистент)

- В preview-то добавям resize handles и free-drag на отделни блокове.
- Промените се пазят като per-block CSS overrides (`width`, `height`, `padding`, `margin`, `order`).
- AI бутон "Опиши какво искаш да промениш" → Gemini вижда текущия layout + промпта и връща patch към overrides таблицата.

⚠️ **Честно предупреждение за Фаза 3:** свободно местене на production компоненти лесно чупи responsive дизайна (mobile/tablet/desktop се чупят различно). Препоръчвам първо да изкараме Фаза 1+2 в работен вид и тогава да решим колко свобода даваме във Фаза 3 (примерно само padding/spacing вместо пълен free-drag).

## Технически детайли (за справка)

- Нови таблици: `page_layouts`, `page_content`, `page_overrides`. RLS: SELECT за всички (anon + authenticated), INSERT/UPDATE/DELETE само за admin.
- Нов route: `src/routes/_authenticated/admin/settings/page-editor.tsx` + `?page=home|sale|rent|about|contacts`.
- Iframe сочи към публичната страница с `?__editor=1` query parameter → публичните компоненти добавят `data-section-id` атрибути и слушат `postMessage` за highlight/hover.
- Server functions: `getPageLayout`, `savePageLayout`, `getPageContent`, `savePageContent`, `aiRewriteText`.
- Refactor: всеки секционен компонент в `luxury-real-estate.tsx`, `search.tsx`, `about.tsx`, `contacts.tsx` се изнася в отделен файл с уникален `slotKey`, за да може editor-ът да ги адресира.
- Добавям връзка от `/admin/settings` → "Редактор на страници".

## Скоуп на тази заявка

Започвам **само с Фаза 1**. След като я видиш и работи, продължавам с Фаза 2, после Фаза 3.

Потвърди и започвам с миграцията + Фаза 1.
