// Централизирана конфигурация за контактите на агенцията.
// При смяна — само тук, и се обновява навсякъде.

export type AgencyPhone = { display: string; tel: string; whatsapp: string };

export const AGENCY_PHONES: AgencyPhone[] = [
  { display: "0899 620 262", tel: "+359899620262", whatsapp: "359899620262" },
  { display: "0898 977 370", tel: "+359898977370", whatsapp: "359898977370" },
  { display: "0884 872 266", tel: "+359884872266", whatsapp: "359884872266" },
];

export const AGENCY = {
  name: "Недвижими имоти ИЛДЖ.ИА",
  shortName: "ИЛДЖ.ИА",
  phones: AGENCY_PHONES,
  // Основен телефон за бутони / tel: линкове
  phone: AGENCY_PHONES[0].tel,
  phoneDisplay: AGENCY_PHONES[0].display,
  whatsapp: AGENCY_PHONES[0].whatsapp,
  email: "office@imotinadezhda.bg",
  address: "гр. Бургас, България",
  // Партньорска препратка за ипотечен кредит
  mortgagePartnerUrl: "https://www.creditcenter.bg/calculator/",
};

// Кредитни консултанти, на които да изпращаме кандидатури за ипотечен кредит
export const MORTGAGE_PARTNERS = [
  { id: "plamen", name: "Пламен", email: "plamen@imotinadezhda.bg" },
  { id: "kalina", name: "Калина (Ай Банк)", email: "kalina@aibank.bg" },
] as const;

export function buildWhatsAppUrl(message: string, whatsapp: string = AGENCY.whatsapp) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

export function buildTelUrl(tel: string = AGENCY.phone) {
  return `tel:${tel}`;
}

// Прост ипотечен калкулатор: вноска при анюитетна схема
export function calcMonthlyPayment(principal: number, annualRatePct: number, years: number) {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}
