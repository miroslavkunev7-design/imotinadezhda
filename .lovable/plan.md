# Плавно адаптивен homepage — една кодова база за desktop / tablet / mobile

## Цел
Един и същ компонент да се показва коректно на всяка ширина (от 320px до 1920px+), без всеки път да правим ръчни поправки за мобайл или таблет. Сменяш браузъра — layout-ът сам си намира позициите.

## Текущо състояние (защо има проблем)
- `src/components/site/luxury-real-estate.tsx` (~2000 реда) има на места **две паралелни версии** на едни и същи блокове: `hidden lg:block` (desktop) и `lg:hidden` (mobile). Всяка промяна трябва да се прави на две места.
- В `src/styles.css` `body:has(.luxury-page)` заключва `height: 100vh; overflow: hidden` на десктоп, и има отделна `@media (max-width: 1023px)` секция, която отключва скрол на мобайл. Това е "shrunk desktop" заключването.
- Hero видеото, search bar-ът, картите на градовете и навбарът имат фиксирани размери в px вместо `clamp()`.

## План

### 1. Дефиниране на 3 breakpoint-а (Tailwind v4 в `src/styles.css`)
```text
mobile:  < 768px   (default)
tablet:  768–1023px (md:)
desktop: ≥ 1024px  (lg:)
```
Това са стандартните Tailwind breakpoints — вече се ползват, само ще ги направим единствен източник на истина.

### 2. Премахване на дублираните mobile/desktop клонове
В `luxury-real-estate.tsx` обединявам двата варианта на:
- Hero search bar (редове ~838 и ~846) → един блок с responsive класове
- Hero секция (ред ~1277) → fluid височина с `clamp()`
- Cards grid → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Navbar панел → `site-header__art` единен със `aspect-ratio` + `clamp()` за max-height

### 3. Fluid типография и spacing
Заменям фиксирани px с `clamp(min, preferred, max)`:
- Logo "НАДЕЖДА": `clamp(20px, 3vw, 32px)`
- "НЕДВИЖИМИ ИМОТИ": `clamp(7px, 1vw, 12px)`
- Бутон "Търси": `clamp(44px, 5vw, 56px)`
- Card titles, padding-и на панели по същия начин

### 4. Отключване на скрола в `src/styles.css`
Премахвам `body:has(.luxury-page) { overflow: hidden }` lock-a (и съответната `@media (max-width: 1023px)` секция). Страницата става нормално скролируема навсякъде → еднакво поведение на десктоп и мобайл.

### 5. Hero видео — fluid височина
Сегашно: `h-[100dvh] min-h-[100svh]` (мобайл специфично).
Ново: `h-[clamp(420px,80svh,900px)]` — изглежда добре от телефон до 4K, без отделни branch-ове.

### 6. City cards
Един `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">` вместо horizontal scroll на мобайл + grid на десктоп.

## Какво НЕ променям
- Цветовете, шрифтовете, лого панела (бяло на бордо), gold accents — всичко визуално остава.
- Admin / CRM модулът — извън скоупа.
- Detail и listing страниците с city hero видеата — извън скоупа (работят добре вече).

## Технически детайли
- Файлове: `src/components/site/luxury-real-estate.tsx`, `src/components/site/site-header.tsx`, `src/styles.css`.
- Verify: browser tool на 375 / 768 / 1280 / 1920 ширини след промените.
- Update на memory: махам "desktop layout shrunk to 375px" правилото, защото вече ще е истински fluid.

## Компромис, който трябва да приемеш
Сегашният "shrunk desktop на мобайл" вид ще изчезне. На телефон ще виждаш **една колона** (карти под търсачката, не horizontal scroll), типографията ще е по-крупна и по-четима, а лого панелът ще е по-компактен. Това е стандартен mobile layout, а не умален десктоп.

Ако предпочиташ да запазя horizontal scroll за картите на мобайл или нещо друго от текущия мобайл вид — кажи преди да започна.
