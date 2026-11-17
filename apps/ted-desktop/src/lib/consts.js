// Static UI lists. Role ids are the server modes of /api/assistant; "auto" sends no mode.
export const CRM_URL = "https://imotinadezhda.bg/mobile/crm/crm-nachalo.html";

export const ROLES = [
  { id: "auto", em: "✨", name: "Автоматично", short: "Автоматично", sub: "Тед избира сам: юрист, секретар, брокер, анализатор…" },
  { id: "lawyer", em: "⚖️", name: "Юрист – правен помощник", short: "Юрист", sub: "Казуси, договори, рискове, документи" },
  { id: "secretary", em: "🗂️", name: "Секретар – договори и кризи", short: "Секретар", sub: "Документи, писма, графици, трудни ситуации" },
  { id: "senior", em: "🏛️", name: "Старши брокер (25+ г.)", short: "Старши брокер", sub: "Оценки, сделки, банки, нотариус, ДДС, данъци" },
  { id: "analyst", em: "📊", name: "Анализатор", short: "Анализатор", sub: "Пазар, доходност, отчети на агенцията" },
  { id: "sales", em: "🤝", name: "Търговец – умни предложения", short: "Търговец", sub: "Подбор, аргументи, възражения, следваща стъпка" },
  { id: "opener", em: "👋", name: "Започни разговор", short: "Започни разговор", sub: "Първи контакт и поддържане на връзка" },
  { id: "inquiry", em: "📨", name: "Отговори на запитване", short: "Запитване", sub: "Готов отговор на клиентско запитване" },
];
export const roleOf = (id) => ROLES.find((r) => r.id === id) || null;

// Built-in skills of the website CRM. In the desktop program they only open an honest panel.
export const SKILLS = [
  { id: "upload", em: "🏠", name: "АИ Качване на имот", sub: "Папка, снимки и опис → попълнена карта на имот" },
  { id: "collect", em: "🔎", name: "Събиране на имоти и клиенти", sub: "Частни обяви без посредник и клиенти от групи и сайтове" },
  { id: "mail", em: "✉️", name: "Моята поща за изпращане", sub: "ABV, Gmail, Mail.bg… – Тед праща имейлите от вашата поща" },
  { id: "video", em: "🎬", name: "AI Видео на имот", sub: "Едно готово видео от снимките на обявата" },
];

// Example prompts on the start screen: they only fill the composer, nothing is sent.
export const GROUPS = [
  { id: "props", em: "🏠", name: "Имоти и клиенти", ex: "Намери тристайни апартаменти в Шумен до 120 000 €" },
  { id: "cal", em: "📅", name: "Календар и огледи", ex: "Какво имам в календара за утре?" },
  { id: "docs", em: "📄", name: "Документи и преводи", ex: "Кои документи имаме към последния добавен клиент?" },
  { id: "calc", em: "🧮", name: "Сметки и лихви", ex: "Каква е месечната вноска по ипотека 100 000 € за 25 години при актуалната лихва?" },
  { id: "text", em: "💬", name: "Текстове и писма", ex: "Напиши кратко и продаващо описание за обява на тристаен апартамент с южно изложение и две тераси" },
  { id: "reports", em: "📊", name: "Справки", ex: "Направи обобщена справка за агенцията за този месец" },
];

// Voices and styles accepted by /api/voice?fn=tts.
export const VOICES = [
  { id: "Charon", name: "Мъжки – спокоен" },
  { id: "Achernar", name: "Женски – мек" },
  { id: "Despina", name: "Женски – гладък" },
  { id: "Puck", name: "Мъжки – енергичен" },
];
export const STYLES = [
  { id: "calm", name: "Спокоен и топъл" },
  { id: "brief", name: "Кратък и делови" },
  { id: "slow", name: "Бавен и ясен (за диктовка на клиент)" },
];
export const SPEAK = [
  { id: "voice", name: "Само след гласов въпрос" },
  { id: "always", name: "Чете всеки отговор на глас" },
  { id: "never", name: "Никога – само бутона „Чуй“" },
];

// Real GPT reasoning effort (the „Усилие ›“ menu, ChatGPT Instant/Thinking style). "" = Стандартно: nothing is sent.
export const EFFORTS = [
  { id: "none", name: "Мигновено" }, { id: "low", name: "Ниско" }, { id: "medium", name: "Средно" }, { id: "high", name: "Високо" }, { id: "xhigh", name: "Много високо" },
];
export const effortName = (id) => (EFFORTS.find((e) => e.id === id) || { name: "Стандартно" }).name;
// Real GPT = only the employee's ChatGPT plan (docs/CONTRACT.md §9.6). No other AI is used in this engine.
export const RG_LIMITS = "Real GPT ползва само вашия ChatGPT план – никакъв друг изкуствен интелект (Gemini, Тед на сървъра, AI видео). Рисуването и видеото на ChatGPT (gpt-image, Sora), Code Interpreter, търсенето на OpenAI и Agent mode не се дават на външни програми: снимки и видео Тед подготвя като заявка, която отваряте в приложението ChatGPT; документите се правят на този компютър; търсенето в интернет е от този компютър. Единственото изключение е гласът („Чуй“, диктовка, гласов режим): той е на сървъра на Тед (Google Gemini), тръгва само когато го пуснете и програмата пита първо – отговорите на Real GPT не се четат на глас сами.";
// The two engines, as the model menu and the composer name them.
export const ENGINE_NOTE = {
  server: "Тед на сървъра – моделите на сървъра (Gemini и др.), снимки и AI видео от сървъра",
  realgpt: "само вашият ChatGPT план – без друг изкуствен интелект",
};

