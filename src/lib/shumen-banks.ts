export type BankRole = "кредитен консултант" | "управител" | "клонов мениджър" | "друг";

export type BankContact = {
  id: string;
  name: string;
  role: BankRole;
  phone: string;
  email: string;
};

export type BankTemplate = {
  id: string;
  label: string;
  fileName: string;
  url: string;
};

export type ShumenBank = {
  id: string;
  name: string;
  short: string;
  city: string;
  color: string;
  color2: string;
  textOn: string;
  address: string;
  /** Текст върху борда на клона. */
  branchBoard: string;
  samples: string[];
  formFields: { key: string; label: string; type?: "text" | "number" | "textarea" }[];
  /** Резервна стикерна лихва, ако дневната оферта не се върне. */
  rateToday: number;
  rateNote: string;
  docsBg: string[];
  docsAbroad: string[];
};

/** Изисквания — общ пакет за жилищен кредит; банката може да поиска и допълнителни. */
export const DOCS_BG = [
  "Лична карта — лице и гръб",
  "Трудов договор (безсрочен / срочен)",
  "Фишове за заплата — последните 12 месеца",
  "Банкови извлечения по заплата — 12 месеца",
  "Служебна бележка от работодателя",
  "Декларация за семейно и имотно състояние",
  "Съгласие за ЦКР и GDPR",
  "Предварителен договор за имота",
  "Нотариален акт на продавача",
  "Скица / схема на имота",
  "Данъчна оценка по актуална година",
  "Удостоверение за тежести (вписвания)",
];

export const DOCS_ABROAD = [
  "Паспорт или ЛК + превод",
  "Трудов договор в чужбина — легализация / апостил + заклет превод",
  "Удостоверение за доход от чужд работодател",
  "Данъчни декларации от държавата на дохода (последни 1–2 години)",
  "Извлечения от чужда банка — 12 месеца",
  "Документ за пребиваване / адрес в чужбина",
  "Декларация за произход на средства (ЗМИП)",
  "Съгласие за ЦКР и GDPR",
  "Предварителен договор за имота в България",
  "Нотариален акт на продавача, скица, данъчна оценка, тежести",
  "Заклети преводи на всички чужди документи",
];

