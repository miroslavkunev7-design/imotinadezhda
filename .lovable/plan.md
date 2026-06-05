# План: Разделяне на CRM от сайта + поправка на админ инструментите

## 1. Разделяне на CRM приложение от публичния сайт

**Цел:** Когато потребител натисне „Изтегли приложение" (PWA install) и го отвори от иконата на телефона, то да тръгва директно от `/login` (после `/admin`), а не от публичния сайт.

**Подход (manifest-only, без service worker):**
- `public/manifest.webmanifest`:
  - `name`: „Имоти Надежда CRM"
  - `short_name`: „Надежда CRM"
  - `start_url`: `/login?source=pwa`
  - `scope`: `/` (за да хваща и `/admin/*`)
  - `display`: `standalone`
  - theme/background: бургунд (#600f1c) + кремаво (#fdfaf5)
  - икони: ползваме `brand-logo-square.png` (192, 512, maskable)
- В `__root.tsx` head: `<link rel="manifest">`, `theme-color`, `apple-touch-icon`
- На `/` (публичния сайт) добавям бутон „Изтегли CRM приложението" който отваря install prompt (`beforeinstallprompt` event). На iOS – инструкция „Добави към началния екран".
- Бутонът за инсталация се показва само ако още не е инсталирано.

**Бележка:** PWA-та споделят един origin – не може реално да имаш „две приложения". Но със `start_url=/login` инсталираният app icon ще отваря директно логин, което е точно това което потребителят иска. Service worker не добавям (не е поискан offline режим).

## 2. Поправяне на админ инструментите (Page Builder, Change Image, Design)

**Първо ще диагностицирам:**
- Ще прегледам `admin.settings.page-builder.tsx`, `admin.settings.page-editor.tsx`, `admin.settings.images.tsx`
- Ще проверя server functions: `page-builder.functions.ts`, `page-layouts.functions.ts`, `site-images.functions.ts`
- Ще тествам дали server functions се извикват (network requests) и какво връщат
- Ще проверя дали таблиците в БД съществуват и имат правилни RLS/GRANT-и
- Ще проверя дали `attachSupabaseAuth` е свързано (вече е, видях в `src/start.ts`)
- Ще проверя дали admin потребителят има правилна роля

**Типични причини за такива бъгове:**
1. Липсващи GRANT-и на таблиците → 401/403 при заявка
2. RLS политики които искат admin роля, но `has_role()` не намира роля
3. Server function която чете `process.env` на грешно място
4. Front-end бутон който не е свързан към mutation (просто `console.log`)
5. Storage bucket за изображения без public read или без upload policy

**След диагнозата ще поправя точно това което е счупено**, без да пипам визуалния дизайн или работещите части.

## 3. „Optimize everything"

Тук ще се фокусирам само на нещата свързани с горните две:
- Премахване на ненужни re-fetch-ове в admin страниците
- Правилен `staleTime` на queries
- Loading/error states където липсват

Няма да правя голям рефакторинг който може да счупи нещо работещо.

## Какво НЯМА да пипам
- Дизайнът на Shumen home page (запазен е както го одобри)
- NeighborhoodCardShumen
- Navbar (desktop HeaderNav + mobile SiteHeader)
- Луксозните city/district/property страници
- Hero видеата

## Технически детайли

**Файлове които ще променя:**
- `public/manifest.webmanifest` (нов или ъпдейт)
- `src/routes/__root.tsx` (manifest link + theme-color)
- `src/components/site/shumen-home-page.tsx` или нов компонент „Install CRM" бутон
- (потенциално) миграция за GRANT-и/RLS на page_builder/site_images таблици
- (потенциално) фикс в `*.functions.ts` файлове

**Файлове за диагностика преди фикс:**
- `src/routes/admin.settings.page-builder.tsx`
- `src/routes/admin.settings.page-editor.tsx`
- `src/routes/admin.settings.images.tsx`
- `src/lib/page-builder/page-builder.functions.ts`
- `src/lib/site-images.functions.ts`
- БД схема на `page_designs`, `site_images` таблиците

## Въпрос преди да започна

Искаш ли:
- **(A)** Да направя и двете задачи в един ход (PWA разделяне + диагноза и фикс на админ инструментите)?
- **(B)** Първо само PWA разделянето, после в отделен ход админ инструментите?

Препоръчвам (A) – задачите са независими и мога да ги изпълня паралелно.
