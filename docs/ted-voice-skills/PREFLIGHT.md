# PREFLIGHT – Тед Universal Voice Skills (06.11.2026)

Проверено read-only преди промените, от реалната среда (git, Vercel MCP, Supabase MCP).

## Production
- Домейн: https://imotinadezhda.bg
- GitHub: miroslavkunev7-design/imotinadezhda — **production branch: `live-site`** (не `main`). Всеки деплой е от commit на `live-site`.
- Vercel project: `disabled-old-imnad-do-not-deploy` (prj_MEZCBMZ0Ip8UYZ2rBmj6teLh3Ao4, team nadq-jeleva-s-projects). Името е историческо; именно този проект държи alias `imotinadezhda.bg` (проверено в alias списъка на всеки READY deployment). `imoti-nadezhda-ui` не обслужва домейна.
- Supabase: `hyvwfsmjbaynozceookv` (кодирано в mobile/crm/crm-data.js, api/*.js, mobile/site-data.js). `qcfqtnomldzbnzzxypgg` не се ползва от този код.
- Статичен сайт + Vercel functions (api/*.js, CommonJS, без build стъпка: `installCommand: ""`). Зависимостите са вендорени (api/tools.js е esbuild бандъл; api/_vendor за PDF).

## Съществуващият TED (не е пипан като идентичност/UX)
- Widget: `mobile/ash.js` (NDAsh) – чат, микрофон (MediaRecorder → файл), говор (/api/tts), skills меню (crm-assistant.js „АИ Качване на имот“, crm-collect.js „Събиране“).
- Оркестрация: `api/assistant.js` – Gemini с function calling: `crm(tool,input_json)` → `/api/tools`, `web_search`, `read_page`. Гласът се транскрибира в същия handler и влиза в същия текстов pipeline (един path за voice и text).
- Action gateway: `api/tools.js` – регистър с zod схеми, bearer token на служителя, `nd_is_staff()`, Supabase RLS през самия token (няма service role в tools).
- Auth/RLS: nd_* таблици със staff policies; storage bucket `nd-files` (private) със staff policies и публично четене само за снимки на публикувани имоти.

## Какво липсваше
- Операции с документи (merge/split/OCR/превод/класификация/сглобяване на извлечения) и връщане на реален файл.
- Резолвиране на получател + имейл с преглед/потвърждение; одит на действията; договор през Тед.
- Няма имейл доставчик в проекта (няма RESEND/SMTP ключ в env).
