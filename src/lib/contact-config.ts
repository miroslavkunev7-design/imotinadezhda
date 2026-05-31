// Централизирана конфигурация за контактите на агенцията.
// При смяна — само тук, и се обновява навсякъде.
export const AGENCY = {
  name: "Недвижими имоти Надежда",
  phone: "+359881234567",
  phoneDisplay: "+359 88 123 4567",
  whatsapp: "359881234567", // без +
  email: "office@imotinadezhda.bg",
  // Партньорска препратка за ипотечен кредит
  mortgagePartnerUrl: "https://www.creditcenter.bg/calculator/",
};

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${AGENCY.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function buildTelUrl() {
  return `tel:${AGENCY.phone}`;
}

// Прост ипотечен калкулатор: вноска при анюитетна схема
export function calcMonthlyPayment(principal: number, annualRatePct: number, years: number) {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}