/** Банки с клонове в Шумен — цветове по бранда, образците са типичните имена. */
export const SHUMEN_BANKS: ShumenBank[] = [
  {
    id: "dsk",
    name: "Банка ДСК",
    short: "ДСК",
    city: "Шумен",
    color: "#007A3D",
    color2: "#004D28",
    textOn: "#ffffff",
    address: "Шумен — клон Славянски бул. / център",
    branchBoard: "Клон Шумен",
    rateToday: 2.25,
    rateNote: "стикер при превод на заплата ≥ 1 500 €",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за жилищен кредит",
      "Декларация за семейно и имотно състояние",
      "Съгласие за обработка на лични данни",
      "Справка за задължения в ЦКР",
      "Опис на приложените документи",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "employer", label: "Работодател" },
      { key: "egn", label: "ЕГН" },
      { key: "property", label: "Имот / адрес" },
      { key: "own_funds", label: "Собствени средства (EUR)", type: "number" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "ubb",
    name: "ОББ",
    short: "ОББ",
    city: "Шумен",
    color: "#003DA5",
    color2: "#00A651",
    textOn: "#f4f8ff",
    address: "Шумен — клон ОББ",
    branchBoard: "Клон Шумен",
    rateToday: 2.28,
    rateNote: "стикер, без задължителен превод на заплата",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за ипотечен кредит",
      "Декларация за свързани лица",
      "Съгласие GDPR",
      "Анкета за произход на средства",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "employer", label: "Работодател" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "unicredit",
    name: "УниКредит Булбанк",
    short: "УниКредит",
    city: "Шумен",
    color: "#E2001A",
    color2: "#4A0A12",
    textOn: "#fff7f7",
    address: "Шумен — УниКредит Булбанк",
    branchBoard: "Клон Шумен",
    rateToday: 2.39,
    rateNote: "стикер при превод на заплата и застраховка",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за жилищен кредит",
      "Декларация за доходи",
      "Съгласие за ЦКР",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "fibank",
    name: "Първа инвестиционна банка",
    short: "Fibank",
    city: "Шумен",
    color: "#0055A5",
    color2: "#003366",
    textOn: "#f3f8ff",
    address: "Шумен — Fibank / ПИБ",
    branchBoard: "Клон Шумен",
    rateToday: 2.49,
    rateNote: "индикативна жилищна оферта",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за кредит",
      "Декларация ЗМИП",
      "Списък приложени документи",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "postbank",
    name: "Пощенска банка",
    short: "Postbank",
    city: "Шумен",
    color: "#FFCC00",
    color2: "#003399",
    textOn: "#1a1a2e",
    address: "Шумен — Пощенска банка",
    branchBoard: "Клон Шумен",
    rateToday: 2.24,
    rateNote: "стикер при доход ≥ 2 000 € и пакет застраховки",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за жилищен кредит",
      "Декларация за семейно положение",
      "Съгласие за обработка на данни",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "allianz",
    name: "Алианц Банк България",
    short: "Алианц",
    city: "Шумен",
    color: "#003781",
    color2: "#001F4D",
    textOn: "#f4f7ff",
    address: "Шумен — Алианц Банк",
    branchBoard: "Клон Шумен",
    rateToday: 2.45,
    rateNote: "индикативна жилищна оферта",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за ипотечен кредит",
      "Застрахователна анкета",
      "Декларация за доходи",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "ccb",
    name: "Централна кооперативна банка",
    short: "ЦКБ",
    city: "Шумен",
    color: "#006B3F",
    color2: "#004D2C",
    textOn: "#f3fff8",
    address: "Шумен — ЦКБ",
    branchBoard: "Клон Шумен",
    rateToday: 2.89,
    rateNote: "индикативна жилищна оферта",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за кредит",
      "Декларация за свързани лица",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "tbi",
    name: "TBI Bank",
    short: "TBI",
    city: "Шумен",
    color: "#FF6B00",
    color2: "#C44E00",
    textOn: "#fffaf5",
    address: "Шумен — TBI Bank",
    branchBoard: "Клон Шумен",
    rateToday: 3.49,
    rateNote: "индикативна жилищна оферта",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за жилищен кредит",
      "Декларация за доходи",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
  {
    id: "investbank",
    name: "Инвестбанк",
    short: "Инвестбанк",
    city: "Шумен",
    color: "#0B3A6E",
    color2: "#062544",
    textOn: "#f4f8ff",
    address: "Шумен — ул. Панайот Волов 19",
    branchBoard: "Клон Шумен",
    rateToday: 5.50,
    rateNote: "стикер при пълна отговорност; с бонуси (заплата / пакет / карта) може по-ниско",
    docsBg: DOCS_BG,
    docsAbroad: DOCS_ABROAD,
    samples: [
      "Заявление за ипотечен кредит",
      "Декларация за семейно и имотно състояние",
      "Съгласие за ЦКР и GDPR",
      "Декларация ЗМИП",
    ],
    formFields: [
      { key: "amount", label: "Желана сума (EUR)", type: "number" },
      { key: "years", label: "Срок (години)", type: "number" },
      { key: "income", label: "Месечен доход (EUR)", type: "number" },
      { key: "employer", label: "Работодател" },
      { key: "property", label: "Имот / адрес" },
      { key: "note", label: "Бележка към банката", type: "textarea" },
    ],
  },
];

const STORAGE = "nadezhda-shumen-bank-desk-v1";

type DeskStore = Record<string, { contacts: BankContact[]; templates: BankTemplate[] }>;

function readStore(): DeskStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "{}") as DeskStore;
  } catch {
    return {};
  }
}

function writeStore(next: DeskStore) {
  localStorage.setItem(STORAGE, JSON.stringify(next));
}

export function loadBankDesk(bankId: string) {
  const all = readStore();
  return all[bankId] ?? { contacts: [], templates: [] };
}

export function saveBankContacts(bankId: string, contacts: BankContact[]) {
  const all = readStore();
  all[bankId] = { ...(all[bankId] ?? { contacts: [], templates: [] }), contacts };
  writeStore(all);
}

export function saveBankTemplates(bankId: string, templates: BankTemplate[]) {
  const all = readStore();
  all[bankId] = { ...(all[bankId] ?? { contacts: [], templates: [] }), templates };
  writeStore(all);
}
