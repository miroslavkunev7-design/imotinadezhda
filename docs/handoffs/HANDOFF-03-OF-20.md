# Предаване 3/20 — Имоти Надежда (imotinadezhda.bg)

> **Отвори нов чат с:** `Продължи от HANDOFF-03/20 — imotinadezhda.bg`
>
> **Правило:** Не reset-вай, не force-push, не трий Vercel проекти. Commit/push **само когато user поиска**.

**Дата:** 2026-06-19  
**Контекст:** ~88–90% (виж секция „Процент готовност“ по-долу)

---

## Регистър на handoff-ите (1–10)

| # | Файл | Дата | Състояние | Ключово съдържание |
|---|------|------|-----------|-------------------|
| **1** | `HANDOFF-01-OF-20.md` | 2026-06-18 | ✅ Архив | Git author, Vercel проекти, Lovable→Vercel миграция начало |
| **2** | `HANDOFF-02-OF-20.md` | 2026-06-19 | ✅ Архив | Hero /media, customer-chat stateless, AI Gateway env, smoke 59/59 |
| **3** | `HANDOFF-03-OF-20.md` | 2026-06-19 | **← ТЕКУЩ** | CRM readability, broker access, AI fix, logo/filters, uncommitted diff |
| **4** | `HANDOFF-04-OF-20.md` | — | ⏳ Pending | След: verify AI + service key + commit/push |
| **5** | `HANDOFF-05-OF-20.md` | — | ⏳ Pending | След: email queue, chat RPC migration |
| **6** | `HANDOFF-06-OF-20.md` | — | ⏳ Pending | След: hero MP4 → Supabase Storage |
| **7** | `HANDOFF-07-OF-20.md` | — | ⏳ Pending | След: git sync main (ahead/behind) |
| **8** | `HANDOFF-08-OF-20.md` | — | ⏳ Pending | — |
| **9** | `HANDOFF-09-OF-20.md` | — | ⏳ Pending | — |
| **10** | `HANDOFF-10-OF-20.md` | — | ⏳ Pending | — |

*(11–20 резерв за по-дълги серии — същият формат)*

---

## Процент готовност (честна оценка)

| Област | % | Бележки |
|--------|---|---------|
| Публичен сайт (страници, hero, SEO, media) | **~93%** | Работи; hero filters + logo fix deployed |
| Публичен чат „Надежда“ | **~85%** | Stateless fallback; пълен CRM запис изисква service key или RPC migration |
| CRM shell (всички `/admin/*` routes) | **~95%** | 30+ routes 200; readability CSS fix |
| CRM функционалност (CRUD, email, AI tools) | **~72%** | Broker access fix; липсва `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` |
| AI CRM bubble + `/admin/ai` | **~88%** | Fix deployed (Gateway priority); **user трябва да потвърди** след hard refresh |
| Инфра / env / migrations | **~78%** | AI Gateway OK; service key + 2 migrations pending |
| Git / repo hygiene | **~65%** | Много uncommitted промени; main diverged от origin |

**Обобщено:** **~85–88%** видим продукт · **~95%** остава след service key + email + git sync + commit

---

## Проект (константи)

| Поле | Стойност |
|------|----------|
| Локален repo | `C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp` |
| GitHub | `miroslavkunev7-design/imotinadezhda` |
| Branch | `main` — **uncommitted local changes** (виж Git по-долу) |
| Production URL | https://imotinadezhda.bg |
| Vercel project | `imotinadezhda-lovable-vercel` |
| Vercel team | `nadq-jeleva-s-projects` |
| Supabase ref | `zcrzxgzyptqibsajoece` |
| Supabase URL | `https://zcrzxgzyptqibsajoece.supabase.co` |
| Git author (ВАЖНО за deploy) | `286549693+miroslavkunev7-design@users.noreply.github.com` / `Miroslav Kunev` |

**Последен production deploy:** `dpl_5dvLTrvm6hFScZQLMRBDvJMyyRfK` (AI provider fix)  
Inspect: https://vercel.com/nadq-jeleva-s-projects/imotinadezhda-lovable-vercel/5dvLTrvm6hFScZQLMRBDvJMyyRfK

**Предишен deploy:** `dpl_CeM8DgJzD97g2pY7DjfuMkEy5WM8` (CRM readability)

---

## Какво е ЗАВЪРШЕНО в този чат (3/20)

### 1. AI CRM Асистент (bubble + `/admin/ai`)
- **Проблем:** „⏳ Прекалено много заявки“ = HTTP **429** от директен Gemini API
- **Причина:** `ai-provider.ts` ползваше `GEMINI_API_KEY` **преди** Vercel AI Gateway (Gateway беше конфигуриран, но игнориран)
- **Fix (deployed):**
  - `src/lib/ai-provider.ts` — приоритет: **Vercel Gateway → OpenAI → Gemini**, fallback при 429/402/5xx/auth
  - `src/lib/ai-assistant.functions.ts` — достъп за **всички CRM staff** (`hasCrmAccess`), не само admin; email от JWT claims

### 2. Broker CRM access
- `src/lib/auth/crm-access.ts` — RPC fallbacks, email match на brokers
- `src/routes/admin.tsx` — премахнат 6s timeout на access check
- `src/lib/crm.functions.ts`, `src/lib/audit.functions.ts` — authenticated Supabase client

### 3. CRM readability (контраст / двойен sidebar)
- `src/styles.css` — финален contrast block; премахнато force-white на таблици
- Премахнат duplicate `AdminShell` от: contacts, rules, documents, settings (images, page-builder, page-editor, theme)
- `src/components/admin/admin-shell.tsx` — profile card contrast

