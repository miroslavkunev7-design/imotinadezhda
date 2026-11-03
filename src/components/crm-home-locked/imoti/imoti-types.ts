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

/** Distinct melt fill per detail roster tab — never reuse the live gallery hero. */
export const IMOTI_SECTION_BG: Record<ImotiDetailTab, string> = {
  basic: "/images/quarters/burgas/lazur.jpg",
  media: "/images/quarters/varna/galata.jpg",
  features: "/images/quarters/shumen/trakiya.jpg",
  location: "/images/quarters/burgas/kraimorie.jpg",
  documents: "/images/quarters/varna/levski.jpg",
  owner: "/crm-home-locked/card-klienti.jpg",
  history: "/images/quarters/shumen/centar.jpg",
  deal: "/crm-home-locked/card-sdelki.jpg",
  contract: "/images/quarters/burgas/sarafovo.jpg",
  bank: "/images/quarters/varna/vladislavovo.jpg",
};

/** Summary panel melt — separate from gallery cover / current slide. */
export const IMOTI_SUMMARY_MELT_BG = "/images/quarters/burgas/slaveykov.jpg";
