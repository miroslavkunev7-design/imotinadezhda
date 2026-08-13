/** Официален курс EUR/BGN по валутния борд. */
export const EUR_BGN = 1.95583;

/** Община Шумен — данък при възмездно придобиване от 1.01.2026. */
export const SHUMEN_TRANSFER_TAX = 0.03;

/** Такса вписване в Имотния регистър. */
export const REGISTRY_RATE = 0.001;

/**
 * Тарифа за нотариалните такси, т. 8 — нотариален акт за недвижими имоти.
 * Сумите са в лева. Максимум 6000 лв. преди ДДС.
 */
export function notaryFeePoint8Bgn(interestBgn: number): number {
  const x = Math.max(0, interestBgn);
  if (x <= 100) return 30;
  if (x <= 1_000) return 30 + 0.015 * (x - 100);
  if (x <= 10_000) return 43.5 + 0.013 * (x - 1_000);
  if (x <= 50_000) return 160.5 + 0.008 * (x - 10_000);
  if (x <= 100_000) return 480.5 + 0.005 * (x - 50_000);
  if (x <= 500_000) return 730.5 + 0.002 * (x - 100_000);
  return Math.min(6000, 1530.5 + 0.001 * (x - 500_000));
}

export function withVat(bgn: number) {
  return bgn * 1.2;
}

export function calcMonthlyPayment(principal: number, annualRatePct: number, years: number) {
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRatePct / 100 / 12;
  if (!principal || principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export type NotaryBreakdown = {
  priceEur: number;
  loanEur: number;
  priceBgn: number;
  loanBgn: number;
  notarySaleBgn: number;
  notarySaleVatBgn: number;
  notaryMortgageBgn: number;
  notaryMortgageVatBgn: number;
  registryBgn: number;
  localTaxBgn: number;
  totalNotaryDeskBgn: number;
  monthlyEur: number;
  totalPaidEur: number;
  totalInterestEur: number;
};

/**
 * Нотариус при покупка с ипотека:
 * — т. 8 върху цената на сделката + 20% ДДС
 * — учредяване на ипотека: 50% от т. 8 върху сумата на кредита + 20% ДДС (т. 9)
 * — вписване 0.1% върху цената
 * — местен данък Шумен 3% върху цената (2026)
 */
export function calcNotaryDeal(opts: {
  priceEur: number;
  loanEur: number;
  years: number;
  ratePct: number;
}): NotaryBreakdown {
  const priceEur = Math.max(0, opts.priceEur);
  const loanEur = Math.max(0, opts.loanEur);
  const priceBgn = priceEur * EUR_BGN;
  const loanBgn = loanEur * EUR_BGN;
  const notarySaleBgn = notaryFeePoint8Bgn(priceBgn);
  const notarySaleVatBgn = withVat(notarySaleBgn);
  const notaryMortgageBgn = 0.5 * notaryFeePoint8Bgn(loanBgn);
  const notaryMortgageVatBgn = withVat(notaryMortgageBgn);
  const registryBgn = priceBgn * REGISTRY_RATE;
  const localTaxBgn = priceBgn * SHUMEN_TRANSFER_TAX;
  const monthlyEur = calcMonthlyPayment(loanEur, opts.ratePct, opts.years || 25);
  const months = Math.max(1, Math.round((opts.years || 25) * 12));
  const totalPaidEur = monthlyEur * months;
  return {
    priceEur,
    loanEur,
    priceBgn,
    loanBgn,
    notarySaleBgn,
    notarySaleVatBgn,
    notaryMortgageBgn,
    notaryMortgageVatBgn,
    registryBgn,
    localTaxBgn,
    totalNotaryDeskBgn: notarySaleVatBgn + notaryMortgageVatBgn + registryBgn + localTaxBgn,
    monthlyEur,
    totalPaidEur,
    totalInterestEur: Math.max(0, totalPaidEur - loanEur),
  };
}

export type DayFx = {
  date: string;
  eurBgn: number;
  usdBgn: number | null;
  gbpBgn: number | null;
};

export async function fetchDayFx(): Promise<DayFx> {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,GBP");
    const j = await r.json();
    const usd = Number(j.rates?.USD);
    const gbp = Number(j.rates?.GBP);
    return {
      date: String(j.date ?? new Date().toISOString().slice(0, 10)),
      eurBgn: EUR_BGN,
      usdBgn: usd ? EUR_BGN / usd : null,
      gbpBgn: gbp ? EUR_BGN / gbp : null,
    };
  } catch {
    return {
      date: new Date().toISOString().slice(0, 10),
      eurBgn: EUR_BGN,
      usdBgn: null,
      gbpBgn: null,
    };
  }
}

export function fmtBg(n: number, digits = 2) {
  return n.toLocaleString("bg-BG", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
