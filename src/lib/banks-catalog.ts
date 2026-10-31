/** Споделен каталог на банките — цвят, слоган и условия за кредитния блок. */

export type BankCatalogEntry = {
  name: string;
  /** Основен фирмен цвят на картата / блока. */
  color: string;
  /** Текст върху цветния фон — тъмен при жълти банки. */
  dark?: boolean;
  short?: string;
  slogan?: string;
  motto?: string;
  conditions?: string[];
};

export const BANKS_CATALOG: BankCatalogEntry[] = [
  {
    name: "iBank",
    color: "#b91c1c",
    short: "iBank",
    slogan: "Дигитална банка",
    motto: "Бързо и онлайн",
    conditions: [
      "Без такса за оценка на имота",
      "Финансиране до 85%",
      "Одобрение до 3 работни дни",
    ],
  },
  {
    name: "Банка ДСК",
    color: "#0b3d2e",
    short: "ДСК",
    slogan: "Доверието има стойност",
    motto: "По-близо до хората",
    conditions: [
      "Фиксирана лихва за първите 5 години",
      "Без такса за предсрочно погасяване",
      "Одобрение до 3 работни дни",
    ],
  },
  {
    name: "ОББ",
    color: "#0b4fa0",
    short: "ОББ",
    slogan: "Заедно напред",
    motto: "Сигурен партньор",
    conditions: [
      "Фиксирана лихва за първите 3 години",
      "Гъвкаво самоучастие",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "УниКредит Булбанк",
    color: "#c11007",
    short: "УниКредит",
    slogan: "Банка за живота",
    motto: "Европейски стандарт",
    conditions: [
      "Финансиране до 85%",
      "Без такса за предсрочно погасяване след 1 г.",
      "Одобрение до 4 работни дни",
    ],
  },
  {
    name: "Fibank",
    color: "#16356e",
    short: "Fibank",
    slogan: "Първа инвестиционна банка",
    motto: "Вашият избор",
    conditions: [
      "Фиксирана или плаваща лихва",
      "Срок до 30 години",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "Пощенска банка",
    color: "#f4c500",
    dark: true,
    short: "Пощенска",
    slogan: "Близо до вас",
    motto: "Навсякъде в страната",
    conditions: [
      "Финансиране до 85%",
      "Без такса оценка при превод на заплата",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "Алианц Банк",
    color: "#003781",
    short: "Алианц",
    slogan: "Сигурност и стабилност",
    motto: "Заедно сме по-силни",
    conditions: [
      "Фиксирана лихва за първите 5 години",
      "Опционална застраховка имот",
      "Одобрение до 4 работни дни",
    ],
  },
  {
    name: "ЦКБ",
    color: "#0e7a6d",
    short: "ЦКБ",
    slogan: "Централна кооперативна банка",
    motto: "За хората",
    conditions: [
      "Гъвкави условия",
      "Срок до 30 години",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "БНБ",
    color: "#c45c12",
    short: "БНБ",
    slogan: "Българска народна банка",
    motto: "Референтни лихви",
    conditions: ["Референтни стойности", "Информативен профил", "Не издава ипотеки директно"],
  },
  {
    name: "Инвестбанк",
    color: "#1f5fbf",
    short: "Инвестбанк",
    slogan: "Инвестираме във вас",
    motto: "Личен подход",
    conditions: [
      "Финансиране до 80%",
      "Без такса за предсрочно погасяване",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "Тексим банк",
    color: "#1d7ea8",
    short: "Тексим",
    slogan: "Банка с отношение",
    motto: "Гъвкави решения",
    conditions: [
      "Финансиране до 80%",
      "Срок до 30 години",
      "Одобрение до 5 работни дни",
    ],
  },
  {
    name: "Райфайзен Банк",
    color: "#f5c400",
    dark: true,
    short: "Райфайзен",
    slogan: "Най-добрата банка за вас",
    motto: "Австрийска група",
    conditions: [
      "Фиксирана лихва за първите 3–5 години",
      "Финансиране до 85%",
      "Одобрение до 4 работни дни",
    ],
  },
  {
    name: "TBI Bank",
    color: "#e07b2a",
    short: "TBI",
    slogan: "Банка за хората",
    motto: "Бързи решения",
    conditions: [
      "Бързо одобрение",
      "Гъвкаво самоучастие",
      "Одобрение до 3 работни дни",
    ],
  },
];

export function bankMeta(name: string | null | undefined): BankCatalogEntry {
  const found = BANKS_CATALOG.find((b) => b.name === name);
  return (
    found ?? {
      name: name?.trim() || "Банка",
      color: "#7a1226",
      slogan: "",
      motto: "",
      conditions: [
        "Фиксирана лихва за първите 5 години",
        "Без такса за предсрочно погасяване",
        "Одобрение до 3 работни дни",
      ],
    }
  );
}

export type CreditBlockData = {
  bank: string;
  amount: number;
  downPayment: number;
  years: number;
  rate: number;
  payment: number;
  savedAt?: string;
};

export function creditBlockOf(client: {
  mortgage_data?: { bank?: string; credit_block?: CreditBlockData | null } | null;
} | null): CreditBlockData | null {
  const md = client?.mortgage_data;
  if (!md) return null;
  if (md.credit_block?.bank) return md.credit_block;
  return null;
}