### 4. Публичен сайт UI
- `src/components/site/site-header.tsx` — без marble plaque; scroll logo
- `src/styles.css` — logo aspect-ratio, navbar buttons flex-end
- `src/components/site/luxury-real-estate.tsx` — `HeroFilterSelect` (четим dropdown, не native select)

### 5. Deploy
- Production redeploy след AI fix → live на imotinadezhda.bg

---

## Git състояние (НЕ commit-нато — user не е поискал)

**Modified:**
```
src/components/admin/admin-shell.tsx
src/components/site/luxury-real-estate.tsx
src/components/site/site-header.tsx
src/lib/ai-assistant.functions.ts
src/lib/ai-provider.ts
src/lib/audit.functions.ts
src/lib/auth/crm-access.ts
src/lib/crm.functions.ts
src/routes/admin.contacts.tsx
src/routes/admin.documents.tsx
src/routes/admin.rules.tsx
src/routes/admin.settings.*.tsx (4 files)
src/routes/admin.tsx
src/styles.css
```

**Untracked (не commit-вай secrets):**
- `.env.vercel.check`, `.env.vercel.prod`
- `docs/audit-backups/2026-06-19/*`

**Recent commits (on branch):**
```
8b9fc92 fix: CRM AI uses authenticated Supabase session when service key is missing
94ffc96 merge: sync origin/main with audit fixes and asset URL proxy
2b1011f fix: broker CRM access, chat persistence fallback, and audit repairs
```

---

## Vercel env (production) — актуално

| Променлива | Статус |
|------------|--------|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_*` | ✅ |
| `GEMINI_API_KEY` | ✅ |
| `AI_GATEWAY_KEY`, `VERCEL_AI_GATEWAY_KEY`, `AI_GATEWAY_URL`, `AI_GATEWAY_MODEL` | ✅ (`openai/gpt-4o-mini`) |
| `MARKETING_FROM_EMAIL`, `VAPID_*` | ✅ |
| **`SUPABASE_SERVICE_ROLE_KEY`** | ❌ **КРИТИЧНО** — CRM admin writes, email queue, пълен чат |
| **`RESEND_API_KEY` / `EMAIL_API_KEY`** | ❌ — transactional email |
| **`OPENAI_API_KEY`** | ❌ — не е нужен ако Gateway/Gemini работят |

**Нови Supabase keys (user сподели в чат):**
- Publishable: `sb_publishable_FSg2tRKyJodNtJKEKmsLWQ_olWqg8IU`
- Secret (`sb_secret_...`) → трябва в `SUPABASE_SERVICE_ROLE_KEY`
- Legacy JWT Secret беше paste-нат в чат → **rotate след миграция**

**Setup:**
```powershell
cd C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp
.\scripts\setup-vercel-service-key.ps1 -ServiceRoleKey "sb_secret_..."
npx vercel deploy --prod --yes
```

---

## Pending Supabase migrations (ръчно в SQL Editor)

1. `supabase/migrations/20260619010000_production_cron_urls.sql` — cron → task-reminders URL
2. `supabase/migrations/20260619120000_customer_chat_public_rpc.sql` — chat RPC без service key

---

## Ключови файлове

| Област | Файлове |
|--------|---------|
| AI CRM | `src/lib/ai-provider.ts`, `src/lib/ai-assistant.functions.ts`, `src/components/admin/ai-bubble.tsx` |
| AI публичен чат | `src/routes/api/public/customer-chat.ts`, `src/lib/customer-assistant.ts` |
| CRM access | `src/lib/auth/crm-access.ts`, `src/routes/admin.tsx` |
| CRM CSS | `src/styles.css` (~400–1800 CRM sections) |
| Supabase env | `src/lib/supabase-env.ts`, `src/integrations/supabase/safe-admin.ts` |
| Public header/filters | `src/components/site/site-header.tsx`, `luxury-real-estate.tsx` |
| Smoke test | `scripts/diagnose-production.mjs` |
| Env bootstrap | `scripts/bootstrap-vercel-env.ps1`, `scripts/setup-vercel-service-key.ps1` |

---

## Следващи приоритети (4/20)

1. **User verify AI bubble** — hard refresh → тест „Здравей“ / „Покажи запитвания“
2. **`SUPABASE_SERVICE_ROLE_KEY`** → Vercel → redeploy → пълен CRM
3. **Commit + push** локалните промени (след одобрение)
4. **`RESEND_API_KEY`** → email queue / marketing
5. Apply chat RPC migration (ако остане без service key)
6. Git sync `main` с origin (без force push)
7. Hero MP4 → Supabase Storage; махни legacy CDN rewrite
8. Финално logo → replace `src/assets/logo-scroll-banner.png`

---

## Команди за новия чат

```powershell
cd C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp
node scripts/diagnose-production.mjs
npx vercel env ls production
git status -sb
git log --oneline -5
npx vercel deploy --prod --yes
```

---

## User constraints (запомни)

- „Не чупи нищо“ — минимални surgical промени
- Commit/push **самo когато user поиска**
- Handoff при ~85–95% контекст → следващ файл `HANDOFF-04-OF-20.md`
- User иска **регистър 1–10** след всяко прехвърляне (таблицата по-горе)

---

## Security

- Legacy JWT Secret paste-нат в чат → rotate в Supabase Dashboard
- Не commit-вай `.env`, `.env.vercel.*`, service keys

---

*Предаване 3/20 — следващ: `HANDOFF-04-OF-20.md` след verify AI + service key или при ~90% контекст*
