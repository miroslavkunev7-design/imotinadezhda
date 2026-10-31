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
  description: string;
  features: Array<{ label: string; value: string }>;
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
