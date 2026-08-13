/** Общи (клиент+сървър) помощници за извличане на данни от нотариален акт
 *  и генериране на договор за сделка / разписка за депозит. */

export type NotaryParty = {
  name?: string | null;
  egn?: string | null;
  id_card?: string | null;
  address?: string | null;
};

export type NotaryAct = {
  act_number?: string | null;
  act_volume?: string | null;
  act_register_number?: string | null;
  act_date?: string | null;
  notary_name?: string | null;
  notary_number?: string | null;
  sellers: NotaryParty[];
  buyers: NotaryParty[];
  property: {
    type?: string | null;
    cadastral_id?: string | null;
    address?: string | null;
    city?: string | null;
    quarter?: string | null;
    area_sqm?: number | null;
    common_parts_sqm?: number | null;
    ideal_parts?: string | null;
    floor?: string | null;
    building_description?: string | null;
    neighbours?: string | null;
  };
  price?: number | null;
  currency?: string | null;
  tax_valuation?: number | null;
  notes?: string | null;
};

export const NOTARY_EXTRACTION_PROMPT = `Ти си български нотариален специалист. Получаваш сканиран НОТАРИАЛЕН АКТ (или подобен документ за собственост).
Извлечи данните ТОЧНО както са изписани в документа. НЕ измисляй и НЕ допълвай липсващи стойности — за липсващо поле върни null.
Върни САМО валиден JSON без markdown, с точно тази структура:
{
 "act_number": null, "act_volume": null, "act_register_number": null, "act_date": null,
 "notary_name": null, "notary_number": null,
 "sellers": [{"name":null,"egn":null,"id_card":null,"address":null}],
 "buyers": [{"name":null,"egn":null,"id_card":null,"address":null}],
 "property": {"type":null,"cadastral_id":null,"address":null,"city":null,"quarter":null,
   "area_sqm":null,"common_parts_sqm":null,"ideal_parts":null,"floor":null,
   "building_description":null,"neighbours":null},
 "price": null, "currency": null, "tax_valuation": null, "notes": null
}
Числата са числа (без разделители и валута). Датите са във формат ГГГГ-ММ-ДД, ако е ясно.`;

export function parseNotaryJson(raw: string): NotaryAct {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  let parsed: any = {};
  if (start >= 0 && end > start) {
    try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch { parsed = {}; }
  }
  return {
    act_number: parsed.act_number ?? null,
    act_volume: parsed.act_volume ?? null,
    act_register_number: parsed.act_register_number ?? null,
    act_date: parsed.act_date ?? null,
    notary_name: parsed.notary_name ?? null,
    notary_number: parsed.notary_number ?? null,
    sellers: Array.isArray(parsed.sellers) ? parsed.sellers : [],
    buyers: Array.isArray(parsed.buyers) ? parsed.buyers : [],
    property: parsed.property && typeof parsed.property === "object" ? parsed.property : {},
    price: typeof parsed.price === "number" ? parsed.price : null,
    currency: parsed.currency ?? null,
    tax_valuation: typeof parsed.tax_valuation === "number" ? parsed.tax_valuation : null,
    notes: parsed.notes ?? null,
  };
}

const F = (v: unknown) => (v == null || v === "" ? "________________" : String(v));
const money = (v: number | null | undefined, cur?: string | null) =>
  v == null ? "________________" : `${Number(v).toLocaleString("bg-BG")} ${cur ?? "EUR"}`;

function partyLine(p: NotaryParty) {
  return `${F(p.name)}, ЕГН ${F(p.egn)}, л.к. ${F(p.id_card)}, с адрес ${F(p.address)}`;
}

export function propertyDescription(act: NotaryAct) {
  const p = act.property ?? {};
  const bits = [
    p.type ? String(p.type) : "недвижим имот",
    p.cadastral_id ? `с идентификатор по КККР ${p.cadastral_id}` : null,
    p.area_sqm != null ? `с площ ${p.area_sqm} кв.м` : null,
    p.common_parts_sqm != null ? `заедно с ${p.common_parts_sqm} кв.м общи части` : null,
    p.ideal_parts ? `и ${p.ideal_parts} ид. части от правото на строеж/дворното място` : null,
    p.floor ? `на етаж ${p.floor}` : null,
    p.address ? `находящ се на адрес ${p.address}` : null,
    p.quarter ? `кв. ${p.quarter}` : null,
    p.city ? `гр. ${p.city}` : null,
    p.neighbours ? `при съседи: ${p.neighbours}` : null,
  ].filter(Boolean);
  return bits.join(", ");
}

