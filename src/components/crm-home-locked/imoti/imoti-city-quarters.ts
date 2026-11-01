/** Catalog filter cities — fixed set for CRM Imoti toolbar. */
export const IMOTI_FILTER_CITIES = ["Шумен", "Бургас", "Варна"] as const;

export type ImotiFilterCity = (typeof IMOTI_FILTER_CITIES)[number];

/**
 * Neighborhood lists per city (display names).
 * Seeded from existing site quarter maps (shumen-home, imposed city configs, quarter-image-map).
 */
export const IMOTI_QUARTERS_BY_CITY: Record<ImotiFilterCity, readonly string[]> = {
  Шумен: [
    "Център",
    "Тракия",
    "Боян Българанов 1",
    "Боян Българанов 2",
    "Болницата",
    "Херсон",
    "Пазара",
    "Добруджански",
    "Пожарната",
    "Военно училище",
  ],
  Бургас: [
    "Център",
    "Лазур",
    "Славейков",
    "Меден рудник",
    "Зорница",
    "Сарафово",
    "Крайморие",
    "Изгрев",
    "Победа",
    "Възраждане",
    "Мадика",
  ],
  Варна: [
    "Център",
    "Виница",
    "Чайка",
    "Левски",
    "Владиславово",
    "Аспарухово",
    "Кайсиева градина",
    "Изгрев",
    "Галата",
    "Колхозен пазар",
  ],
};

export function quartersForImotiCity(city: string): string[] {
  if (city in IMOTI_QUARTERS_BY_CITY) {
    return [...IMOTI_QUARTERS_BY_CITY[city as ImotiFilterCity]];
  }
  return [];
}
