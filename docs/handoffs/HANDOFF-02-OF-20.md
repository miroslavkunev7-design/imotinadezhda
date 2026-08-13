# Предаване 2/20 — Имоти Надежда

> **Отвори нов чат с:** `Продължи от HANDOFF-02/20 — imotinadezhda.bg`
>
> **Правило:** Не reset-вай, не force-push, не трий Vercel проекти. Само гради върху текущото production състояние.

---

## Проект (константи)

| Поле | Стойност |
|---|---|
| Локален repo | `C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp` |
| GitHub | `miroslavkunev7-design/imotinadezhda` |
| Branch | `main` — локално **ahead 4, behind 6** (diverged, **не е push-нат**) |
| Production URL | https://imotinadezhda.bg |
| Vercel project | `imotinadezhda-lovable-vercel` |
| Vercel team | `nadq-jeleva-s-projects` |
| Vercel project ID | `prj_MEZCBMZ0Ip8UYZ2rBmj6teLh3Ao4` |
| Supabase ref | `zcrzxgzyptqibsajoece` |
| Supabase URL | `https://zcrzxgzyptqibsajoece.supabase.co` |

**Последен production deploy (OK):** `6GaFQ4ahD8pt5uzQyzoUQRDzW5Dz`  
Inspect: https://vercel.com/nadq-jeleva-s-projects/imotinadezhda-lovable-vercel/6GaFQ4ahD8pt5uzQyzoUQRDzW5Dz

**Smoke test:** `node scripts/diagnose-production.mjs` → **59/59** ✅

---

## Какво е ЗАВЪРШЕНО (не прави отново)

### Инфра / домейн
- `imotinadezhda.bg` + `www` → `imotinadezhda-lovable-vercel`
- Стар Vercel проект `imotinadezhda` — **изтрит** (не възстановявай)
- Единствен site project: `imotinadezhda-lovable-vercel`

### Lovable removal (runtime)
| Lovable | Замяна |
|---|---|
| `@lovable.dev/vite-tanstack-config` | стандартен `vite.config.ts` + Nitro Vercel |
| `@lovable.dev/cloud-auth-js` | `src/integrations/app-auth.ts` |
| `@lovable.dev/email-js` | `src/lib/send-email.ts` + `/api/email/queue/process` |
| `ai.gateway.lovable.dev` | `src/lib/ai-provider.ts` (OpenAI / Gemini / Vercel AI Gateway) |
| Lovable Supabase errors | `src/lib/supabase-env.ts` + `safe-admin.ts` fallbacks |
| Logo CDN `__l5e` | `src/assets/logo-scroll-banner.png` + `src/lib/asset-url.ts` |

### Hero видеа
- `vercel.json`: rewrite `/media/:path*` → legacy CDN + cache 1y
- `resolveAssetUrl()` мапва `/__l5e/...` → `/media/...`
- `AutoPlayVideo` — deferred load, без `preload=auto`
- Production media verified: `/media/.../shumen-hero.mp4` → 200

### Чат „Надежда“ (API)
- **Проблем:** липсва `SUPABASE_SERVICE_ROLE_KEY` → RLS блокира DB writes
- **Fix deployed:** `customer-chat.ts` — **stateless fallback** при RLS/липсващ RPC (чат работи без запис в CRM)
- **Backup migration (НЕ apply-ната в DB):** `supabase/migrations/20260619120000_customer_chat_public_rpc.sql`
- RPC `customer_chat_open` в production DB → **404** (migration не е пусната)
- Supabase MCP → **няма permission** за `zcrzxgzyptqibsajoece`

### Navbar / logo (последна UI работа)
- `src/components/site/site-header.tsx` — marble плака + scroll logo
- `src/styles.css` — `.site-header-v2` — премахнат счупен CSS crop (логото беше невидимо)
- Златни канти на navbar pill; logo „излиза“ отляво
- Файл на logo: `src/assets/logo-scroll-banner.png` (swap при финално logo)

### Env vars добавени на Vercel production
- `AI_GATEWAY_KEY`, `VERCEL_AI_GATEWAY_KEY`
- `AI_GATEWAY_URL` = `https://ai-gateway.vercel.sh/v1/chat/completions`
- `AI_GATEWAY_MODEL` = `openai/gpt-4o-mini`
- `VITE_ASSET_BASE_URL` = празно
- `GEMINI_API_KEY` — вече беше зададен

