
# План за изпълнение

## 1. Активиране на Lovable Cloud
Включвам Cloud (Supabase под капака) — дава ни PostgreSQL, Auth, Storage и сървърни функции без външни акаунти.

## 2. База данни (миграция)
Създавам следните таблици в `public` схема с RLS + GRANT-и:

- **cities** — id, slug (unique), name, name_en, description, hero_image_url, stats (jsonb: население, средна цена, ROI), display_order, is_published
- **quarters** — id, city_id (FK), slug, name, description, image_url, avg_price_per_sqm, properties_count, display_order
- **properties** — id, city_id, quarter_id, slug, title, description, price, currency, area_sqm, rooms, floor, type (apartment/house/office/land), status (sale/rent), is_featured, is_published, created_at
- **property_images** — id, property_id, url, display_order, is_cover
- **inquiries** — id, property_id, name, email, phone, message, created_at, status
- **profiles** — id (FK auth.users), full_name, avatar_url, created_at
- **user_roles** — id, user_id, role (enum: admin, agent, user) + security-definer `has_role()`
- **ai_conversations** + **ai_messages** — за AI помощника в админа

RLS:
- Публично четене на `is_published = true` за cities/quarters/properties/property_images
- INSERT в `inquiries` за всички (за форма "запитване")
- Всичко останало (admin CRUD) — само `has_role(auth.uid(),'admin')`

## 3. Свързване на Home & градски страници
- `src/lib/catalog.functions.ts` — серверни функции: `getCities`, `getCityBySlug`, `getQuartersByCity`, `getFeaturedProperties`, `getPropertiesByCity`, `getPropertyById`
- Home: топ градове + featured имоти от DB
- `/cities/burgas`: hero + карти с квартали + списък с имоти
- `/properties/:id`: детайли + галерия + форма за запитване
- Loader pattern с TanStack Query (`ensureQueryData` + `useSuspenseQuery`)

## 4. Auth + Admin
- Email/парола + Google OAuth (през Lovable broker)
- `/login`, `/register`, `_authenticated` layout guard
- Auto-създаване на profile + trigger при signup
- Първият регистриран потребител получава ролята `admin` (или ръчно през SQL seed)

## 5. Админ панел `/admin/*`
Защитен от `has_role(admin)`:
- **Dashboard** — статистики (брой имоти, запитвания, посещения)
- **Cities** — CRUD за градове и квартали
- **Properties** — CRUD + качване на изображения в Storage bucket `property-images`
- **Inquiries** — преглед и управление на запитвания
- **AI Assistant** — чат с Lovable AI (Gemini 3 Flash) с tool-calling:
  - `search_properties`, `create_property`, `update_property_price`, `mark_featured`, `get_inquiries_summary`, `generate_property_description` (AI копирайтинг на български)
  - Streaming SSE отговори, markdown rendering, persistent история в `ai_conversations`

## 6. Технически детайли

- Сървърни функции: `createServerFn` + `requireSupabaseAuth` middleware
- Admin операции през `supabaseAdmin` в `.server.ts` хелпери, извикани от тънки `.functions.ts`
- AI: server route `/api/admin/ai-chat` с проверка на admin роля + streaming proxy към `https://ai.gateway.lovable.dev/v1/chat/completions`
- Storage bucket `property-images` (public read, admin write)
- Сийдване на Бургас + 2-3 квартала + 4-5 примерни имота, за да се вижда веднага съдържание

## 7. Какво НЕ влиза в този етап
- Плащания / резервации
- Реален имейл при запитване (по-късно с Resend)
- Карта (Google Maps) — оставям placeholder до получаване на API ключ

---

**Въпрос преди старт:** За admin достъпа — да направя ли първия регистриран потребител автоматично admin, или предпочиташ да ми кажеш email-а ти и аз ще го seed-на ръчно в базата?
