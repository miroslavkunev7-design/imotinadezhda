import type { DayBankRate } from "@/lib/bank-rates.functions";
import type { CreditBlockData } from "@/lib/banks-catalog";
import { monthlyPayment } from "@/lib/mortgage-rates";
import { SHUMEN_BANKS, type ShumenBank } from "@/lib/shumen-banks";

import type { ImotiProperty } from "./imoti-types";

export type ImotiDeskClient = {
  id: string;
  full_name: string;
  notes?: string | null;
  mortgage_data?: {
    bank_apps?: Record<string, Record<string, string>>;
    bank_case?: Record<string, string>;
    credit_block?: CreditBlockData | null;
  } | null;
};

export type BankDeskSavedCtx = {
  bank: ShumenBank;
  form: Record<string, string>;
  dayRate?: DayBankRate;
  mortgage_data: NonNullable<ImotiDeskClient["mortgage_data"]>;
};

export function imotiPropertyToDeskClient(property: ImotiProperty): ImotiDeskClient {
  const notes = `${property.city}, ${property.quarter} · € ${property.price.toLocaleString("bg-BG")}`;
  const block = property.creditBlock;
  const activeBankId = block
    ? SHUMEN_BANKS.find((b) => b.name === block.bank || b.short === block.bank)?.id
    : undefined;

  const baseForm: Record<string, string> = {
    price: String(property.price),
    amount: block ? String(block.amount) : String(Math.round(property.price * 0.8)),
    years: block ? String(block.years) : "25",
    own_funds: block ? String(block.downPayment) : String(Math.round(property.price * 0.2)),
    property: `${property.city}, ${property.quarter} — ${property.title}`,
  };

  const bank_apps: Record<string, Record<string, string>> = {};
  for (const b of SHUMEN_BANKS) {
    bank_apps[b.id] = activeBankId === b.id ? { ...baseForm } : { ...baseForm };
  }

  return {
    id: property.id,
    full_name: property.title,
    notes,
    mortgage_data: {
      ...(block ? { credit_block: block } : {}),
      bank_apps,
      ...(activeBankId && block
        ? {
            bank_case: {
              bankId: activeBankId,
              bankName: block.bank,
              progress: "подадена графа",
            },
          }
        : {}),
    },
  };
}

export function deskSaveToCreditBlock(
  ctx: BankDeskSavedCtx,
  propertyPrice: number,
): CreditBlockData | null {
  const { bank, form, dayRate } = ctx;
  const loan = Number(form.amount);
  if (!loan) return null;

  const years = Number(form.years) || 25;
  const own = Number(form.own_funds);
  const price = Number(form.price) || propertyPrice || (own ? loan + own : loan);
  const downPayment = Number.isFinite(own) && own > 0 ? own : Math.max(0, price - loan);
  const rate = dayRate?.rate ?? bank.rateToday;
  const payment = monthlyPayment(loan, rate, years);

  return {
    bank: bank.name,
    amount: loan,
    downPayment,
    years,
    rate,
    payment,
    savedAt: new Date().toISOString(),
  };
}
