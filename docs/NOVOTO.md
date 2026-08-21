# Новите неща — записани в папката

Папка: `C:\Users\milena\Desktop\Миро\imnad-main`  
Локал: http://localhost:8080/

Това е опис на модулите, добавени на 21.08.2026. Стойности на ключове няма тук.

## CRM екрани

| Модул | Локален линк | Основни файлове |
|---|---|---|
| Лийдове (А1) | http://localhost:8080/admin/inquiries | `src/routes/admin.inquiries.tsx`, `src/lib/lead-capture.ts`, `src/lib/lead-capture.functions.ts`, `src/routes/api/public/leads.ts` |
| Квалификация (А3) | http://localhost:8080/admin/qualify | `src/routes/admin.qualify.tsx`, `src/lib/qualify.functions.ts`, `src/lib/qualify-score.ts`, `src/components/admin/lead-score-badge.tsx` |
| Огледи (А6) | http://localhost:8080/admin/viewings | `src/routes/admin.viewings.tsx`, `src/lib/viewings.functions.ts`, `src/lib/viewings-reminders.server.ts`, `src/components/admin/schedule-viewing-dialog.tsx` |
| Договори (А8) | http://localhost:8080/admin/contracts | `src/routes/admin.contracts.tsx`, `src/lib/contracts.ts`, `src/lib/contracts.functions.ts` |
| Документи (А9) | http://localhost:8080/admin/documents | `src/routes/admin.documents.tsx`, `src/components/admin/document-desk.tsx`, `src/lib/documents.functions.ts` |
| Снимки (А12) | http://localhost:8080/admin/photos | `src/routes/admin.photos.tsx`, `src/lib/photo-jobs.functions.ts` |
| Разпръскване | http://localhost:8080/admin/distribute | `src/routes/admin.distribute.tsx`, `src/lib/distribute.functions.ts` |
| Бот-брокери | http://localhost:8080/admin/bots | `src/routes/admin.bots.tsx`, `src/lib/bot-brokers.functions.ts` |
| Календар | http://localhost:8080/admin/calendar | `src/routes/admin.calendar.tsx` |

## Публичен сайт

| Нещо | Линк | Файлове |
|---|---|---|
| Начало + градове | http://localhost:8080/ | `src/routes/index.tsx`, `src/lib/site-config.ts`, `src/lib/seo-keywords.ts` |
| Села / курорти около град | http://localhost:8080/cities/burgas/around | `src/routes/cities.$slug.around.tsx`, `src/lib/villages.functions.ts` |
| SEO футър | всички публични | `src/components/site/site-seo-footer.tsx` |
| Чат 24/7 | балон на сайта | `src/lib/customer-assistant.ts`, `src/lib/customer-channels.ts` |
| Лийд API | `POST /api/public/leads` | `src/routes/api/public/leads.ts` |

## Webhooks

| Канал | Път |
|---|---|
| WhatsApp | `/api/public/hooks/whatsapp` |
| Facebook OAuth | `/api/public/hooks/facebook-oauth` |
| Messenger | `/api/public/hooks/facebook-messenger` |
| Viber | `/api/public/hooks/viber` |
| Напомняния огледи/задачи | `/api/public/hooks/task-reminders` |

## Миграции (база)

- `supabase/migrations/20260821120000_client_ai_qualification.sql`
- `supabase/migrations/20260821120000_customer_assistant_channels.sql`
- `supabase/migrations/20260821120000_document_checklist_tracking.sql`
- `db/migrations/20260821120000_photo_jobs.sql`
- `db/migrations/20260821120000_viewings.sql`

## Worker

- `worker/src/index.js` — чете профили от CRM (`platform_connections`), не само от `.env`

Ключове: [KEYS.md](KEYS.md). Не пиши стойности в този файл.
