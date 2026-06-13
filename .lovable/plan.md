## Цел
1. Всички градски страници (Варна, Бургас, Нови пазар) да изглеждат като страницата на Шумен — full-screen hero видео + същата структура с квартали/секции.
2. Селата в "Около [Град]" да са подредени **по близост до града** (най-близкото първо), не по азбука.
3. Страницата "Около [Град]" да има за hero фон **същото видео** като съответния град (Шумен → shumen-hero, Варна → varna-hero, Бургас → burgas-hero, Нови пазар → shumen-hero).

## Подход

### A. Унифициран layout за градовете
- Прехвърлям `ShumenHomePage` като общ компонент `CityHomePage`, който приема `citySlug`, `cityLabel`, hero video URL, списък квартали и hero opening text.
- В `src/routes/cities.$slug.index.tsx` всеки слъг (`shumen`, `varna`, `burgas`, `novi-pazar`) рендира `CityHomePage` с правилните данни (видео, квартали от БД, име).
- Премахвам разклонението "desktop = Shumen, mobile = CityPage" — всички ползват новия еднообразен layout, отзивчив на mobile/desktop (както е Шумен сега).

### B. Сортиране по близост
Имам нужда от координати на града + всяко село. В момента `villages.lat/lng` са `NULL` за всичките 518 записа, а `cities` няма lat/lng.

Решение:
- Миграция: добавям `cities.lat NUMERIC`, `cities.lng NUMERIC` и сетвам стойностите за 4-те града.
- Миграция: **UPDATE** на `villages.lat/lng` с публично известни координати (от ГРАО / OSM). Това е чист seed (518 записа, 4 групи).
- В `getVillagesAround` сменям `ORDER BY name` с изчисление на дистанция (Haversine в SQL) спрямо координатите на града и сортиране по нея. Селата без координати → накрая (`NULLS LAST`).
- В UI добавям малка плочка "~X км" до името.

### C. Hero видео за "Около [Град]"
- Mapping в `cities.$slug.around.tsx`: city slug → asset URL (вече имам `shumen-hero.mp4`, `varna-hero.mp4`, `burgas-hero.mp4`; за Нови пазар ползвам `shumen-hero.mp4`).
- Hero секцията става full-screen с `<video autoplay loop muted playsinline>` + тъмен burgundy overlay + заглавие "Около [Град]" отгоре.
- Сетката със села остава отдолу на marble фон.

## Какво НЕ правя
- Не променям структурата на квартал-страниците.
- Не пипам админ панелите.
- Не местя данни — само добавям колони и попълвам координати.

## Файлове, които ще се пипнат
- `supabase/migrations/...` — нова миграция: `cities.lat/lng` + UPDATE-и за 4 града + UPDATE на координати за 518 села.
- `src/lib/villages.functions.ts` — нова логика: JOIN с `cities`, изчисление на разстояние, сортиране.
- `src/routes/cities.$slug.around.tsx` — hero видео секция.
- `src/components/site/shumen-home-page.tsx` → рефакториран в `CityHomePage(props)` или нов компонент + Шумен го ползва.
- `src/routes/cities.$slug.index.tsx` — рендирa `CityHomePage` за всички 4 града.

## Обем
Голяма миграция (1 SQL файл, ~520 UPDATE-а). Ще използвам кратки batch INSERT-и с координати от публични източници.

Потвърди и започвам — първо миграцията, после кодa.