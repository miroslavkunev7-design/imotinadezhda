# Предаване 1/20 — Имоти Надежда (imotinadezhda.bg)

**Дата:** 2026-06-18  
**Проект:** `C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp`  
**Следващ handoff:** `HANDOFF-02-OF-20.md` (при ~85–90% контекст)

---

## Git / GitHub

| Поле | Стойност |
|------|----------|
| Remote | `https://github.com/miroslavkunev7-design/imotinadezhda.git` |
| Branch | `main` (synced with origin) |
| Последен commit | `6caa836` — trigger deploy with GitHub-verified author |
| Git author (ВАЖНО) | `286549693+miroslavkunev7-design@users.noreply.github.com` |
| Git name | `Miroslav Kunev` |

**Не ползвай** `miroslav@imotinadezhda.bg` — Vercel блокира deploy.

---

## Vercel

| Поле | Стойност |
|------|----------|
| Team | `nadq-jeleva-s-projects` |
| GitHub проект | `imotinadezhda` → deploy **Ready** (`imotinadezhda-mh3zd1ln1-...`) |
| Lovable проект | `imotinadezhda-lovable-vercel` → **домейнът сочи ТУК** |
| Домейни | `imotinadezhda.bg`, `www.imotinadezhda.bg` → **lovable-vercel** проект |
| CLI logged in | `miroslavkunev7-design` |

### Env vars на `imotinadezhda` — обновено 2026-06-18

- ✅ `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_PROJECT_ID` (Production + Development)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` — липсва (вземи от Lovable Cloud → Secrets)
- Последен deploy: `imotinadezhda-dwx263pq0-...` (Ready)

### КРИТИЧНО: домейнът е на грешния проект

`imotinadezhda.bg` → **`imotinadezhda-lovable-vercel`**, не `imotinadezhda` (GitHub).  
SEO/sitemap fix-овете от GitHub **не са live** на .bg домейна докато не се премести домейнът в Vercel Dashboard.

---

## Supabase

| Поле | Стойност |
|------|----------|
| Project ID | `zcrzxgzyptqibsajoece` |
| URL | `https://zcrzxgzyptqibsajoece.supabase.co` |
| Тип | Lovable Cloud (не е в личния Supabase MCP акаунт) |
| REST API | ✅ работи (cities/properties се зареждат) |
| Локален `.env` | има URL + publishable key, **няма** service role |

---

## Какво е готово

- [x] GitHub remote и push работят
- [x] Vercel GitHub deploy минава (undici fix, commit `7e6726b`)
- [x] Git author email поправен → deploy Ready
- [x] SEO: canonical → `imotinadezhda.bg`, sitemap fix, keywords
- [x] Supabase публичен достъп работи на сайта
- [x] Частични Vercel env vars добавени

---

## Какво остава (ПРИОРИТЕТ)

1. **Добави липсващи Vercel env vars** на проект `imotinadezhda`:
   - `VITE_SUPABASE_URL=https://zcrzxgzyptqibsajoece.supabase.co`
   - `VITE_SUPABASE_PROJECT_ID=zcrzxgzyptqibsajoece`
   - `SUPABASE_SERVICE_ROLE_KEY=` ← от Lovable Cloud dashboard
2. **Премести домейн** `imotinadezhda.bg` от `imotinadezhda-lovable-vercel` към `imotinadezhda` (Vercel Dashboard → Domains) ИЛИ unify двата проекта
3. **Redeploy** след env vars
4. **Google Search Console** — submit sitemap `https://imotinadezhda.bg/sitemap.xml`
5. **DNS** — локален DNS на потребителя понякога не резолвира домейна; Google DNS 8.8.8.8 работи

---

## Ключови файлове

- `vercel.json` — build: `DEPLOY_TARGET=vercel vite build`
- `src/lib/site-config.ts` — SEO URLs
- `src/integrations/supabase/safe-admin.ts` — sitemap fallback
- `.env` — локални Supabase keys (без service role)
- `.cursor/rules/context-handoff-protocol.mdc` — правило за handoff

---

## Команди за следващия чат

```powershell
cd "C:\Users\Agenciq\Desktop\IM\imotinadezhda-temp"

# Добави env vars (повтори за preview/development при нужда)
"https://zcrzxgzyptqibsajoece.supabase.co" | vercel env add VITE_SUPABASE_URL production
"zcrzxgzyptqibsajoece" | vercel env add VITE_SUPABASE_PROJECT_ID production

# Проверка
vercel env ls
vercel ls imotinadezhda
vercel inspect imotinadezhda.bg
```

---

## Старт на следващ чат

```
Продължи от HANDOFF-01/20 — довърши GitHub/Supabase/Vercel връзката и env vars.
```
