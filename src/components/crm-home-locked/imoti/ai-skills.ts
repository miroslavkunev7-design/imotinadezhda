export type AiSkillId = "upload-property" | "collect-leads";

export type AiSkill = {
  id: AiSkillId;
  title: string;
  short: string;
  prompt: string;
  reply: string;
};

/** Skills for locked CRM AI assistant (from Spec 2 — upload + collect). */
export const AI_ASSIST_SKILLS: AiSkill[] = [
  {
    id: "upload-property",
    title: "Качване на имот",
    short: "Снимки, описания, цена",
    prompt: "Стартирай skill: АИ Качване на имот",
    reply: [
      "Skill „АИ Качване на имот“ е активен.",
      "Мога да:",
      "• отворя формата „Добави имот“",
      "• приемам до 50 снимки / папка",
      "• попълня описание за сайт + лично (собственик)",
      "• предложа „наша цена“ = лична + 5 € след анализ",
      "Прикачи снимки или кажи „отвори качване“.",
    ].join("\n"),
  },
  {
    id: "collect-leads",
    title: "Събиране на имоти и клиенти",
    short: "Лийдове от текст/файл",
    prompt: "Стартирай skill: Събиране на имоти и клиенти",
    reply: [
      "Skill „Събиране на имоти и клиенти“ е активен.",
      "Прати ми:",
      "• текст/линк/екран на обява → извличам град, квартал, цена, тип, контакти",
      "• визитка или бележка за клиент → име, телефон, бюджет, покупка/наем",
      "Връщам структуриран запис, готов за CRM (демо локално).",
      "Прикачи файл или пейстни текста на обявата.",
    ].join("\n"),
  },
];

export function matchSkill(text: string): AiSkill | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (
    t.includes("качване на имот") ||
    t.includes("качи имот") ||
    (t.includes("добав") && t.includes("имот")) ||
    t.includes("upload")
  ) {
    return AI_ASSIST_SKILLS[0];
  }
  if (
    t.includes("събиране") ||
    t.includes("събери") ||
    (t.includes("клиент") && t.includes("имот")) ||
    t.includes("лийд") ||
    t.includes("lead")
  ) {
    return AI_ASSIST_SKILLS[1];
  }
  return null;
}