export function buildSaleContract(act: NotaryAct) {
  const today = new Date().toISOString().slice(0, 10);
  const sellers = act.sellers.length ? act.sellers.map(partyLine).join("\nи\n") : partyLine({});
  const buyers = act.buyers.length ? act.buyers.map(partyLine).join("\nи\n") : partyLine({});
  return `ПРЕДВАРИТЕЛЕН ДОГОВОР ЗА ПОКУПКО-ПРОДАЖБА НА НЕДВИЖИМ ИМОТ

Днес, ${today} г., между:

ПРОДАВАЧ:
${sellers}

и

КУПУВАЧ:
${buyers}

се сключи настоящият предварителен договор при следните условия:

I. ПРЕДМЕТ
1.1. Продавачът се задължава да продаде на Купувача следния свой собствен недвижим имот:
${propertyDescription(act)}.
1.2. Имотът е придобит от Продавача с Нотариален акт № ${F(act.act_number)}, том ${F(act.act_volume)}, рег. № ${F(act.act_register_number)}, дело от ${F(act.act_date)} г. на нотариус ${F(act.notary_name)}${act.notary_number ? `, рег. № ${act.notary_number} на НК` : ""}.

II. ЦЕНА И ПЛАЩАНЕ
2.1. Продажната цена е ${money(act.price, act.currency)}.
2.2. Купувачът заплаща задатък (депозит) в размер на ________________, платим при подписване на настоящия договор.
2.3. Остатъкът се заплаща в деня на изповядване на сделката пред нотариус.

III. СРОК
3.1. Страните се задължават да сключат окончателен договор в нотариална форма до ________________ г.

IV. ЗАДАТЪК И ОТГОВОРНОСТ (чл. 93 ЗЗД)
4.1. При отказ на Купувача задатъкът остава в полза на Продавача.
4.2. При отказ на Продавача той връща задатъка в двоен размер.
4.3. Всяка от страните може да иска обявяване на договора за окончателен по реда на чл. 19, ал. 3 ЗЗД.

V. ДЕКЛАРАЦИИ
5.1. Продавачът декларира, че имотът не е обременен с ипотеки, възбрани, вещни тежести и не е предмет на съдебен спор.
5.2. Разноските по сделката се поемат от ________________.

VI. ДРУГИ УСЛОВИЯ
6.1. Настоящият договор се състави в два еднообразни екземпляра — по един за всяка страна.
6.2. Посредник по сделката: „Имоти Надежда“.

ПРОДАВАЧ: ..............................    КУПУВАЧ: ..............................

ВНИМАНИЕ: документът е автоматично генериран от извлечените данни. Провери всяко поле преди подпис и се консултирай с нотариус.`;
}

export function buildDepositReceipt(
  act: NotaryAct,
  deposit: { amount: number | null; currency?: string | null; payer?: string | null },
) {
  const today = new Date().toISOString().slice(0, 10);
  const receiver = act.sellers[0]?.name ?? null;
  const payer = deposit.payer ?? act.buyers[0]?.name ?? null;
  return `РАЗПИСКА ЗА ПОЛУЧЕН ДЕПОЗИТ (ЗАДАТЪК)

Дата: ${today} г.
Място: ________________

Долуподписаният ${F(receiver)} получих от ${F(payer)}
сумата от ${money(deposit.amount, deposit.currency)},
представляваща депозит (задатък по чл. 93 ЗЗД) за следния недвижим имот:
${propertyDescription(act)}.

Договорена продажна цена: ${money(act.price, act.currency)}.
Депозитът се приспада от продажната цена при сключване на окончателния договор.

Основание за собственост: Нотариален акт № ${F(act.act_number)}, том ${F(act.act_volume)}, рег. № ${F(act.act_register_number)} от ${F(act.act_date)} г.

Посредник: „Имоти Надежда“.

Получил сумата: ..............................    Предал сумата: ..............................

ВНИМАНИЕ: документът е автоматично генериран от извлечените данни. Провери всяко поле преди подпис.`;
}
