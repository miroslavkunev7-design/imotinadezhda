import type { CreditBlockData } from "@/lib/banks-catalog";

export type ImotiDeal = "sale" | "rent";

/** CRM listing lifecycle (Spec 1 §2 Status) */
export type ImotiListingStatus = "draft" | "published" | "archive";

export const IMOTI_TYPE_OPTIONS = [
  "гарсониера",
  "едностаен",
  "двустаен",
  "тристаен",
  "четиристаен",
  "многостаен",
  "мезонет",
  "1+1",
  "студио",
  "ателие/таван",
  "къща",
  "вила",
  "етаж от къща",
  "парцел",
  "земеделска земя",
  "офис",
  "магазин",
  "склад",
  "гараж",
  "хотел/заведение",
  "друго",
] as const;

export const IMOTI_CONSTRUCTION_OPTIONS = [
  "тухла",
  "панел",
  "ЕПК",
  "гредоред",
  "монолит",
  "друго",
] as const;

export const AGENCY_PUBLIC_PHONE = "0898977370";

export type ImotiProperty = {
  id: string;
  title: string;
  deal: ImotiDeal;
  typeLabel: string;
  city: string;
  quarter: string;
  /** Official / site price */
  price: number;
  currency: "EUR" | "BGN" | "USD";
  priceSuffix?: string;
  areaSqm: number;
  /** Built / clean / total when known */
  areaBuiltSqm?: number | null;
  areaCleanSqm?: number | null;
  areaTotalSqm?: number | null;
  rooms: number;
  bedrooms?: number | null;
  floor: string;
  totalFloors?: number | null;
  baths: number;
  terraces?: string;
  view?: string;
  elevator?: string;
  basement?: string;
  attic?: string;
  year: number;
  condition: string;
  coverUrl: string;
  gallery: string[];
  videos?: string[];
  /** Public / site-facing description */
  description: string;
  /** Private note — shown only on Owner tab */
  descriptionOwner?: string;
  /** Personal / owner asking price (never public) */
  ownerPrice?: number | null;
  commission?: string;
  exclusive?: boolean;
  /** Personal address fields — never public */
  streetAddress?: string;
  blockEntrance?: string;
  mapPin?: string;
  landmark?: string;
  ownerName?: string;
  ownerPhones?: string[];
  ownerNotes?: string;
  listingStatus?: ImotiListingStatus;
  responsibleBroker?: string;
  publishLinks?: string[];
  features: Array<{ label: string; value: string }>;
  favorite?: boolean;
  createdAt?: number;
  /** Запазен кредитен блок от банковия модул */
  creditBlock?: CreditBlockData | null;
};

export type ImotiDetailTab =
  | "basic"
  | "media"
  | "features"
  | "location"
  | "documents"
  | "owner"
  | "history"
  | "deal"
  | "contract"
  | "bank";

export type ImotiSortKey = "newest" | "price-asc" | "price-desc" | "area-desc";

export const IMOTI_SECTION_BG: Record<ImotiDetailTab, string> = {
  basic: "/crm-home-locked/sections/sec-basic.jpg",
  media: "/crm-home-locked/sections/sec-media.jpg",
  features: "/crm-home-locked/sections/sec-features.jpg",
  location: "/crm-home-locked/sections/sec-location.jpg",
  documents: "/crm-home-locked/sections/sec-documents.jpg",
  owner: "/crm-home-locked/sections/sec-owner.jpg",
  history: "/crm-home-locked/sections/sec-history.jpg",
  deal: "/crm-home-locked/sections/sec-deal.jpg",
  contract: "/crm-home-locked/sections/sec-contract.jpg",
  bank: "/crm-home-locked/sections/sec-bank.jpg",
};

/** Distinct melt BGs for sidebar modules on the detail card */
export const IMOTI_MODULE_BG = {
  price: "/crm-home-locked/sections/mod-price.jpg",
  quick: "/crm-home-locked/sections/mod-quick.jpg",
  hero: "/crm-home-locked/sections/mod-hero.jpg",
} as const;

export const FEATURE_EMOJI: Record<string, string> = {
  Тип: "🏠",
  Площ: "📐",
  Стаи: "🛏",
  Бани: "🛁",
  Етаж: "🏢",
  Година: "📅",
  Паркинг: "🚗",
  Отопление: "🔥",
  Строителство: "🧱",
  Състояние: "✨",
  Изложение: "☀️",
  Обзавеждане: "🛋",
  Име: "👤",
  Телефон: "📞",
  "Официална цена": "💶",
  "Цена към собственика": "🏷",
};

export function listingStatusLabel(status: ImotiListingStatus | undefined): string {
  switch (status) {
    case "archive":
      return "Архив";
    case "draft":
      return "Чернова";
    case "published":
      return "Публикуван";
    case undefined:
      return "Активна";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