### Скриптове
| Скрипт | Цел |
|---|---|
| `scripts/diagnose-production.mjs` | 59 HTTP smoke tests |
| `scripts/bootstrap-vercel-env.ps1` | sync env vars → Vercel |
| `scripts/fetch-supabase-service-key.ps1` | service role от Supabase CLI → Vercel |
| `scripts/setup-vercel-service-key.ps1` | ръчен service key + redeploy |
| `scripts/apply-chat-rpc.sh` | apply chat RPC migration (needs `supabase login`) |
| `docs/SITE_DIAGNOSTIC.md` | пълен checklist |

---

## Git състояние (локално, НЕ commit-нато)

**Modified (uncommitted):**
- `src/routes/api/public/customer-chat.ts` — RPC + stateless fallback + `history` field
- `src/components/site/customer-chat.tsx` — изпраща `history` към API
- `src/components/site/site-header.tsx` — logo plaque
- `src/styles.css` — site-header-v2 fix
- `src/lib/ai-provider.ts` — `VERCEL_AI_GATEWAY_KEY` fallback

**Untracked:**
- `docs/SITE_DIAGNOSTIC.md`, `docs/handoffs/`
- `scripts/*.ps1`, `scripts/diagnose-production.mjs`, `scripts/apply-chat-rpc.sh`
- `supabase/migrations/20260619120000_customer_chat_public_rpc.sql`
- `.env.vercel.prod`, `.env.vercel.check` — **НЕ commit-вай** (OIDC/secrets)

**Committed locally (ahead of origin):**
- `e733b50` stop tracking .env.vercel
- `b763788` hero videos /media proxy + perf
- `53c02b4` tslib fix
- `d9d71b7` Remove Lovable dependencies

---

## Единствен блокер за ПЪЛЕН CRM

### `SUPABASE_SERVICE_ROLE_KEY` — липсва навсякъде

**Не може да се измисли** — JWT от Supabase Dashboard.

**Как да се добави:**
1. Supabase Dashboard → project `zcrzxgzyptqibsajoece` → Settings → API → `service_role` secret
2. ```powershell
   cd C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp
   .\scripts\setup-vercel-service-key.ps1 -ServiceRoleKey "eyJ..."
   ```
   Или: `npx supabase login` → `.\scripts\fetch-supabase-service-key.ps1`

**Без service key:** сайт + чат работят (stateless); admin CRM записи в DB, email queue — ограничени.

**Variant B (само чат persistence):** apply `20260619120000_customer_chat_public_rpc.sql` в Supabase SQL Editor.

---

## Vercel env — какво липсва

| Променлива | Статус |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ липсва (критично за CRM) |
| `RESEND_API_KEY` / `EMAIL_API_KEY` | ❌ липсва (имейли) |
| `OPENAI_API_KEY` | ❌ липсва (Gemini работи) |
| `SUPABASE_*`, `GEMINI_*`, `VAPID_*` | ✅ зададени |
| `AI_GATEWAY_*` | ✅ добавени |

Deploy винаги: `npx vercel deploy --prod --yes` (source build, **не** само prebuilt upload).

---

## Pending Supabase migrations (ръчно)

1. `supabase/migrations/20260619010000_production_cron_urls.sql` — cron → `https://imotinadezhda.bg/api/public/hooks/task-reminders`
2. `supabase/migrations/20260619120000_customer_chat_public_rpc.sql` — chat RPC без service key

---

## Ключови файлове

```
vercel.json                          — build, /media rewrite, cache
src/lib/asset-url.ts                 — __l5e → /media
src/lib/supabase-env.ts              — env + anon fallbacks
src/integrations/supabase/safe-admin.ts
src/routes/api/public/customer-chat.ts
src/components/site/site-header.tsx
src/components/site/customer-chat.tsx
src/styles.css                       — .site-header-v2
scripts/diagnose-production.mjs
```

---

## Команди за новия чат

```powershell
cd C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp
node scripts/diagnose-production.mjs
npx vercel env ls production
npx vercel deploy --prod --yes
git status -sb
```

---

## Следващи приоритети (само гради, не чупи)

1. **Commit + push** локалните промени (след одобрение от user)
2. **`SUPABASE_SERVICE_ROLE_KEY`** → Vercel → redeploy → CRM admin writes
3. Apply chat RPC migration (ако остане без service key)
4. Мигрирай hero MP4 от legacy CDN → Supabase Storage; махни rewrite към lovable.app
5. Финално logo — replace `logo-scroll-banner.png`
6. Git sync: resolve diverged `main` (ahead 4, behind 6) — **без force push**

---

## User constraints (запомни)

- „Не чупи нищо“ — минимални surgical промени
- Commit/push **само когато user поиска**
- Bash search ползван за ключове — service role **не е намерен** на машината
- User иска handoff при ~85–95% контекст → този файл

---

*Предаване 2/20 — следващ при нужда: `HANDOFF-03-OF-20.md`*
