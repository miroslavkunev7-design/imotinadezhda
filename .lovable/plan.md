## Цел

По-ясна йерархия (заглавия → ключови данни → CTA) и балансирани отстъпи на всички страници, при запазване на single-viewport (всичко в 100vh, без вертикален скрол).

## Принципи (важат за всички страници)

- Една ясна основна точка на фокус на екран — заглавие/hero/listing > всичко друго.
- Spacing scale: външни padding-и `px-4 md:px-6 lg:px-8`, секционни gap-и `gap-4 md:gap-6`.
- Header-ът държи фиксирана височина (~64px), останалото пространство се разпределя с `flex-1` + `min-h-0` за гридовете.
- Типография: H1 серифен (`font-display`), едно H1 на страница; категорийни лейбъли в `tracking-[0.18em] uppercase` злато; цените — bold burgundy.
- CTA-та: едно primary (gold), едно ghost — без три равностойни бутона.
- Картите — еднакъв aspect ratio в дадена секция, `auto-rows-fr` за равни редове.

## Промени по страница

### 1. Начална (`/`)
- Header → SearchBar центриран на ~45% от височината → grid с градове на долната половина.
- Hero текст оверлей с името "ИЛДЖ.ИА" + кратък подзаглавен ред (gold accent line) над SearchBar.
- Градовете: `grid-cols-2 md:grid-cols-4` с `aspect-[4/5]`, hover gold glow.

### 2. Списък за град (`/cities/$slug`)
- Top hero card (image + име + регион + бр. имоти) — компактен, ~30% от viewport.
- Под него: лента "Квартали" (хоризонтален скролер) — ~22%.
- Останалото: grid с препоръчани имоти, 3–4 колони, един ред.

### 3. Квартал (`/cities/$slug/districts/$district`)
- Лява колона (40%): hero image + meta (име, град, бр. имоти).
- Дясна колона (60%): grid от имоти 2×2.

### 4. Търсене (`/search`)
- Sticky filter bar отгоре (компактен, една линия на desktop).
- Под него: results grid `grid-cols-2 lg:grid-cols-4` + pagination отдолу.

### 5. Детайл на имот (`/properties/$id`)
- Ляво: галерия (60%) с главно изображение + 4 thumbnails.
- Дясно (40%): цена (H1), location, key specs (площ/спални/бани) в 3-колонна grid, CTA "Запитване" (gold) + "Обади се".

### 6. About / Contact
- Two-column hero: ляво заглавие + параграф, дясно изображение/контактна карта.

### 7. Login / Register
- Центрирана карта max-w-md, лого отгоре, форма, secondary линкове отдолу.

### 8. CRM (`/admin/*`)
- Sidebar фиксиран 240px, съдържание `flex-1 min-w-0`.
- Dashboard: stats cards `grid-cols-2 xl:grid-cols-4`, всеки еднаква височина.
- Таблиците: header sticky, scroll вътре в контейнера (не на цялата страница).

## Технически детайли

- Файлове, които ще се пипат: `src/components/site/luxury-real-estate.tsx` (Home, City, District, Search, Property), `src/routes/about.tsx`, `src/routes/login.tsx`, `src/components/admin/admin-shell.tsx`, `src/routes/admin.index.tsx`.
- Глобалното `html, body, #root { height: 100vh; overflow: hidden }` остава. Вътрешен скрол при нужда — само в специфични контейнери (таблици, дълги списъци с имоти) чрез `overflow-y-auto min-h-0`.
- Типографските и spacing настройки минават през Tailwind класове; токените в `src/styles.css` не се променят.
- Без промени по бизнес логика, рутове, данни или backend.

## Извън обхват

- Не променям цветовата схема, fonts, или backend.
- Не добавям нови страници/функции.
- Не пипам auth flow.

## Верификация

След промените: screenshot на всяка страница на 1440×900 (desktop) и 390×844 (mobile), проверка че няма скрол и че йерархията е спазена.