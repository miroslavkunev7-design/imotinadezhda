# GitHub Connect → push main → redeploy imotinadezhda.bg

## Цел
Свързване на този съществуващ Lovable проект със съществуващото GitHub репо `miroslavkunev7-design/imotinadezhda` (branch `main`), синхронизиране на текущия state към `main` и production redeploy на Vercel (`imnad.vercel.app` / `imotinadezhda.bg`). Без нов repo, branch, project или промяна на application код.

## Текущо състояние (проверено)
- HEAD = `1b3f62a99e38c91177fac61e01987348decce118`; работното дърво чисто; typecheck, lint, build — PASS.
- GitHub remote НЕ съществува — репото сочи само към вътрешното Lovable хранилище.
- В workspace-а няма GitHub connection. Authorization-ът е защитена стъпка, която аз не мога да изпълня — само ти можеш.

## Стъпка 1 — GitHub свързване (ИЗПЪЛНЯВАШ ТИ)
1. Меню **„+“** в полето за чат (долу вляво) → **GitHub** → **Connect project**
2. Authorize Lovable GitHub App
3. Избери акаунта **miroslavkunev7-design** и съществуващото репо **imotinadezhda**, branch **main** — ново репо НЕ се създава

## Стъпка 2 — Sync и проверка (изпълнявам веднага след стъпка 1)
- Потвърждавам, че двупосочната синхронизация е записала текущия HEAD към `main`.
- Ако `main` е напред — безопасен merge/rebase без загуба на state, без force-push.
- Финален typecheck + lint + build до PASS.
- Връщам точния GitHub commit SHA на `main`.

## Стъпка 3 — Redeploy
- Vercel redeploy-ва production от push-натия commit към `main`.
- Проверявам на живо ключовите страници (начална, /search, страница на имот, /login, CRM вход) и потвърждавам, че live съвпада с този build.

## Какво НЕ се пипа
- Не се създава нов repo/project/branch/remix.
- Не се променя DNS/custom domain.
- Не се променя application код.
- `.env` НИКОГА не се качва в GitHub (съдържа backend ключове).

## Технически детайли
- Sync-ът на Lovable ↔ GitHub е двупосочен и автоматичен след свързване — няма ръчен push.
- Vercel production deploy се задейства от GitHub webhook при push към `main`.
- Ако стъпка 1 не предложи избор на съществуващо репо, алтернатива е GitHub connector + ръчен push — ще го предложа само ако стандартният път не сработи.
