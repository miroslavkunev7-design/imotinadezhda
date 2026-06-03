
# Visual Page Builder — пълна система

## Какво ще има потребителят накрая

В **Админ → Настройки** ще има трета карта **"Смяна на дизайн на страница"**. Тя води до `/admin/page-builder`, където:

1. **Избира страница** за редакция: Home, About, Cities, Properties, Brokers, Contact
2. **Drag & Drop канвас** в средата (live preview как ще изглежда)
3. **Лява лента — Библиотека**: Navbars (20+), Heroes (15+), Buttons (20+), Cards, Sections, Footers, Forms, Galleries
4. **Дясна лента — Property panel**: за избрания компонент → цвят, форма (radius), шрифт, размер, padding, margin, текст
5. **Top bar**: Save, Publish, Undo/Redo, Preview (mobile/desktop), Reset
6. **Modal "Качи референция"** с 2 режима:
   - **Подобен дизайн** — scrape с Firecrawl (branding format) → AI генерира тема (цветове/шрифтове/spacing) и приложима към текущите компоненти
   - **1:1 копие** — Firecrawl scrape (html + screenshot + branding) → AI Gateway (Gemini 2.5 Pro) преобразува в JSON layout от наши компоненти → запис в база → рендване като жива страница

## Архитектура

### База данни (нови таблици)
```
page_designs
  id, page_slug (home|about|cities|...), name, layout_json (jsonb), 
  is_published, created_by, created_at, updated_at

design_revisions  (history за undo)
  id, page_design_id, layout_json, created_at

component_presets  (запазени потребителски варианти)
  id, component_type, name, props_json, preview_url
```
RLS: само admin може да създава/редактира; всички четат `is_published=true`.

### Frontend структура
```
src/admin/page-builder/
  PageBuilder.tsx              — главен layout (3 колони)
  Canvas.tsx                   — drop zone, рендва избраните компоненти
  ComponentLibrary.tsx         — лява лента, табове по тип
  PropertyPanel.tsx            — дясна лента, динамичен формуляр
  Toolbar.tsx                  — top bar
  blocks/                      — изградени компоненти-блокове
    navbars/Navbar01..20.tsx
    heroes/Hero01..15.tsx
    buttons/Button01..20.tsx
    sections/, footers/, ...
  registry.ts                  — мета за всеки блок (props schema, preview, defaults)
  store.ts                     — Zustand: layout, selection, undo/redo
  
src/components/site/
  RenderDesign.tsx             — на публичните страници; чете layout_json и рендва блокове
```

### Server functions (TanStack)
```
src/lib/page-builder.functions.ts
  loadDesign(page_slug)                     — публично, чете published
  saveDesign({page_slug, layout_json})      — admin
  publishDesign(id)                         — admin
  scrapeReference(url, mode)                — Firecrawl + AI
  generateFromReference(scraped, mode)      — AI Gateway → layout_json
```

### Drag & Drop
`@dnd-kit/core` + `@dnd-kit/sortable` — стандартна, лека, работи с TanStack/SSR.

### Колко "компоненти" реално

За **първа версия която работи** не мога физически да генерирам 20–30 уникални качествени навбара в един prompt. Реалистично:
- **5 навбара**, 5 heroes, 8 бутона, 4 sections, 3 footers, 3 cards, 3 forms = **~31 блока** общо
- Всеки има 3–5 цветови варианта + property controls → ефективно стотици комбинации
- Преди да маркирам "готово" ще тествам, че всеки блок рендва и се конфигурира

### Upload референция

- **Similar** режим: Firecrawl `formats: ['branding', 'screenshot']` → AI получава палитра/шрифтове → връща тема (CSS variables) → applied като theme override
- **1:1 clone** режим: Firecrawl `formats: ['html', 'screenshot', 'branding']` → Gemini 2.5 Pro получава HTML + скрийншот + нашия registry от блокове → връща `layout_json` използвайки наши блокове, най-близки до оригинала → потребителят вижда резултата в канваса и може да дотюнва

Това **няма да е perfect pixel clone** от първия път — ще е близко приближение което после се редактира. Истинският 1:1 clone като жива React страница е research-level проблем, никакъв инструмент в света не го прави автоматично безгрешно.

## Свързване с публичния сайт

На всяка публична страница (`/`, `/about`, etc.) добавям логика:
```tsx
const design = useDesign('home');  // serverFn зарежда published layout
if (design) return <RenderDesign layout={design.layout_json} />;
return <DefaultHomePage />;        // fallback към текущата ръчно-кодирана
```
Така старият дизайн остава като fallback; новият се активира когато публикуваш през builder-а.

## Етапи на изграждане (в един turn)

1. Миграция: `page_designs`, `design_revisions`, `component_presets` + RLS
2. Server functions + Firecrawl connector check
3. Zustand store + registry + dnd-kit setup
4. Библиотека блокове (5 navbars, 5 heroes, 8 buttons, etc.)
5. Canvas + ComponentLibrary + PropertyPanel + Toolbar
6. Route `/admin/page-builder`, карта в Settings
7. RenderDesign + интеграция с публичните страници
8. Upload референция modal + scrape/generate flows
9. Smoke test: създавам тестов layout, публикувам, проверявам че `/` го рендва

## Какво НЕ обещавам

- Че всеки блок ще изглежда Awwwards-quality от първия път (ще са функционални и чисти, но ще искат полиране).
- Че 1:1 clone ще е перфектен — ще е "близо, после ръчно дотюнваш в канваса".
- Че няма да открием бъгове при първото пускане. Това е сложен flow; ще трябва итерация.

## Технически зависимости за инсталиране

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `zustand` (за builder state)
- `@mendable/firecrawl-js` (за scrape) — Firecrawl connector е вече наличен в проекта
- Lovable AI Gateway — вече налично през `LOVABLE_API_KEY`

---

**Ако одобриш плана, започвам веднага и пиша всичко в един дълъг turn.**
