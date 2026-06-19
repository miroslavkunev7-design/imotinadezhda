# Context Handoff — Имоти Нadezhda (1/20)

> **Протокол:** при ~85–95% контекст — прехвърляне към нов чат. Това е **първото (1/20)** записване.

## Проект

| Поле | Стойност |
|---|---|
| Repo | `miroslavkunev7-design/imotinadezhda` (локално: `imotinadezhda-temp`) |
| Production | https://imotinadezhda.bg |
| Vercel project | `imotinadezhda-lovable-vercel` (team: `nadq-jeleva-s-projects`) |
| Supabase | `zcrzxgzyptqibsajoece` |
| Git branch | `main` — локално **2 commit-а напред**, remote **6 commit-а напред** (diverged) |

## Завършено (не прави отново)

1. Домейн `imotinadezhda.bg` → проект `imotinadezhda-lovable-vercel`; стар `imotinadezhda` изтрит.
2. Lovable SDK/runtime премахнат — замени: `app-auth.ts`, `send-email.ts`, `ai-provider.ts`, `error-reporting.ts`, `supabase-env.ts`, `/api/email/queue/process`.
3. Production deploy работи (source build на Vercel). Последен OK: `dpl_8GbSy6bra7BTg1LAPNFyPJM4NKTd`.
4. Fix `tslib` dependency за serverless bundle.
5. SEO/site-config от commit `7e6726b` запазен.

## Lovable audit (runtime)

| Статус | Какво |
|---|---|
| OK | Няма `@lovable.dev/*` в dependencies |
| OK | Няма `ai.gateway.lovable.dev` |
| OK | Asset JSON файлове с `/__l5e` — resolve → `/media/*` proxy (vercel.json) |
| OK | Само dev scripts (`visual-*.mjs`) споменават lovable.app |
| Pending | Cron migration `20260619010000_production_cron_urls.sql` — apply ръчно в Supabase |
| Pending | `SUPABASE_SERVICE_ROLE_KEY` липсва в Vercel production |

## Hero видеа (градове + начало)

- Asset meta: `src/assets/*-hero.mp4.asset.json` (home, shumen, burgas, varna, login).
- `resolveAssetUrl()` мапва `/__l5e/...` → `/media/assets-v1/...` на `imotinadezhda.bg`.
- `vercel.json` rewrite: `/media/*` → legacy CDN (временно, докато не мигрират файловете в Supabase Storage / Vercel Blob).
- Страници: `luxury-real-estate.tsx` (home), `shumen-home-page.tsx`, `city-like-shumen-page.tsx`, `cities.$slug.index.tsx`.
- DB: `cities.hero_video_url` с `/__l5e` — resolve в `CityPage`.

## Vercel env (production) — нужни за пълна функционалност

| Променлива | За какво |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | CRM, админ, email queue |
| `OPENAI_API_KEY` или `GEMINI_API_KEY` | AI асистент, чат „Надежда“ |
| `RESEND_API_KEY` / `EMAIL_API_KEY` | Имейли |
| `SUPABASE_URL` + keys | вече са зададени |
| Google OAuth redirect | Supabase → `https://imotinadezhda.bg/admin` |

## Git commits (локални, не push-нати)

- `d9d71b7` Remove Lovable dependencies…
- `53c02b4` fix: add tslib…
- *(следващ)* media proxy + hero video perf

## Следващи стъпки

1. Commit + push (или force push след reset) за GitHub sync.
2. Deploy след media proxy промени.
3. Мигрирай hero MP4 от legacy CDN → Supabase Storage; смени rewrite destination.
4. Apply Supabase cron migration.
5. Добави `SUPABASE_SERVICE_ROLE_KEY` в Vercel.
6. Сравни с deployment `BzW829eqB` (на изтрит проект — недостъпен през CLI).

## Performance notes

- `AutoPlayVideo` — shared component, deferred mount + `preload=metadata`.
- `CustomerChat` — lazy loaded в `__root.tsx`.
- `/media/*` — `Cache-Control: immutable` 1y.

---
*Handoff 1/20 — следващ запис при нужда: 2/20*
