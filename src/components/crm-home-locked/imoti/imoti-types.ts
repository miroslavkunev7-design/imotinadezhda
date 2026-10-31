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
  basic: "/crm-home-locked/card-imoti.jpg",
  media: "/crm-home-locked/bg-light.jpg",
  features: "/crm-home-locked/card-sdelki.jpg",
  location: "/crm-home-locked/bg-dark.jpg",
  documents: "/crm-home-locked/card-ogledi.jpg",
  owner: "/crm-home-locked/card-klienti.jpg",
  history: "/crm-home-locked/bg-dark.jpg",
  deal: "/crm-home-locked/card-sdelki.jpg",
  contract: "/crm-home-locked/card-ogledi.jpg",
  bank: "/crm-home-locked/card-imoti.jpg",
};
