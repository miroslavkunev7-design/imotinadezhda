/** Попълване на агенционни документи от клиент + имот + сделка. */

export const AGENCY_NAME = "„Имоти Надежда“";
export const BLANK = "________________";

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  preliminary: "Предварителен договор",
  brokerage: "Комисионен договор",
  viewing: "Огледен лист",
  power_of_attorney: "Пълномощно",
  rent: "Договор за наем",
  sale: "Продажба",
  other: "Друг",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Чернова",
  final: "Финален",
  pending_signature: "Чака подпис",
  signed: "Подписан",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "апартамент",
  house: "къща",
  office: "офис",
  land: "парцел",
  commercial: "търговски обект",
};

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  buyer: "купувач",
  seller: "продавач",
  tenant: "наемател",
  landlord: "наемодател",
};

export type ContractTemplateSeed = {
  name: string;
  contract_type: string;
  template_content: string;
  variables: string[];
};

export type ContractParty = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  id_number?: string | null;
  address?: string | null;
  license_number?: string | null;
};

export type ContractFillInput = {
  client?:
    | (ContractParty & {
        client_type?: string | null;
        notes?: string | null;
        deal_stage?: string | null;
        mortgage_data?: unknown;
        city?: string | null;
        quarter?: string | null;
      })
    | null;
  property?: {
    title?: string | null;
    address?: string | null;
    price?: number | null;
    currency?: string | null;
    area_sqm?: number | null;
    rooms?: number | null;
    property_type?: string | null;
    city?: string | null;
    quarter?: string | null;
    floor?: number | null;
  } | null;
  owner?: ContractParty | null;
  broker?: ContractParty | null;
  notes?: string | null;
  commission_pct?: number | null;
  extra?: Record<string, string>;
};

const ALIASES: Record<string, string[]> = {
  client_name: ["име", "клиент", "купувач"],
  client_egn: ["егн", "егн_клиент"],
  client_phone: ["телефон", "телефон_клиент"],
  client_email: ["имейл"],
  client_address: ["адрес_клиент"],
  client_type: ["качество"],
  client_city: [],
  property_title: ["имот"],
  property_address: ["адрес"],
  price: ["цена"],
  area: ["площ"],
  city: ["град"],
  quarter: ["квартал"],
  rooms: ["стаи"],
  property_type: ["вид_имот"],
  floor: ["етаж"],
  date: ["дата"],
  owner_name: ["собственик", "продавач"],
  owner_egn: ["егн_собственик"],
  owner_address: ["адрес_собственик"],
  owner_phone: ["телефон_собственик"],
  broker_name: ["брокер"],
  broker_phone: ["телефон_брокер"],
  broker_license: ["лиценз"],
  agency: ["агенция"],
  notes: ["бележки"],
  deal_stage: ["етап"],
  commission: ["комисиона"],
};

export function formatBgDate(d = new Date()): string {
  return d.toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  const cur = (currency || "EUR").toUpperCase();
  return `${Number(value).toLocaleString("bg-BG")} ${cur}`;
}

export function extractClientEgn(mortgageData: unknown): string {
  if (!mortgageData || typeof mortgageData !== "object") return "";
  const md = mortgageData as Record<string, unknown>;
  if (typeof md.egn === "string" && md.egn.trim()) return md.egn.trim();
  const identity = md.identity as Record<string, unknown> | undefined;
  if (typeof identity?.egn === "string" && identity.egn.trim()) return identity.egn.trim();
  const apps = md.bank_apps;
  if (apps && typeof apps === "object") {
    for (const app of Object.values(apps as Record<string, unknown>)) {
      if (app && typeof app === "object") {
        const egn = (app as Record<string, unknown>).egn;
        if (typeof egn === "string" && egn.trim()) return egn.trim();
      }
    }
  }
  return "";
}

function put(out: Record<string, string>, key: string, value: string) {
  out[key] = value;
  for (const alias of ALIASES[key] ?? []) out[alias] = value;
}

