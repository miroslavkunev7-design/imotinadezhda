/**
 * Задължителен списък документи за ипотечен кредит + помощници за
 * последните 12 месеца. Използва се от прозорчето с документите в тефтера.
 */

export const BG_MONTHS = [
  "Януари",
  "Февруари",
  "Март",
  "Април",
  "Май",
  "Юни",
  "Юли",
  "Август",
  "Септември",
  "Октомври",
  "Ноември",
  "Декември",
] as const;

export type MonthSlot = { key: string; label: string; short: string };

/** Последните 12 месеца, започвайки от текущия и назад. */
export function lastTwelveMonths(from: Date = new Date()): MonthSlot[] {
  const out: MonthSlot[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const m = d.getMonth();
    out.push({
      key: `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}`,
      label: `${BG_MONTHS[m]} ${d.getFullYear()}`,
      short: `${BG_MONTHS[m]!.slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  return `${BG_MONTHS[idx] ?? m} ${y}`;
}

export type MortgageDocReq = {
  id: string;
  label: string;
  kind: "monthly" | "single";
  /** Кратко пояснение под името. */
  hint?: string;
  /** AI проверка на месеца при качване. */
  monthCheck?: boolean;
};

/** Номерирани изисквания — редът е номерацията в листчето. */
export const MORTGAGE_DOC_REQS: MortgageDocReq[] = [
  {
    id: "payslip",
    label: "Фиш от работна заплата — 12 месеца",
    kind: "monthly",
    monthCheck: true,
    hint: "По един фиш за всеки от последните 12 месеца",
  },
  { id: "contract", label: "Трудов договор", kind: "single" },
  {
    id: "bank_statement",
    label: "Извлечение от банкова сметка — 12 месеца",
    kind: "monthly",
    monthCheck: true,
    hint: "Месечни извлечения за последните 12 месеца",
  },
  { id: "art87", label: "Служебна бележка по чл. 87 (ДОПК)", kind: "single" },
  { id: "id_front", label: "Лична карта — лице (за ЦКР)", kind: "single" },
  { id: "id_back", label: "Лична карта — гръб (за ЦКР)", kind: "single" },
];

/** Ключ за `client_documents.document_type`. */
export function mortgageDocType(reqId: string, month?: string): string {
  return month ? `${reqId}:${month}` : reqId;
}
