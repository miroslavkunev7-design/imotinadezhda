# План за нови функции

Преди да започна, две важни уточнения:

### ⚠ Ограничения, които трябва да знаеш

1. **Facebook вход — не се поддържа от Lovable Cloud.** Нативно се поддържат само **Google** и **Apple** (плюс email/парола, телефон, SAML SSO). Ще добавя **Google** както искаш. За Facebook вариантите са:
   - (а) да пропуснем Facebook сега, или
   - (б) да свържем външен Supabase проект, където ти ръчно конфигурираш Facebook OAuth (по-сложна настройка).
   
   **По подразбиране ще направя само Google.** Кажи ако искаш да опитаме (б).

2. **PWA в Lovable preview-то няма да работи идеално** (service worker-ите се изключват в iframe-а на редактора). Ще се инсталира коректно само на **публикувания сайт** (imotinadezhda.lovable.app или собствен домейн). Това е нормално — просто публикувай след внедряване, за да го тестваш.

---

## Какво ще направя

### 1. PWA — Installable Desktop App
- `public/manifest.webmanifest` с:
  - `name: "Имоти Надежда"`, `short_name: "Надежда"`
  - `theme_color: "#8B1A2B"`, `background_color: "#ffffff"`
  - `display: "standalone"`, `start_url: "/"`
  - Икони 192×192 и 512×512 (генерирани от съществуващото лого, с бордо фон)
- `vite-plugin-pwa` с `NetworkFirst` за HTML и `navigateFallbackDenylist: [/^\/~oauth/]`
- Guard: SW регистрация само в продукция, никога в iframe/preview
- `<link rel="manifest">` + theme-color мета в root route head
- Бутон **"Инсталирай приложението"** в админ navbar:
  - Слуша `beforeinstallprompt` event
  - Показва се само когато браузърът поддържа инсталиране и още не е инсталирано
  - При клик извиква `prompt.prompt()`

### 2. Запомни ме (Remember me)
- Checkbox "Запомни ме" на `/login` (по подразбиране **включен**)
- Когато е включен → Supabase сесията се пази в `localStorage` (default — постоянна)
- Когато е изключен → сесията се пази в `sessionStorage` чрез `supabase.auth.setSession` flow или persist override; brokerа излиза при затваряне на browser-a
- Без промяна в `client.ts` (генериран файл) — реализирано чрез wrapper в login страницата

### 3. Google вход
- Извиквам `supabase--configure_social_auth` с `providers: ["google"]` (задължително за да работи провайдърът)
- Бутон "Влез с Google" над email формата на `/login`
- Използва `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin" })`
- Style: бяла карта с бордо border + Google G лого

### 4. QR код за мобилен вход
- Инсталирам `qrcode.react`
- На `/login` (само desktop, скрит на mobile) — секция "Сканирай за вход от телефон" с QR код, който сочи към `window.location.origin + "/login"`
- Аккуратен дизайн в златна рамка

---

## Файлове за промяна

- `vite.config.ts` — добавям `vite-plugin-pwa`
- `public/manifest.webmanifest` (нов)
- `public/icon-192.png`, `public/icon-512.png` (генерирани)
- `src/routes/__root.tsx` — manifest link + theme-color meta + SW регистрация с iframe guard
- `src/components/admin/admin-shell.tsx` — Install App бутон
- `src/routes/login.tsx` — Remember me checkbox + Google бутон + QR код
- Социален auth конфиг през tool call

---

**Потвърди:**
- ✅ Пропускаме Facebook (само Google)?
- ✅ Разбираш че PWA работи само на публикувания сайт, не в редактора?

След твоето "да" започвам.
