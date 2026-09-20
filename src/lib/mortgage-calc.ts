/**
 * Кредитен калкулатор + ЦКР оценка + автоматични нотариални такси.
 *
 * Всички изчисления са чисти функции без зависимости, за да могат да се ползват
 * и на сървъра, и в браузъра.
 */

export const BGN_PER_EUR = 1.95583;

export type Currency = "EUR" | "BGN";

export function toBGN(amount: number, currency: Currency) {
  return currency === "BGN" ? amount : amount * BGN_PER_EUR;
}

export function fromBGN(amountBGN: number, currency: Currency) {
  return currency === "BGN" ? amountBGN : amountBGN / BGN_PER_EUR;
}

export function money(n: number, currency: Currency = "EUR") {
  return `${(Math.round(n * 100) / 100).toLocaleString("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/* ------------------------------------------------------------------ вноска */

export const MIN_TERM_YEARS = 1;
export const MAX_TERM_YEARS = 35;
export const TERM_YEARS_OPTIONS: number[] = Array.from(
  { length: MAX_TERM_YEARS - MIN_TERM_YEARS + 1 },
  (_, i) => MIN_TERM_YEARS + i,
);

export function clampTermYears(years: number) {
  if (!Number.isFinite(years)) return 25;
  return Math.min(MAX_TERM_YEARS, Math.max(MIN_TERM_YEARS, Math.round(years)));
}

export type LoanParams = {
  /** Цена на имота */
  price: number;
  /** Собствено участие (самоучастие) */
  downPayment: number;
  /** Годишна лихва в % */
  ratePercent: number;
  /** Срок в години (1–35) */
  years: number;
  /** Месечна такса за поддръжка/застраховки (по желание) */
  monthlyFees?: number;
};

export type LoanResult = {
  principal: number;
  ltv: number;
  years: number;
  months: number;
  ratePercent: number;
  monthlyPayment: number;
  monthlyTotal: number;
  totalPaid: number;
  totalInterest: number;
  /** Годишен процент на разходите (приблизително, при включени месечни такси). */
  aprPercent: number;
};

export function annuity(principal: number, ratePercent: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const i = ratePercent / 100 / 12;
  if (i <= 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

export function calcLoan(p: LoanParams): LoanResult {
  const years = clampTermYears(p.years);
  const months = years * 12;
  const principal = Math.max(0, (p.price || 0) - (p.downPayment || 0));
  const monthlyPayment = Math.round(annuity(principal, p.ratePercent || 0, months) * 100) / 100;
  const fees = Math.max(0, p.monthlyFees || 0);
  const monthlyTotal = Math.round((monthlyPayment + fees) * 100) / 100;
  const totalPaid = Math.round(monthlyTotal * months * 100) / 100;
  const totalInterest = Math.round((monthlyPayment * months - principal) * 100) / 100;

  // Приблизителен ГПР: лихвата, при която вноската включва и месечните такси.
  let aprPercent = p.ratePercent || 0;
  if (principal > 0 && fees > 0) {
    let lo = 0;
    let hi = 60;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (annuity(principal, mid, months) > monthlyTotal) hi = mid;
      else lo = mid;
    }
    aprPercent = Math.round(((lo + hi) / 2) * 100) / 100;
  }

  return {
    principal: Math.round(principal * 100) / 100,
    ltv: p.price > 0 ? Math.round((principal / p.price) * 1000) / 10 : 0,
    years,
    months,
    ratePercent: p.ratePercent || 0,
    monthlyPayment,
    monthlyTotal,
    totalPaid,
    totalInterest,
    aprPercent,
  };
}

export type ScheduleRow = {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  balance: number;
};

/** Погасителен план (анюитетен). */
export function amortizationSchedule(
  principal: number,
  ratePercent: number,
  years: number,
): ScheduleRow[] {
  const months = clampTermYears(years) * 12;
  const i = (ratePercent || 0) / 100 / 12;
  const payment = annuity(principal, ratePercent || 0, months);
  const rows: ScheduleRow[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * i;
    const principalPart = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - principalPart);
    rows.push({
      month: m,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principalPart * 100) / 100,
      payment: Math.round((interest + principalPart) * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }
  return rows;
}

/* --------------------------------------------------------------------- ЦКР */

export type CcrStatus =
  | "regular" // редовен
  | "delay_30" // просрочие до 30 дни
  | "delay_90" // просрочие 31–90 дни
  | "delay_180" // просрочие над 90 дни
  | "written_off"; // предоговорен/отписан кредит

export const CCR_STATUS_LABEL: Record<CcrStatus, string> = {
  regular: "Редовен — без просрочия",
  delay_30: "Просрочие до 30 дни",
  delay_90: "Просрочие 31–90 дни",
  delay_180: "Просрочие над 90 дни",
  written_off: "Предоговорен / отписан кредит",
};

export type CcrInput = {
  /** Нетен месечен доход на домакинството */
  netIncome: number;
  /** Общо месечни задължения по други кредити (вноски) */
  existingObligations: number;
  /** Усвоени лимити по кредитни карти и овърдрафт (общо) */
  cardLimits: number;
  /** Брой активни кредити по ЦКР */
  activeLoans: number;
  /** Най-лош статус по ЦКР */
  status: CcrStatus;
  /** Издържани лица */
  dependants: number;
  /** Планираната месечна вноска по новия кредит */
  newPayment: number;
};

export type CcrResult = {
  /** Задължения/доход в % (DTI) */
  dti: number;
  /** Максимална допустима вноска при лимит 50% DTI */
  maxPayment: number;
  /** Оставащи средства след всички вноски и издръжка */
  freeCash: number;
  /** Скор 0–100 */
  score: number;
  verdict: "approve" | "review" | "reject";
  verdictLabel: string;
  notes: string[];
};

/** 5% от усвоените лимити по карти се третират като месечно задължение. */
export const CARD_LIMIT_MONTHLY_RATE = 0.05;
/** Максимално допустимо съотношение вноски/доход. */
export const MAX_DTI = 50;
/** Минимална издръжка на човек (BGN/EUR според въведената валута). */
export const LIVING_COST_PER_PERSON = 300;

export function assessCcr(input: CcrInput): CcrResult {
  const income = Math.max(0, input.netIncome || 0);
  const cardMonthly = Math.max(0, input.cardLimits || 0) * CARD_LIMIT_MONTHLY_RATE;
  const obligations = Math.max(0, input.existingObligations || 0) + cardMonthly;
  const total = obligations + Math.max(0, input.newPayment || 0);
  const dti = income > 0 ? Math.round((total / income) * 1000) / 10 : 0;
  const maxPayment = Math.round(Math.max(0, (income * MAX_DTI) / 100 - obligations) * 100) / 100;
  const living = LIVING_COST_PER_PERSON * (1 + Math.max(0, input.dependants || 0));
  const freeCash = Math.round((income - total - living) * 100) / 100;

  const notes: string[] = [];
  let score = 100;

  if (income <= 0) {
    notes.push("Липсва въведен нетен доход.");
    score -= 40;
  }
  if (dti > MAX_DTI) {
    notes.push(`Съотношението вноски/доход е ${dti}% — над лимита ${MAX_DTI}%.`);
    score -= Math.min(45, (dti - MAX_DTI) * 1.5 + 15);
  } else if (dti > 40) {
    notes.push(`Съотношението вноски/доход е ${dti}% — близо до лимита.`);
    score -= 10;
  }
  if (freeCash < 0) {
    notes.push("След вноските остават недостатъчно средства за издръжка.");
    score -= 20;
  }
  if (cardMonthly > 0) {
    notes.push(
      `Кредитни карти/овърдрафт добавят ${Math.round(cardMonthly * 100) / 100} към месечните задължения (5% от лимита).`,
    );
  }
  if ((input.activeLoans || 0) >= 4) {
    notes.push(`${input.activeLoans} активни кредита по ЦКР — банките ще искат обединяване.`);
    score -= 12;
  } else if ((input.activeLoans || 0) >= 2) {
    score -= 4;
  }

  switch (input.status) {
    case "delay_30":
      score -= 10;
      notes.push("Просрочие до 30 дни — приемливо за повечето банки, но се обяснява писмено.");
      break;
    case "delay_90":
      score -= 30;
      notes.push("Просрочие 31–90 дни — очаквайте отказ при част от банките.");
      break;
    case "delay_180":
      score -= 55;
      notes.push(
        "Просрочие над 90 дни — кандидатстването е препоръчително след изчистване на ЦКР.",
      );
      break;
    case "written_off":
      score -= 70;
      notes.push("Предоговорен/отписан кредит — почти всички банки отказват.");
      break;
    default:
      notes.push("Чисто ЦКР — без просрочия.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict: CcrResult["verdict"] = score >= 70 ? "approve" : score >= 45 ? "review" : "reject";
  const verdictLabel =
    verdict === "approve"
      ? "Голям шанс за одобрение"
      : verdict === "review"
        ? "Нужна е допълнителна проверка"
        : "Висок риск от отказ";

  return { dti, maxPayment, freeCash, score, verdict, verdictLabel, notes };
}

/* --------------------------------------------------- нотариални такси (BG) */

type TariffBracket = { upTo: number; base: number; rate: number; over: number };

/** Тарифа за нотариалните такси, чл. 8 — удостоверяван материален интерес в лева. */
const NOTARY_TARIFF: TariffBracket[] = [
  { upTo: 100, base: 30, rate: 0, over: 0 },
  { upTo: 1_000, base: 30, rate: 1.5, over: 100 },
  { upTo: 10_000, base: 43.5, rate: 1.3, over: 1_000 },
  { upTo: 50_000, base: 160.5, rate: 0.8, over: 10_000 },
  { upTo: 100_000, base: 480.5, rate: 0.5, over: 50_000 },
  { upTo: 500_000, base: 730.5, rate: 0.2, over: 100_000 },
  { upTo: Infinity, base: 1_530.5, rate: 0.1, over: 500_000 },
];

export const NOTARY_FEE_MAX_BGN = 6_000;
export const VAT_RATE = 20;
/** Такса вписване в Агенция по вписванията — 0.1% от материалния интерес. */
export const REGISTRY_RATE = 0.1;
export const REGISTRY_MIN_BGN = 10;
/** Местен данък при прехвърляне — по наредба на общината. */
export const DEFAULT_LOCAL_TAX_RATE = 2.5;

/** Нотариална такса по тарифата (без ДДС), изчислена в лева. */
export function notaryTariffBGN(interestBGN: number) {
  const v = Math.max(0, interestBGN || 0);
  const b = NOTARY_TARIFF.find((x) => v <= x.upTo)!;
  const fee = b.base + ((v - b.over) * b.rate) / 100;
  return Math.round(Math.min(NOTARY_FEE_MAX_BGN, Math.max(30, fee)) * 100) / 100;
}

export type NotaryInput = {
  /** Цена по нотариалния акт */
  price: number;
  /** Данъчна оценка (ако е по-висока, тя е материалният интерес) */
  taxValuation?: number;
  /** Размер на кредита — за нотариалния акт за договорна ипотека */
  loanAmount?: number;
  /** Валута на въведените суми */
  currency: Currency;
  /** Ставка на местния данък в % (Шумен 2.5%, различна по общини) */
  localTaxRate?: number;
  /** Учредява ли се договорна ипотека */
  withMortgage?: boolean;
  /** Кой плаща — влияе само на разбивката по страни */
  splitFees?: boolean;
};

export type NotaryFeeLine = {
  key: string;
  label: string;
  amount: number;
  note?: string;
  payer: "buyer" | "seller" | "shared";
};

export type NotaryResult = {
  currency: Currency;
  interest: number;
  lines: NotaryFeeLine[];
  total: number;
  buyerTotal: number;
  sellerTotal: number;
  /** Общо разходи като % от цената */
  percentOfPrice: number;
};

/**
 * Автоматично изчисление на нотариалните и съпътстващите такси по
 * въведените данни за сделката.
 */
export function calcNotaryFees(input: NotaryInput): NotaryResult {
  const cur = input.currency;
  const priceBGN = toBGN(Math.max(0, input.price || 0), cur);
  const valuationBGN = toBGN(Math.max(0, input.taxValuation || 0), cur);
  const interestBGN = Math.max(priceBGN, valuationBGN);
  const loanBGN = toBGN(Math.max(0, input.loanAmount || 0), cur);
  const localRate = input.localTaxRate ?? DEFAULT_LOCAL_TAX_RATE;

  const lines: NotaryFeeLine[] = [];
  const add = (
    key: string,
    label: string,
    amountBGN: number,
    payer: NotaryFeeLine["payer"],
    note?: string,
  ) => {
    if (amountBGN <= 0) return;
    lines.push({
      key,
      label,
      amount: Math.round(fromBGN(amountBGN, cur) * 100) / 100,
      note,
      payer,
    });
  };

  const deedFee = notaryTariffBGN(interestBGN);
  add("notary_deed", "Нотариална такса — нотариален акт", deedFee, "buyer", "Тарифа чл. 8");
  add(
    "notary_deed_vat",
    "ДДС върху нотариалната такса",
    (deedFee * VAT_RATE) / 100,
    "buyer",
    "20%",
  );

  const registry = Math.max(REGISTRY_MIN_BGN, (interestBGN * REGISTRY_RATE) / 100);
  add("registry", "Такса вписване (Агенция по вписванията)", registry, "buyer", "0.1%");

  const localTax = (interestBGN * localRate) / 100;
  add("local_tax", "Местен данък при прехвърляне", localTax, "buyer", `${localRate}%`);

  if (input.withMortgage && loanBGN > 0) {
    const mFee = notaryTariffBGN(loanBGN) / 2;
    add("mortgage_deed", "Нотариална такса — договорна ипотека", mFee, "buyer", "50% от тарифата");
    add(
      "mortgage_deed_vat",
      "ДДС върху таксата за ипотеката",
      (mFee * VAT_RATE) / 100,
      "buyer",
      "20%",
    );
    add(
      "mortgage_registry",
      "Такса вписване на ипотеката",
      Math.max(REGISTRY_MIN_BGN, (loanBGN * REGISTRY_RATE) / 100),
      "buyer",
      "0.1%",
    );
  }

  // Удостоверяване на подписи и преписи — фиксирани по тарифата.
  add("certificates", "Удостоверявания, преписи и справки", 60, "buyer", "по тарифа");

  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const share = (payer: NotaryFeeLine["payer"]) =>
    Math.round(lines.filter((l) => l.payer === payer).reduce((s, l) => s + l.amount, 0) * 100) /
    100;

  let buyerTotal = share("buyer") + share("shared") / 2;
  let sellerTotal = share("seller") + share("shared") / 2;
  if (input.splitFees) {
    buyerTotal = Math.round((total / 2) * 100) / 100;
    sellerTotal = Math.round((total / 2) * 100) / 100;
  }

  const price = Math.max(0, input.price || 0);
  return {
    currency: cur,
    interest: Math.round(fromBGN(interestBGN, cur) * 100) / 100,
    lines,
    total,
    buyerTotal: Math.round(buyerTotal * 100) / 100,
    sellerTotal: Math.round(sellerTotal * 100) / 100,
    percentOfPrice: price > 0 ? Math.round((total / price) * 1000) / 10 : 0,
  };
}
