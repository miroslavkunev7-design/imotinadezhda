// Villages within ~25 km of the city of Shumen. Used to accept scraped listings
// from these localities as part of the "Shumen" bucket. Keep entries as they
// appear in listing titles (Cyrillic, optionally hyphenated).
export const SHUMEN_VILLAGES_25KM = [
  "Мадара",
  "Дибич",
  "Царев брод",
  "Друмево",
  "Новосел",
  "Струйно",
  "Ветрище",
  "Мараш",
  "Кочово",
  "Черенча",
  "Илия Блъсково",
  "Осмар",
  "Ивански",
  "Салманово",
  "Панайот Волов",
  "Средня",
  "Радко Димитриево",
  "Хан Крум",
  "Троица",
  "Смядово",
  "Риш",
  "Каспичан",
  "Плиска",
  "Кюлевча",
  "Костена река",
  "Лозево",
  "Овчарово",
  "Велино",
  "Мировци",
  "Върбак",
] as const;

export const SHUMEN_VILLAGES_LOWER = SHUMEN_VILLAGES_25KM.map((n) =>
  n.toLowerCase(),
);