export function buildFillValues(input: ContractFillInput): Record<string, string> {
  const out: Record<string, string> = {};
  const client = input.client;
  const property = input.property;
  const owner = input.owner;
  const broker = input.broker;
  const city = property?.city || client?.city || "";
  const address = property?.address || client?.address || "";

  put(out, "client_name", client?.full_name ?? "");
  put(out, "client_egn", extractClientEgn(client?.mortgage_data) || "");
  put(out, "client_phone", client?.phone ?? "");
  put(out, "client_email", client?.email ?? "");
  put(
    out,
    "client_address",
    client?.address || [client?.city, client?.quarter].filter(Boolean).join(", "),
  );
  put(
    out,
    "client_type",
    CLIENT_TYPE_LABELS[client?.client_type ?? ""] ?? client?.client_type ?? "",
  );
  put(out, "client_city", client?.city ?? "");
  put(out, "property_title", property?.title ?? "");
  put(out, "property_address", address);
  put(out, "price", formatMoney(property?.price, property?.currency));
  put(out, "area", property?.area_sqm != null ? `${property.area_sqm}` : "");
  put(out, "city", city);
  put(out, "quarter", property?.quarter || client?.quarter || "");
  put(out, "rooms", property?.rooms != null ? String(property.rooms) : "");
  put(
    out,
    "property_type",
    PROPERTY_TYPE_LABELS[property?.property_type ?? ""] ?? property?.property_type ?? "",
  );
  put(out, "floor", property?.floor != null ? String(property.floor) : "");
  put(out, "date", formatBgDate());
  put(out, "owner_name", owner?.full_name ?? "");
  put(out, "owner_egn", owner?.id_number ?? "");
  put(out, "owner_address", owner?.address ?? "");
  put(out, "owner_phone", owner?.phone ?? "");
  put(out, "broker_name", broker?.full_name ?? "");
  put(out, "broker_phone", broker?.phone ?? "");
  put(out, "broker_license", broker?.license_number ?? "");
  put(out, "agency", AGENCY_NAME);
  put(out, "notes", input.notes || client?.notes || "");
  put(out, "deal_stage", client?.deal_stage ?? "");
  put(
    out,
    "commission",
    input.commission_pct != null ? `${(input.commission_pct * 100).toFixed(2)}%` : "3%",
  );

  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) out[k] = v;
  }
  return out;
}

export function fillPlaceholders(
  template: string,
  values: Record<string, string>,
  blank = BLANK,
): string {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, raw: string) => {
    const key = String(raw).trim();
    const v = values[key];
    if (v == null || String(v).trim() === "") return blank;
    return String(v);
  });
}

