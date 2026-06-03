# Pixel-perfect redesign — Имоти Надежда

Reference: file_8957.jpg. No improvisations.

## 1. Navbar (site-wide, replaces current `SiteHeader`)

- Full-width dark near-black bar (#0f0a0b), height ~110px desktop, ~70px mobile.
- Inside: a rounded "pill" track (dark bordeaux #2a0f14 with thin gold #C9A84C border) hosting nav links — centered/right-aligned.
- Nav items with small gold icons + white labels: `🏠 За продажба` · `🔑 Под наем` · `👥 За нас` · profile icon. Each link separated by faint gold divider, gold pill border on hover/active.
- Left: decorative **scroll/banner** panel — bordeaux gradient (#8B1A2B → #5E0F1D) shaped like a ribbon with curled ends and gold trim/inner stroke. Contains the white logo (house icon + "НЕДВИЖИМИ ИМОТИ • НАДЕЖДА •").
- The ribbon overlaps below the dark bar (~30px) for the scroll effect.
- Mobile: collapses ribbon scale, links shrink, profile stays visible.
- Applied to ALL pages by editing `src/components/site/site-header.tsx` (existing usage across routes remains).

## 2. Search/filter bar (home page)

Replaces the current wavy split panel in `src/components/site/luxury-real-estate.tsx`.

- Single full-width **bordeaux #8B1A2B rounded pill** (border-radius ~9999px), thin gold border, soft drop shadow.
- Inline fields with thin vertical gold dividers between each:
  - ГРАД (icon: pin) — value + chevron
  - КВАРТАЛ (icon: house)
  - ВИД ИМОТ (icon: building)
  - ЦЕНА (icon: tag) — "от 200000 - до 500000 €"
  - ПЛОЩ (icon: ruler) — "от 100 m² - до 200 m²"
- Each field: tiny gold icon left, uppercase gold micro-label on top, white value below.
- Right cluster: solid **gold pill button "ТЪРСИ"** with magnifier icon (bordeaux text), then plain text link `≡ Още филтри` in gold.

## 3. City cards (home page grid)

- 4-column grid (responsive 2 / 1 col below).
- Card: rounded-2xl (~24px), gold border, full-bleed panorama, dark gradient at bottom 60%.
- Top-left tiny uppercase white label `ВИЖ ГРАДА`.
- Bottom-left large white display name (city).
- Bottom-right circular bordeaux button with white arrow icon, gold ring.

## 4. Trust strip (bottom of home)

- Dark background band.
- 4 columns, each with gold icon + bold white title + small muted description: Сигурност / Коректност / Доверие / Локално знание.
- Right side: rounded **"Чат с консултант"** pill button — bordeaux fill, gold border, chat icon.

## Files to edit

- `src/components/site/site-header.tsx` — rewrite navbar (ribbon + dark pill nav).
- `src/components/site/luxury-real-estate.tsx` — replace search bar markup, city card visuals, trust strip block at bottom of `HomePage`.
- `src/styles.css` — add helper classes if needed (gold border, ribbon clip shadow).

No backend / data / routing changes.

## Out of scope

- Hero imagery, property cards, other sections not visible in the reference remain untouched.
- No new routes, no logic changes.
