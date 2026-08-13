# Deploy Guide — Имоти Надежда

Пълна инструкция за прехвърляне на проекта от Lovable към твоя Vercel.

---

## Стъпка 1 — Свали кода

**Опция A: GitHub sync (препоръчително — auto-deploy при промяна)**

1. В Lovable → + меню → GitHub → Connect project
2. Създай ново repo (напр. `imotinadezhda`)
3. Във Vercel → Import Git Repository → избери същото repo
4. Всяка бъдеща промяна в Lovable → auto push към GitHub → auto deploy към Vercel

**Опция B: ZIP export (еднократен deploy)**

1. В Lovable → отвори Code Editor (икона `</>`)
2. В долния ляв ъгъл на file tree → бутон **Download codebase**
3. Разархивирай ZIP-а локално
4. Vercel dashboard → New Project → Upload folder

> ⚠️ ZIP download е достъпен само на платени Lovable планове (Pro+).

---

## Стъпка 2 — Настрой Supabase

### 2.1 Провери, че всички миграции са приложени

В Supabase Dashboard → SQL Editor изпълни последователно:

```sql
-- Провери дали таблиците за наеми съществуват
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('rentals', 'rental_payments');
```

Ако липсват, приложи ги:

```sql
-- db/migrations/20260713120000_rentals_and_payments.sql
-- db/migrations/20260713130000_rentals_management_fee.sql
-- (копирай съдържанието на всеки файл и го пусни в SQL Editor)
```

### 2.2 Създай storage buckets (ако не са налични)

В Supabase → Storage → New bucket:

- `property-images` (public)
- `rental-documents` (private, RLS enforced)
- `documents` (private, брокери)

### 2.3 Копирай API ключовете

Supabase → Project Settings → API → копирай:
- `URL` → отива в `SUPABASE_URL` и `VITE_SUPABASE_URL`
- `anon` public key → `SUPABASE_PUBLISHABLE_KEY` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (SERVER-ONLY!)

---

## Стъпка 3 — Настрой Vercel environment variables

Vercel Dashboard → твой проект → Settings → Environment Variables.

**Задължителни** (без тях сайтът не работи):

| Име | Стойност | Environments |
|---|---|---|
| `SUPABASE_URL` | от Стъпка 2.3 | Production, Preview |
| `SUPABASE_PUBLISHABLE_KEY` | от Стъпка 2.3 | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | от Стъпка 2.3 | Production, Preview |
| `VITE_SUPABASE_URL` | същата URL | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | същият anon key | Production, Preview |

**За AI (един от четирите варианта):**

| Име | Стойност | Откъде |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | https://platform.openai.com/api-keys |
| `GEMINI_API_KEY` | `AIza...` | https://aistudio.google.com/apikey |
| `AI_GATEWAY_KEY` | | https://vercel.com/ai-gateway |
| `LOVABLE_API_KEY` | *авто в Lovable* | синхронизира се автоматично |

**За Push нотификации** (напомняния за задачи):

```bash
# Генерирай локално:
npx web-push generate-vapid-keys
```

| Име | Стойност |
|---|---|
| `VAPID_PUBLIC_KEY` | от командата по-горе |
| `VAPID_PRIVATE_KEY` | от командата по-горе |
| `VAPID_SUBJECT` | `mailto:contact@imotinadezhda.bg` |

**Опционални:**

| Име | За какво | Откъде |
|---|---|---|
| `RESEND_API_KEY` | Email newsletters | https://resend.com/api-keys |
| `EMAIL_FROM` | Sender адрес | твой домейн |
| `FIRECRAWL_API_KEY` | Scraper imot.bg | https://firecrawl.dev/ (~$16/мес) |

---

## Стъпка 4 — Deploy

### GitHub метод
Push към main → Vercel auto-deploy → готово.

### ZIP метод
```bash
cd imotinadezhda
npm install -g vercel
vercel --prod
```

---

## Стъпка 5 — Post-deploy проверки

След първия deploy отвори production URL и провери:

1. **Начална страница** зарежда се, hero видеото се пуска
2. **Login** (`/login`) — влез с админ акаунт
3. **CRM Dashboard** (`/admin`) — календарът се вижда
4. **Клиенти** (`/admin/clients`) — папките с градове зареждат
5. **Имоти** (`/admin/properties`) — виждаш списък
6. **AI асистент** (`/admin/ai`) — прати тест съобщение
7. **Push нотификации** — в profile settings натисни "Активирай"

### Проверка на логове при грешки

Vercel Dashboard → твоя проект → Deployments → избери deployment → Function Logs

---

## Custom Domain

Vercel Dashboard → Settings → Domains → Add `imotinadezhda.bg`. Vercel показва DNS записите за настройка при регистратора ти.

---

## Rollback

Vercel Dashboard → Deployments → предишна успешна версия → **Promote to Production**.

---

## Известни ограничения

1. **Media/снимки** — `/media/*` proxy-ват към Lovable CDN (вж. `vercel.json`). Ако Lovable спре, снимките спират. За пълна независимост:
   - Мигрирай съществуващите снимки към Supabase Storage
   - Или към Cloudflare R2 / AWS S3
   - Обнови `src/lib/asset-url.ts` и махни rewrite-овете в `vercel.json`

2. **Worker publishers** (`worker/src/publishers/imot-bg.js`, `imoti-net.js`, `olx-bg.js`) — stub-ове за автоматично публикуване. Изискват Playwright + login credentials, не са завършени. `bazar-bg.js`, `home-bg.js`, `alo-bg.js`, `fb-marketplace.js` са по-нататък, но не тествани в production.

3. **Firecrawl (scraper)** — ако не зададеш `FIRECRAWL_API_KEY`, бутонът "Извлечи днешни" в CRM ще хвърли грешка. Приложението работи без него, просто scraper модулът е неактивен.

---

## Support

Всички миграции са в `db/migrations/`. Схемата за базовите таблици (`properties`, `clients`, `brokers`, `cities`, `quarters`) не е включена като SQL файл — тя вече съществува в текущия Supabase проект. За fresh deploy на нов Supabase проект, използвай:

```bash
# Локално, ако имаш supabase CLI:
supabase db pull  # взима schema от production
supabase db push  # прилага я на нов проект
```