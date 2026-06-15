// Theme token definitions — single source of truth for the CRM theme editor.

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  sidebar: string;
  sidebarForeground: string;
  fontHeading: string;
  fontBody: string;
  fontSizeBase: number; // px
};

export type ThemePresets = {
  cards: "classic" | "glass" | "minimal" | "gradient";
  navbar: "burgundy" | "transparent" | "dark";
  logo: "left-above" | "left-inline" | "center";
  forms: "rounded" | "classic" | "underline";
  buttons: "pill" | "rounded" | "square";
};

export const DEFAULT_TOKENS: ThemeTokens = {
  background: "#ffffff",
  foreground: "#1a0d10",
  card: "#ffffff",
  cardForeground: "#1a0d10",
  primary: "#8B1A2B",
  primaryForeground: "#fdf7ee",
  secondary: "#f7efe2",
  secondaryForeground: "#8B1A2B",
  muted: "#f5ede0",
  mutedForeground: "#6a4b4f",
  accent: "#C9A84C",
  accentForeground: "#1a0d10",
  border: "#e8d9b8",
  sidebar: "#fbf6ec",
  sidebarForeground: "#1a0d10",
  fontHeading: "Playfair Display",
  fontBody: "Open Sans",
  fontSizeBase: 16,
};

export const DEFAULT_PRESETS: ThemePresets = {
  cards: "classic",
  navbar: "burgundy",
  logo: "left-above",
  forms: "rounded",
  buttons: "rounded",
};

export const TOKEN_LABELS: Record<keyof Omit<ThemeTokens, "fontHeading" | "fontBody" | "fontSizeBase">, string> = {
  background: "Фон на страницата",
  foreground: "Основен текст",
  card: "Фон на карта / панел",
  cardForeground: "Текст в карта",
  primary: "Първичен (бутони, акценти)",
  primaryForeground: "Текст върху първичен",
  secondary: "Вторичен фон",
  secondaryForeground: "Текст върху вторичен",
  muted: "Muted фон",
  mutedForeground: "Muted текст",
  accent: "Акцент (злато)",
  accentForeground: "Текст върху акцент",
  border: "Граници / разделители",
  sidebar: "Странична лента (фон)",
  sidebarForeground: "Странична лента (текст)",
};

export const FONT_OPTIONS = [
  "Playfair Display",
  "Cormorant Garamond",
  "Open Sans",
  "Manrope",
  "Inter",
  "Montserrat",
  "Roboto",
  "Poppins",
] as const;

/** Map theme token → CSS variable name used by shadcn/Tailwind. */
export const TOKEN_TO_CSS_VAR: Record<keyof Omit<ThemeTokens, "fontHeading" | "fontBody" | "fontSizeBase">, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
};
