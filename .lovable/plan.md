
## 1. Нов таб в Настройки (CRM Admin)

Добавям `/admin/settings/images` (линк "Промяна на снимки" в side menu на Настройки).

### Секция A — Background на сайта (само админ)
- Списък със страниците: Home, За продажба, Под наем, За нас, Контакти.
- За всяка страница: upload на нова background снимка + live preview в две рамки: **Desktop (1440×900)** и **Mobile (375×812)**, една до друга.
- Бутони "Запази" / "Откажи".
- Снимките се пазят в нова таблица `page_backgrounds (page_key, image_url, updated_by, updated_at)` и storage bucket `page-backgrounds` (public).
- Frontend компонентите четат от тази таблица (с public read RLS) и fallback към текущите дефолти.

### Секция B — Background на CRM модула (всеки брокер/админ за себе си)
- Upload + двоен preview (desktop/mobile).
- Пази се в `profiles.crm_background_url` (нова колона).
- Влияе само на `/admin/*` layout-а на текущия user.

### Секция C — Карти Градове / Квартали (само админ)
- Grid с всички градове / всички квартали.
- За всяка карта: thumbnail + бутони **Смени снимка**, **Скрий/Покажи** (toggle `is_published`), **Изтрий**.
- Бутон **+ Добави нов град** / **+ Добави нов квартал** (модал: име, slug auto, снимка).
- Update-ва `cities.hero_image_url` / `quarters.image_url`.

Всичко през `createServerFn` + `requireSupabaseAuth` с проверка `has_role(uid, 'admin')` за глобалните неща.

## 2. Домейн imotinadezhda.bg (SuperHosting.bg)

Lovable не може да управлява .bg регистрация. Стъпки за теб в SuperHosting контролния панел (DNS Manager):

```
A   @       185.158.133.1
A   www     185.158.133.1
TXT _lovable lovable_verify=<ще ти го дам от Lovable>
```

След това в Lovable: **Project Settings → Domains → Connect Domain → imotinadezhda.bg**, копираш TXT стойността, чакаш до ~30 мин за propagation, SSL се издава автоматично.

Аз ще ти подам точните стойности след като влезеш в Domains таба.

## 3. GitHub push

GitHub вече е свързан — всяка моя промяна автоматично се push-ва в твоето repo. Няма нужда от ръчен push.

## Технически детайли

- Migration: нова таблица `page_backgrounds`, нова колона `profiles.crm_background_url`, нов public bucket `page-backgrounds`.
- RLS: public SELECT на `page_backgrounds`; INSERT/UPDATE/DELETE само за admin. `profiles.crm_background_url` — own update (вече има policy).
- Нови файлове: `src/routes/_authenticated/admin/settings/images.tsx`, `src/lib/site-images.functions.ts`, `src/components/admin/settings/*` компоненти.
- Refactor: home/listings hero компонентите четат `page_backgrounds`; admin shell чете `profiles.crm_background_url`.

Потвърди и започвам.