export function listUnfilled(content: string, blank = BLANK): string[] {
  const found = content.match(new RegExp(blank.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  return found ?? [];
}

export function suggestedTitle(
  templateName: string,
  clientName?: string | null,
  propertyTitle?: string | null,
): string {
  const bits = [templateName, clientName, propertyTitle].filter(Boolean);
  return bits.join(" — ").slice(0, 200);
}

export function buildPrintableHtml(title: string, content: string): string {
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <title>${title.replace(/</g, "")}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; max-width: 210mm; margin: 18mm auto; color: #111; }
    h1 { font-size: 18pt; text-align: center; margin: 0 0 16pt; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 12.5pt; line-height: 1.45; margin: 0; }
    .note { margin-top: 18pt; font-size: 9pt; color: #555; }
    @media print { body { margin: 14mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${title.replace(/</g, "")}</h1>
  <pre>${escaped}</pre>
  <p class="note">Документът е генериран автоматично от CRM на ${AGENCY_NAME}. Проверете всяко поле преди подпис.</p>
</body>
</html>`;
}

const VARS = [
  "client_name",
  "client_egn",
  "client_phone",
  "client_email",
  "client_address",
  "client_type",
  "property_title",
  "property_address",
  "price",
  "area",
  "city",
  "quarter",
  "rooms",
  "property_type",
  "floor",
  "date",
  "owner_name",
  "owner_egn",
  "owner_address",
  "owner_phone",
  "broker_name",
  "broker_phone",
  "broker_license",
  "agency",
  "notes",
  "commission",
];

export const DEFAULT_CONTRACT_TEMPLATES: ContractTemplateSeed[] = [
  {
    name: "Предварителен договор за покупко-продажба",
    contract_type: "preliminary",
    variables: VARS,
    template_content: `ПРЕДВАРИТЕЛЕН ДОГОВОР
за покупко-продажба на недвижим имот

Днес, {{дата}} г., в гр. {{град}}, между:

ПРОДАВАЧ:
{{собственик}}, ЕГН {{егн_собственик}}, с адрес {{адрес_собственик}}, тел. {{телефон_собственик}},

и

КУПУВАЧ:
{{име}}, ЕГН {{егн}}, с адрес {{адрес_клиент}}, тел. {{телефон}}, имейл {{имейл}},

при посредничеството на {{агенция}}, брокер {{брокер}} (тел. {{телефон_брокер}}, рег. № {{лиценз}}),

се сключи настоящият предварителен договор при следните условия:

I. ПРЕДМЕТ
1.1. Продавачът се задължава да прехвърли на Купувача правото на собственост върху следния имот:
{{вид_имот}} „{{имот}}“, с площ {{площ}} кв.м, {{стаи}} стаи, етаж {{етаж}}, находящ се в {{град}}, {{квартал}}, адрес {{адрес}}.
1.2. Купувачът се задължава да заплати уговорената цена и да приеме имота.

II. ЦЕНА И ПЛАЩАНЕ
2.1. Продажната цена е {{цена}}.
2.2. При подписване на настоящия договор Купувачът заплаща задатък (депозит) в размер на ${BLANK}, който се приспада от цената.
2.3. Остатъкът се заплаща в деня на изповядване на окончателния договор пред нотариус.

III. СРОК
3.1. Страните се задължават да сключат окончателен договор в нотариална форма до ${BLANK} г.

IV. ЗАДАТЪК И ОТГОВОРНОСТ (чл. 93 ЗЗД)
4.1. При отказ на Купувача задатъкът остава в полза на Продавача.
4.2. При отказ на Продавача той връща задатъка в двоен размер.
4.3. Всяка от страните може да иска обявяване на договора за окончателен по реда на чл. 19, ал. 3 ЗЗД.

V. ДЕКЛАРАЦИИ
5.1. Продавачът декларира, че имотът не е обременен с ипотеки, възбрани и вещни тежести и не е предмет на съдебен спор, освен ако друго е уговорено писмено.
5.2. Разноските по сделката (нотариални такси, вписвания, комисиона) се поемат съгласно уговорката на страните и комисионния договор с {{агенция}}.

VI. ДРУГИ УСЛОВИЯ
6.1. Настоящият договор се състави в два еднообразни екземпляра — по един за всяка страна.
6.2. Посредник: {{агенция}}.
{{бележки}}

ПРОДАВАЧ: ................................    КУПУВАЧ: ................................
БРОКЕР: ................................

ВНИМАНИЕ: документът е генериран от CRM. Проверете всяко поле преди подпис и се консултирайте с нотариус.`,
  },
  {
    name: "Комисионен (посреднически) договор",
    contract_type: "brokerage",
    variables: VARS,
    template_content: `ДОГОВОР ЗА ПОСРЕДНИЧЕСТВО
(комисионен договор)

Днес, {{дата}} г., в гр. {{град}}, между:

ВЪЗЛОЖИТЕЛ:
{{име}}, ЕГН {{егн}}, тел. {{телефон}}, имейл {{имейл}}, адрес {{адрес_клиент}}, в качеството на {{качество}},

и

ПОСРЕДНИК:
{{агенция}}, представлявана от брокер {{брокер}}, тел. {{телефон_брокер}}, рег. № {{лиценз}},

се сключи настоящият договор:

I. ПРЕДМЕТ
1.1. Възложителят възлага, а Посредникът приема да извършва посреднически услуги във връзка с недвижим имот:
{{вид_имот}} „{{имот}}“, {{площ}} кв.м, {{град}}, {{квартал}}, {{адрес}}, на цена {{цена}}.
1.2. Услугите включват: представяне на имота, организиране на огледи, водене на преговори и съдействие при сключване на сделка.

II. КОМИСИОНА
2.1. Комисионата е {{комисиона}} от продажната / наемната цена, дължима при сключване на сделка (предварителен или окончателен договор, или плащане на депозит — според уговорката).
2.2. Комисионата се дължи и ако Възложителят сключи сделка със заинтересовано лице, представено от Посредника, в срок до 6 месеца след прекратяване на договора.

III. ЗАДЪЛЖЕНИЯ
3.1. Посредникът действа добросъвестно, пази търговска тайна и информира Възложителя за огледи и оферти.
3.2. Възложителят предоставя верни данни за имота/търсенето и осигурява достъп за огледи.

IV. СРОК
4.1. Договорът е в сила 6 (шест) месеца от датата на подписване, с мълчаливо продължаване за същия срок, освен ако бъде прекратен с писмено предизвестие.

V. ДРУГИ
5.1. Договорът се състави в два екземпляра.
{{бележки}}

ВЪЗЛОЖИТЕЛ: ................................    ПОСРЕДНИК: ................................`,
  },
  {
    name: "Огледен лист / протокол от оглед",
    contract_type: "viewing",
    variables: VARS,
    template_content: `ПРОТОКОЛ / ОГЛЕДЕН ЛИСТ

Дата на огледа: {{дата}}
Град: {{град}}
Имот: {{имот}}
Адрес: {{адрес}}
Вид: {{вид_имот}}, площ {{площ}} кв.м, {{стаи}} стаи, етаж {{етаж}}
Квартал: {{квартал}}
Обявена цена: {{цена}}

КЛИЕНТ (оглеждащ):
Име: {{име}}
Телефон: {{телефон}}    Имейл: {{имейл}}
Качество: {{качество}}

СОБСТВЕНИК / ПРЕДСТАВИТЕЛ:
{{собственик}}, тел. {{телефон_собственик}}

БРОКЕР:
{{брокер}}, {{агенция}}, тел. {{телефон_брокер}}

СЪСТОЯНИЕ НА ИМОТА ПРИ ОГЛЕДА
(попълва се на място / от бележките)
${BLANK}

ЗАБЕЛЕЖКИ НА КЛИЕНТА
{{бележки}}

СЛЕДВАЩА СТЪПКА
[ ] втори оглед    [ ] оферта    [ ] отказ    [ ] друго: ${BLANK}

Подпис клиент: ................................    Подпис брокер: ................................
Подпис собственик (ако присъства): ................................`,
  },
  {
    name: "Пълномощно (заготовка)",
    contract_type: "power_of_attorney",
    variables: VARS,
    template_content: `ПЪЛНОМОЩНО
(заготовка — за нотариална заверка)

Долуподписаният/ата {{име}}, ЕГН {{егн}}, с адрес {{адрес_клиент}}, тел. {{телефон}},

упълномощавам

{{брокер}} от {{агенция}}, тел. {{телефон_брокер}}, рег. № {{лиценз}},

ДА МЕ ПРЕДСТАВЛЯВА пред институции, банки, агенции, нотариуси и трети лица във връзка с недвижим имот:

{{вид_имот}} „{{имот}}“, {{площ}} кв.м, находящ се в {{град}}, {{квартал}}, {{адрес}},

включително: да подава заявления и получава документи; да уговаря огледи; да води преговори; да подписва оферти и предварителни споразумения в рамките, изрично посочени по-долу.

ОБХВАТ / ОГРАНИЧЕНИЯ
{{бележки}}

Настоящото пълномощно се издава за срок до ${BLANK} г. и може да бъде оттеглено писмено.

Дата: {{дата}} г.    Място: {{град}}

УПЪЛНОМОЩИТЕЛ: ................................
(подпис — след нотариална заверка на подписа)

ВНИМАНИЕ: това е заготовка. Валидно пълномощно за разпореждане с имот изисква нотариална форма. Не подписвайте преди правна проверка.`,
  },
  {
    name: "Договор за наем на жилище",
    contract_type: "rent",
    variables: VARS,
    template_content: `ДОГОВОР ЗА НАЕМ
на недвижим имот

Днес, {{дата}} г., в гр. {{град}}, между:

НАЕМОДАТЕЛ:
{{собственик}}, ЕГН {{егн_собственик}}, адрес {{адрес_собственик}}, тел. {{телефон_собственик}},

и

НАЕМАТЕЛ:
{{име}}, ЕГН {{егн}}, адрес {{адрес_клиент}}, тел. {{телефон}}, имейл {{имейл}},

при посредничеството на {{агенция}}, брокер {{брокер}},

се сключи настоящият договор:

I. ПРЕДМЕТ
1.1. Наемодателят предоставя за временно възмездно ползване, а Наемателят приема следния имот:
{{вид_имот}} „{{имот}}“, {{площ}} кв.м, {{стаи}} стаи, етаж {{етаж}}, {{град}}, {{квартал}}, {{адрес}}.

II. СРОК И ЦЕНА
2.1. Срок на наема: ${BLANK} месеца, считано от ${BLANK} г.
2.2. Месечен наем: {{цена}}, платим до ${BLANK} число на текущия месец.
2.3. Депозит: ${BLANK}, възстановим при връщане на имота в уговореното състояние, след прихващане на дължими суми.

III. ПРАВА И ЗАДЪЛЖЕНИЯ
3.1. Наемателят ползва имота като добър стопанин, плаща консумативи на свое име и не пренаема без писмено съгласие.
3.2. Наемодателят осигурява спокойно ползване и отстранява скрити недостатъци.

IV. ПРЕКРАТЯВАНЕ
4.1. С писмено предизвестие от 30 дни, освен ако страните уговорят друго.
{{бележки}}

НАЕМОДАТЕЛ: ................................    НАЕМАТЕЛ: ................................
БРОКЕР / {{агенция}}: ................................`,
  },
];