// Чат | Работа (ChatGPT Chat | Work). Both have every capability; Работа allows longer multi-step work.
export const MODES = [
  { id: "chat", name: "Чат", hello: "Готови ли сте?", ph: "Попитайте каквото и да е" },
  { id: "work", name: "Работа", hello: "Върху какво ще работим?", ph: "Направете каквото и да е" },
];
export const modeOf = (id) => MODES.find((m) => m.id === id) || MODES[0];

// Optional hints of the „+“ menu (ChatGPT: Create image, Thinking, Deep research, Web search). Real GPT gets them as
// `hints`; Тед (сървър) gets the same request as a visible text prefix in the composer.
export const HINTS = [
  { id: "image", icon: "image", name: "Създай изображение", prefix: "Създай изображение: " },
  { id: "thinking", icon: "bulb", name: "Мислене", prefix: "Помисли задълбочено: " },
  { id: "research", icon: "telescope", name: "Задълбочено проучване", prefix: "Направи задълбочено проучване: " },
  { id: "search", icon: "globe", name: "Търсене в мрежата", prefix: "Потърси в интернет: " },
];
// Hints armed from elsewhere (not in the root „+“ list): „Още › Видео“ with Real GPT.
export const EXTRA_HINTS = [
  { id: "video", icon: "film", name: "Видео", prefix: "Направи видео: " },
];
export const hintOf = (id) => HINTS.find((h) => h.id === id) || EXTRA_HINTS.find((h) => h.id === id) || null;

// „Пиши или редактирай“ on the Home screen: examples that only fill the composer.
export const WRITE_EX = [
  { em: "🏠", name: "Описание за обява", ex: "Напиши продаващо описание за обява на " },
  { em: "✉️", name: "Писмо до клиент", ex: "Напиши учтиво писмо до клиент, че " },
  { em: "📜", name: "Договор от нулата", ex: "Напиши договор за наем на апартамент между " },
  { em: "📝", name: "Редактирай текст", ex: "Редактирай текста по-долу да звучи по-професионално:\n" },
];

// Help centre and privacy (Настройки → За помощ).
export const README_URL = "https://github.com/miroslavkunev7-design/imotinadezhda/blob/live-site/apps/ted-desktop/README.md";
// AuthState.remembered === false: MAIN keeps the session in memory only (no Windows encryption).
export const SESSION_NOTE = "Windows не позволи шифровано запазване на сесията на този компютър. Ще трябва да влизате отново при всяко стартиране на програмата.";
export const RG_USAGE_URL ="https://chatgpt.com/settings/usage"; // "Manage usage" page of the ChatGPT plan
// Real GPT result codes that need a new "Continue with ChatGPT" sign-in instead of a retry.
export const RG_SIGNIN_CODES = ["plan_disabled", "reauth", "not_connected"];
// Sign-in failures that a fresh registration (realgpt.signIn({newAccount:true})) can fix.
// signin_timeout: a saved issued client id that OpenAI no longer knows answers the browser with a 400 JSON page
// and never redirects back, so the only way out is a new registration.
export const RG_NEW_ACCOUNT_CODES = ["registration", "account_mismatch", "oauth", "id_token", "signin_timeout"];

const PROV = { google: "🔷", gemini: "🔷", openai: "⚪", anthropic: "🟠", claude: "🟠", openrouter: "🛰️", ollama: "🦙", gateway: "🌐" };
export const provEm = (p) => PROV[String(p || "").toLowerCase()] || "🤖";

export const DEF_SETTINGS = {
  engine: "server", model: "", role: "auto",
  rgModel: "", rgEffort: "",
  voice: "Charon", style: "calm", speak: "voice",
  big: false, enterSend: true, showActs: true, dictSend: false,
  mini: false, compact: false,
  // 0.1.3 (docs/CONTRACT.md §8.4). `updates.auto` and the Real GPT consent are kept by MAIN, never here.
  mode: "chat", nick: "", instructions: "",
  browse: { enabled: true, robots: true, blocked: [] },
  notify: { scheduled: true, updates: true },
  theme: "ted", accent: "ted",
};
export const BROWSE_DEF = DEF_SETTINGS.browse;
export const NOTIFY_DEF = DEF_SETTINGS.notify;

// Same expression as the server's fast path in /api/assistant: a bare "yes" after a prepared e-mail.
export const AFFIRM = /^\s*(да|да,?\s*(изпрати|прати|изпращай|го изпрати|го прати)(\s+го)?|изпрати(\s+го)?|прати(\s+го)?|ок|окей|потвърждавам|давай|yes)\s*[.!]*\s*$/i;
// Any reply that BEGINS with a confirmation word, with or without more words ("Да, моля", "ок, прати го на …").
export const AFFIRM_START = /^[\s"„“'«(]*(да|ок|окей|ok|okay|изпрати|изпращай|прати|пращай|давай|потвърждавам|потвърди|yes|добре|разбира се)(?=$|[\s,.!?;:…\-–—)"“»])/i;
export const ASKS_TO_SEND = /изпратя ли/i;
export const INTERRUPTED_TEXT = "Прекъснато при затваряне – възможно е действия да са изпълнени.";
export const DRAFT_TTL_MS = 6 * 3600 * 1000; // the server keeps a prepared e-mail for 6 hours

export const PANEL_TEXT = {
  upload: "АИ Качване на имот",
  collect: "Събиране на имоти и клиенти",
  mail: "Моята поща за изпращане",
  video: "AI Видео на имот",
};
