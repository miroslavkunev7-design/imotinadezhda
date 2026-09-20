/**
 * Лайф лихви по дата/ден — таблица с валидности.
 *
 * За всяка банка се пазят периоди с начална дата (`from`). Активният период е
 * последният, чиято начална дата е <= избрания ден. Лихвата е различна за
 * доходи от България (`bg`) и доходи от чужбина (`foreign`).
 */
export type IncomeOrigin = "bg" | "foreign";

export type RatePeriod = {
  from: string; // ISO дата, от която важи периодът
  bg: number;
  foreign: number;
};

/** Надбавка при доход от чужбина, когато банката няма отделна ставка. */
export const FOREIGN_INCOME_PREMIUM = 0.55;

export const DEFAULT_RATES: RatePeriod[] = [
  { from: "2025-01-01", bg: 2.65, foreign: 3.35 },
  { from: "2026-01-01", bg: 2.45, foreign: 3.1 },
  { from: "2026-07-01", bg: 2.35, foreign: 2.95 },
];

export const BANK_RATES: Record<string, RatePeriod[]> = {
  "Банка ДСК": [
    { from: "2025-01-01", bg: 2.55, foreign: 3.2 },
    { from: "2026-01-01", bg: 2.35, foreign: 2.95 },
    { from: "2026-07-01", bg: 2.25, foreign: 2.85 },
  ],
  "УниКредит Булбанк": [
    { from: "2025-01-01", bg: 2.6, foreign: 3.25 },
    { from: "2026-01-01", bg: 2.4, foreign: 3.0 },
    { from: "2026-07-01", bg: 2.3, foreign: 2.9 },
  ],
  ОББ: [
    { from: "2025-01-01", bg: 2.7, foreign: 3.4 },
    { from: "2026-01-01", bg: 2.5, foreign: 3.15 },
    { from: "2026-07-01", bg: 2.4, foreign: 3.05 },
  ],
  "Пощенска банка": [
    { from: "2025-01-01", bg: 2.75, foreign: 3.45 },
    { from: "2026-01-01", bg: 2.55, foreign: 3.2 },
    { from: "2026-07-01", bg: 2.45, foreign: 3.1 },
  ],
  Fibank: [
    { from: "2025-01-01", bg: 2.95, foreign: 3.65 },
    { from: "2026-01-01", bg: 2.75, foreign: 3.4 },
  ],
  ЦКБ: [
    { from: "2025-01-01", bg: 3.05, foreign: 3.8 },
    { from: "2026-01-01", bg: 2.85, foreign: 3.55 },
  ],
  "Райфайзен (KBC)": [
    { from: "2025-01-01", bg: 2.65, foreign: 3.3 },
    { from: "2026-01-01", bg: 2.45, foreign: 3.05 },
  ],
  "ProCredit Bank": [
    { from: "2025-01-01", bg: 3.15, foreign: 3.9 },
    { from: "2026-01-01", bg: 2.95, foreign: 3.65 },
  ],
  "Алианц Банк": [
    { from: "2025-01-01", bg: 2.9, foreign: 3.6 },
    { from: "2026-01-01", bg: 2.7, foreign: 3.35 },
  ],
  Инвестбанк: [
    { from: "2025-01-01", bg: 3.1, foreign: 3.85 },
    { from: "2026-01-01", bg: 2.9, foreign: 3.6 },
  ],
};

export const INCOME_ORIGIN_LABEL: Record<IncomeOrigin, string> = {
  bg: "Доход от България",
  foreign: "Доход от чужбина",
};

/** Форматира ISO дата като дд.мм.гггг. */
export function fmtRateDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("bg-BG");
}

export type LiveRate = {
  rate: number;
  origin: IncomeOrigin;
  bank: string | null;
  /** Начало на периода, от който важи лихвата. */
  validFrom: string;
  /** Денят, за който е изчислена лихвата. */
  asOf: string;
  /** true, когато няма отделна таблица за банката. */
  fallback: boolean;
  label: string;
};

/**
 * Изчислява актуалната („лайф“) лихва за банка, ден и произход на дохода.
 */
export function getLiveRate(
  bank: string | null | undefined,
  origin: IncomeOrigin = "bg",
  day: Date = new Date(),
): LiveRate {
  const key = (bank ?? "").trim();
  const table = (key && BANK_RATES[key]) || DEFAULT_RATES;
  const fallback = !(key && BANK_RATES[key]);

  const asOfMs = day.getTime();
  const active =
    table
      .filter((p) => new Date(p.from).getTime() <= asOfMs)
      .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
      .at(-1) ?? table[0];

  const base =
    origin === "foreign" ? (active.foreign ?? active.bg + FOREIGN_INCOME_PREMIUM) : active.bg;
  const rate = Math.round(base * 100) / 100;
  const asOf = day.toISOString().slice(0, 10);

  return {
    rate,
    origin,
    bank: key || null,
    validFrom: active.from,
    asOf,
    fallback,
    label: `${rate.toFixed(2)}% · ${INCOME_ORIGIN_LABEL[origin]} · валидна от ${fmtRateDate(active.from)}`,
  };
}

/** Месечна вноска (анюитет) — помощно за листчето. */
export function monthlyPayment(amount: number, ratePercent: number, years: number) {
  if (!amount || !years) return 0;
  const i = ratePercent / 100 / 12;
  const n = years * 12;
  if (i <= 0) return Math.round((amount / n) * 100) / 100;
  const m = (amount * i) / (1 - Math.pow(1 + i, -n));
  return Math.round(m * 100) / 100;
}
