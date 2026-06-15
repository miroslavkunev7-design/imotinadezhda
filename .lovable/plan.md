
# Блок 1 — CRM Theme Editor

Започваме с този блок. Останалите 6 блока (AI права, Scraper, Lightbox, счупени бутони, начален екран, Supabase финализация) идват след одобрение на този.

## Какво ще има

Нова страница **Settings → Дизайн на CRM** с три таба:

### Таб 1: Цветове и шрифтове (глобална тема)
Live color pickers за всеки токен, с моментален preview:
- Фон (background) / Повърхност / Карта (cards) / Панел странична лента
- Първичен (бутони) / Hover на първичен / Текст върху първичен
- Вторичен / Accent / Border
- Текст основен / Текст muted / Текст върху карта
- Шрифт фамилия (headings) + шрифт фамилия (body) — dropdown с Google Fonts: Playfair, Inter, Open Sans, Montserrat, Roboto, Poppins, Manrope
- Размер на основния шрифт (slider)
- Цвят на бутоните + цвят на текста върху бутоните (отделно)

**Auto-contrast guard:** при всяка промяна на фонов цвят, ако contrast ratio с текста падне под 4.5, автоматично се коригира текстът към бяло или черно — гарантира че никога няма да има „невидим" текст.

### Таб 2: Дизайн пресети за компоненти
Селектори (radio cards с миниатюрен preview) за:
- **Карти с градове** — 4 варианта (класик / glass / минимал / с градиент)
- **Navbar** — 3 варианта (бургундия pill / прозрачен / тъмен)
- **Лого позиция** — 3 варианта (ляво над / ляво в линия / центрирано)
- **Форми (input стил)** — 3 варианта (закръглени / класически / underline)
- **Бутони** — 3 варианта (pill / закръглени / квадратни) + сила на сянка

### Таб 3: Responsive Preview
Toolbar с 5 device бутона, които сменят размера на preview iframe:
- Mobile (375×667)
- Tablet (768×1024)
- Desktop (1440×900)
- App Windows (1280×800)
- App Mobile (414×896)

Preview-ът показва началната страница на CRM с приложените цветове в реално време.

## Технически детайли

**Запазване**
- Нова таблица `theme_settings` (workspace-level, един ред): JSON колона `tokens` (всички цветове, шрифтове, размери) + JSON колона `presets` (избрани варианти за компоненти).
- RLS: само admin може да чете/пише.
- При зареждане на CRM, `ThemeProvider` в `__root.tsx` чете реда и инжектира всичко като CSS variables на `:root` → всички съществуващи `bg-primary`, `text-foreground`, `border` и т.н. автоматично се пребоядисват без да пипаме отделните компоненти.

**Auto-contrast**
- Функция `ensureContrast(bg, fg)` използва WCAG luminance formula → ако ratio < 4.5, връща `#fff` или `#0a0a0a` според кой е по-четим.
- Извиква се на всеки color change преди да се запише в state.

**Презети за компоненти**
- Всеки преsет = обект с CSS класове, които се добавят на `data-preset-cards="glass"` и т.н. на `<html>`.
- В `styles.css` дефинираме съответните селектори: `[data-preset-cards="glass"] .city-card { ... }`.

**Файлове които ще се променят/създадат**
- НОВО: `src/routes/admin.settings.theme.tsx` — главната страница с табове
- НОВО: `src/components/admin/theme/color-token-grid.tsx`
- НОВО: `src/components/admin/theme/preset-picker.tsx`
- НОВО: `src/components/admin/theme/device-preview.tsx`
- НОВО: `src/lib/theme/contrast.ts` — WCAG contrast helpers
- НОВО: `src/lib/theme/theme.functions.ts` — load/save server fns
- НОВО: `src/components/theme-provider.tsx` — инжектира CSS vars
- ПРОМЯНА: `src/routes/__root.tsx` — wrap с ThemeProvider
- ПРОМЯНА: `src/styles.css` — добавяме preset селектори
- НОВО: миграция `theme_settings` таблица + RLS + GRANT

**Какво НЕ е в този блок**
- AI права (Блок 2)
- Scraper Бургас/Шумен/Варна + детекция на агенции (Блок 3)
- Fullscreen галерии (Блок 4)
- Поправка на счупени бутони (Блок 5)
- Прозрачна търсачка + махане на Lovable badge + смяна на „Нови пазар" карта (Блок 6)
- Финален тест навсякъде (Блок 7)

## След одобрение
Започвам с миграцията (одобряваш я), след това кодирам всичко горе и тествам — отварям /admin/settings/theme, сменям цвят, гледам че се прилага веднага и навсякъде.
