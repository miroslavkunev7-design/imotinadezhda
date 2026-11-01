# Archive: BankMortgageDesk (tree `79c473f1`)

Exact CRM bank module from before sanitization delete `91c40cf` (2026-09-20).

## Flow (matches production screenshots)

1. **Инфо клиент** → button **Банки / кредит** / **Банки в Шумен**
2. Modal grid **Банки в Шумен** (brand-colored cards with branch photos)
3. Pick a bank → full desk: office background, ЦКР upload, sticky day rates, mortgage fields, **Изчисли вноска** / **Изчисли нотариус**, document stickies

Wiring at that commit lived in:

- `src/components/admin/client-details-sheet.tsx` → `BankMortgageDesk`
- `src/routes/admin.clients.tsx` → `BankMortgageDesk`

## Contained files

| Path | Role |
|------|------|
| `src/components/admin/bank-mortgage-desk.tsx` | Full UI desk |
| `src/assets/crm/banks/bank-*-branch.png` | Office/branch photos (incl. DSK) |
| `src/lib/bank-branch-photos.ts` | Photo map |
| `src/lib/shumen-banks.ts` | Per-bank colors, addresses, docs BG/abroad |
| `src/lib/bank-day-rates.ts` | Live scrape from **moitepari.bg** (not Nash/Modulo) |

## Current main vs this archive

Main now uses thinner `BankFlowModal` + `CreditBlock` (PR #4). This archive is the richer desk to re-wire later — **not** auto-imported.

## Restore recipe (later dedicated task)

```bash
git checkout 79c473f1 -- \
  src/components/admin/bank-mortgage-desk.tsx \
  src/assets/crm/banks \
  src/lib/bank-branch-photos.ts \
  src/lib/shumen-banks.ts \
  src/lib/bank-day-rates.ts
# then re-open BankMortgageDesk from client-details-sheet banks button
```

Also compare `bank-rates.functions.ts` at `79c473f1` for `getDayBankRates` if day scrape must run on the server again.
