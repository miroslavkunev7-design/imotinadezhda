import { SHUMEN_BANKS } from "@/lib/shumen-banks";

export type DealSub = "izvlechenia" | "fishove" | "dogovor" | "imot" | "banka";

export const DEAL_SUBS: { id: DealSub; label: string }[] = [
  { id: "izvlechenia", label: "извлечения" },
  { id: "fishove", label: "Фишове" },
  { id: "dogovor", label: "Трудов Договор" },
  { id: "imot", label: "За имота" },
  { id: "banka", label: "Банка" },
];

export type BankCaseFile = {
  bankId: string;
  bankName: string;
  worker: string;
  sent: string;
  progress: string;
};

export function isStartedDeal(c: {
  deposit_amount?: number | null;
  deposit_status?: string | null;
  mortgage_data?: any;
}) {
  const left = String(c.deposit_status ?? "").toLowerCase().includes("остав");
  const amount = Number(c.deposit_amount) > 0;
  return !!(c.mortgage_data?.started_deal || (left && amount));
}

export function docBucket(documentType: string): DealSub | "other" {
  const t = String(documentType ?? "");
  if (t.includes("bank_statement")) return "izvlechenia";
  if (t.includes("payslip")) return "fishove";
  if (t.includes("employer_note") || (t.includes("contract") && !t.startsWith("guarantor:"))) return "dogovor";
  if (t.includes("property") || t.includes("imot") || t.includes("deed") || t.includes("скица")) return "imot";
  return "other";
}

export function bankFileLabel(c: { mortgage_data?: any }) {
  const named = String(c.mortgage_data?.bank_case?.bankName ?? "").trim();
  if (named) return named;
  const id = Object.keys(c.mortgage_data?.bank_apps ?? {})[0];
  if (!id) return "Банка";
  return SHUMEN_BANKS.find((b) => b.id === id)?.name ?? id;
}
