# Диагностика imotinadezhda.bg — пълен списък

Дата: 2026-06-19 · Base URL: https://imotinadezhda.bg  
Скрипт: `node scripts/diagnose-production.mjs`

---

## A. Публичен сайт

### A1. Основни страници
- [x] `/` — начало, hero, търсене (HTTP 200, без error boundary)
- [x] `/about` — За нас
- [x] `/search` — търсене имоти
- [x] `/search?status=sale` — продажба
- [x] `/search?status=rent` — наем
- [x] `/login` — вход

### A2. Градове (hero видео + layout)
- [x] `/cities/shumen`
- [x] `/cities/varna`
- [x] `/cities/burgas`
- [x] `/cities/nov-pazar`
- [x] `/cities/shumen/around` — околност

### A3. Квартали (sample)
- [x] `/cities/burgas/districts/lazur-burgas-bg`
- [x] `/cities/varna/districts/briz-varna-bg`
- [x] `/cities/shumen/districts/tsentar-shumen-bg`

### A4. Обяви (sample от sitemap)
- [x] `/properties/{id}` — 4 тестови UUID от sitemap (200)

### A5. SEO / PWA / статични
- [x] `/sitemap.xml`
- [x] `/robots.txt`
- [x] `/manifest.webmanifest`
- [x] `/sw.js`

### A6. Hero media (`/media/*` proxy)
- [x] home-hero-4k.mp4
- [x] shumen-hero.mp4
- [x] varna-hero-4k.mp4
- [x] burgas-hero.mp4

### A7. Публични API
- [x] `POST /api/public/hooks/task-reminders` → `{"ok":true,...}`
- [ ] **`POST /api/public/customer-chat`** — **FAIL 500** (RLS без `SUPABASE_SERVICE_ROLE_KEY`)

### A8. UI функции (ръчна проверка)
- [x] Навигация: За продажба / Под наем / За нас
- [x] Hero poster + video URL в HTML
- [ ] Чат widget „Надежда“ — блокиран от A7
- [ ] PWA install prompt — не тествано автоматично

---

## B. CRM / Admin (`/admin/*`)

> Без admin login: проверка = страницата зарежда (200), без server 500.  
> Функционален CRM тест изисква Google OAuth + admin role.

### B1. Shell & auth
- [x] `/login` зарежда
- [x] `/admin` → redirect/login shell (200)
- [ ] Пълен вход Google + admin role — **изисква credentials**

### B2. CRM модули (HTTP 200 — shell OK)
- [x] `/admin/` — табло
- [x] `/admin/properties` — имоти
- [x] `/admin/clients` — клиенти
- [x] `/admin/inquiries` — запитвания
- [x] `/admin/tasks` — задачи
- [x] `/admin/calendar` — календар
- [x] `/admin/chat` — екипен чат
- [x] `/admin/marketing` — маркетинг
- [x] `/admin/matches` — match-ове
- [x] `/admin/contracts` — договори
- [x] `/admin/finance` — финанси
- [x] `/admin/brokers` — брокери
- [x] `/admin/owners` — собственици
- [x] `/admin/contacts` — контакти
- [x] `/admin/cities` — градове
- [x] `/admin/quarters` — квартали
- [x] `/admin/documents` — документи
- [x] `/admin/extracted` — извлечени данни
- [x] `/admin/database` — база
- [x] `/admin/audit` — одит
- [x] `/admin/ai` — AI инструменти
- [x] `/admin/dns` — DNS
- [x] `/admin/profile` — профил
- [x] `/admin/rules` — правила
- [x] `/admin/settings` — настройки
- [x] `/admin/settings/theme`
- [x] `/admin/settings/images`
- [x] `/admin/settings/page-editor`
- [x] `/admin/settings/page-builder`
- [x] `/admin/debug/quarters`

### B3. CRM — изисква admin session (не автоматизирано)
- [ ] CRUD имоти / клиенти / задачи
- [ ] Email queue / marketing send
- [ ] Page builder / editor запис в БД
- [ ] Push notifications (VAPID keys)
- [ ] AI scan / CRM AI tools

---

## C. Инфраструктура

| Компонент | Статус |
|---|---|
| Vercel project `imotinadezhda-lovable-vercel` | OK |
| Domain `imotinadezhda.bg` | OK |
| `GEMINI_API_KEY` на Vercel | OK (encrypted) |
| `SUPABASE_SERVICE_ROLE_KEY` на Vercel | **ЛИПСВА** |
| Supabase cron migration (task-reminders URL) | **Не приложена** (MCP без права) |
| Customer chat RPC migration | **Подготвена локално, не приложена** |

---

## D. Единствен FAIL — как да се оправи (без да се чупи друго)

### Вариант 1 (препоръчителен за целия CRM)
Добави в Vercel → Environment Variables → Production:
`SUPABASE_SERVICE_ROLE_KEY` = от Supabase Dashboard → Settings → API → service_role

### Вариант 2 (само публичен чат без service key)
Пусни SQL от файла:
`supabase/migrations/20260619120000_customer_chat_public_rpc.sql`  
в Supabase SQL Editor за проект `zcrzxgzyptqibsajoece`.

След това redeploy (кодът вече ползва RPC с fallback).

---

## E. Резултат

| Категория | Минали | Общо |
|---|---|---|
| HTTP smoke (скрипт) | 58 | 59 |
| Публичен сайт | ~95% | — |
| CRM shell load | 100% | 30 routes |
| CRM функционалност | Изисква login + service key | — |

**Нищо от работещото не е променено в production по време на тази диагностика.**
