# Context Handoff — Имоти Надежда (2/20)

> Пълен handoff: **`docs/handoffs/HANDOFF-02-OF-20.md`**
>
> Нов чат: **`Продължи от HANDOFF-02/20 — imotinadezhda.bg`**

## TL;DR

- **Production OK:** https://imotinadezhda.bg — deploy `6GaFQ4ahD8pt5uzQyzoUQRDzW5Dz`, **59/59** smoke tests
- **Lovable removed**, hero videos via `/media` proxy, navbar+logo fixed
- **Chat works** (stateless fallback); CRM DB writes need `SUPABASE_SERVICE_ROLE_KEY`
- **Git:** local ahead 4 / behind 6, uncommitted UI+chat+env scripts
- **Не прави:** reset, force push, delete Vercel projects, commit secrets

## Блокер

`SUPABASE_SERVICE_ROLE_KEY` — само от Supabase Dashboard или `.\scripts\fetch-supabase-service-key.ps1` след `npx supabase login`

## Deploy

```powershell
npx vercel deploy --prod --yes
node scripts/diagnose-production.mjs
```
