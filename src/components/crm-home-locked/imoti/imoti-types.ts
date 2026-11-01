import type { CreditBlockData } from "@/lib/banks-catalog";

export type ImotiDeal = "sale" | "rent";

export type ImotiProperty = {
  id: string;
  title: string;
  deal: ImotiDeal;
  typeLabel: string;
  city: string;
  quarter: string;
  price: number;
  currency: "EUR";
  priceSuffix?: string;
  areaSqm: number;
  rooms: number;
  floor: string;
  baths: number;
  year: number;
  condition: string;
  coverUrl: string;
  gallery: string[];
  /** Public / site-facing description */
  description: string;
  /** Private note — shown only on Owner tab */
  descriptionOwner?: string;
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
