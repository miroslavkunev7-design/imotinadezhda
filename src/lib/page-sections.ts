// Registry of sections per page. The editor lists these; the public pages
// render them in the saved order, skipping hidden ones.

export type PageKey = "home" | "sale" | "rent" | "about" | "contacts";

export type SectionDef = {
  id: string;
  label: string;
  description?: string;
};

export const PAGE_LABELS: Record<PageKey, string> = {
  home: "Начало",
  sale: "За продажба",
  rent: "Под наем",
  about: "За нас",
  contacts: "Контакти",
};

export const SECTION_REGISTRY: Record<PageKey, SectionDef[]> = {
  home: [
    { id: "hero-search-mobile", label: "Търсачка (мобилно)", description: "Видима само на телефон/таблет, под header-а." },
    { id: "hero-search-desktop", label: "Търсачка (десктоп)", description: "Над картите с градове." },
    { id: "cities-grid", label: "Карти с градове", description: "Шумен, Варна, Бургас, Нов пазар." },
  ],
  sale: [
    { id: "filters", label: "Филтри" },
    { id: "results", label: "Резултати" },
  ],
  rent: [
    { id: "filters", label: "Филтри" },
    { id: "results", label: "Резултати" },
  ],
  about: [
    { id: "hero", label: "Hero секция" },
    { id: "values", label: "Стойности / предимства" },
    { id: "contact-cta", label: "Контакти CTA" },
  ],
  contacts: [
    { id: "form", label: "Форма за контакт" },
    { id: "info", label: "Контактна информация" },
  ],
};

export type SectionState = {
  id: string;
  visible: boolean;
  title?: string;
  subtitle?: string;
  props?: Record<string, string | number | boolean | null>;
};

/**
 * Merge saved layout with the registry defaults. Unknown saved IDs are
 * dropped; new registry sections are appended at the end (visible by default).
 * Запазваме всякакви overrides (title/subtitle/props) от запазената версия.
 */
export function resolveSections(
  page: PageKey,
  saved: SectionState[] | null | undefined,
): SectionState[] {
  const registry = SECTION_REGISTRY[page] ?? [];
  const registryIds = new Set(registry.map((s) => s.id));
  const result: SectionState[] = [];
  const seen = new Set<string>();
  for (const s of saved ?? []) {
    if (registryIds.has(s.id) && !seen.has(s.id)) {
      result.push({
        id: s.id,
        visible: !!s.visible,
        ...(s.title !== undefined ? { title: s.title } : {}),
        ...(s.subtitle !== undefined ? { subtitle: s.subtitle } : {}),
        ...(s.props !== undefined ? { props: s.props } : {}),
      });
      seen.add(s.id);
    }
  }
  for (const reg of registry) {
    if (!seen.has(reg.id)) result.push({ id: reg.id, visible: true });
  }
  return result;
}
