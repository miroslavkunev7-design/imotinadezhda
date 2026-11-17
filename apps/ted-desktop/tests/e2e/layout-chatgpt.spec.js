// 0.1.3 layout: the ChatGPT desktop arrangement in Тед's styling (docs/CONTRACT.md §15) – sidebar order, Чат | Работа,
// home chips, the „+“ menu, the model/effort pill, settings in the ChatGPT order (incl. Обновления), the phone drawer,
// pages, regenerate and inline edit. Mock build only; every value is fictional.
import { test, expect } from "@playwright/test";
import { DESKTOP, PHONE, answerConsent, guard, lastAnswer, login, mockCalls, noHorizontalScroll, openSettings, send, shot } from "./helpers.js";

const testIds = (loc) => loc.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));

test("sidebar: ChatGPT order with our sections; collapse to an icon rail and back", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  const side = page.locator("aside.side");
  await expect(side.getByTestId("side-search-ic")).toBeVisible();
  await expect(side.getByTestId("side-toggle")).toBeVisible();
  // Нов чат · Търсене · Проекти (+ казуси) · Планирани · Библиотека · Плъгини · Агенти · Чатове · профил
  const order = await testIds(side.locator("[data-testid^='side-'], [data-testid='case-list'], [data-testid='me-btn']"));
  expect(order.filter((x) => !["side-search-ic", "side-toggle"].includes(x))).toEqual(
    ["side-new", "side-search", "side-projects", "case-list", "side-scheduled", "side-library", "side-plugins", "side-agents", "side-chats", "me-btn"]);
  for (const [id, name] of [["side-new", "Нов чат"], ["side-search", "Търсене в чатовете"], ["side-projects", "Проекти"], ["side-scheduled", "Планирани"], ["side-library", "Библиотека"], ["side-plugins", "Плъгини"], ["side-agents", "Агенти"]]) {
    await expect(side.getByTestId(id)).toContainText(name);
  }
  await expect(side.getByTestId("case-list")).toContainText("Тестов казус · продажба");
  await expect(side.getByTestId("case-list")).toContainText("Нов проект…");
  await expect(side.getByTestId("me-btn")).toContainText("Тест Служител");
  // Nothing of ChatGPT without an honest equivalent.
  for (const absent of ["Sites", "GPTs", "Codex", "Sora", "Upgrade"]) await expect(side).not.toContainText(absent);

  // Chats: the newest under „Чатове“, pinned ones under „Закачени“, „Вижте всички…“ opens the search.
  await send(page, "Първи тестов въпрос");
  await expect(lastAnswer(page)).toContainText("Тестов отговор");
  await expect(side.getByTestId("side-chats")).toBeVisible();
  await expect(side.getByTestId("side-pinned")).toHaveCount(0);
  await side.locator(".row", { hasText: "Първи тестов въпрос" }).getByRole("button", { name: "Опции на чата" }).click();
  await page.locator(".pop").getByRole("menuitem", { name: "Закачи" }).click();
  await expect(side.getByTestId("side-pinned")).toContainText("Закачени");
  await side.getByTestId("side-all").click();
  await expect(page.locator(".modal")).toContainText("Търсене в чатовете");
  await page.keyboard.press("Escape");

  // Collapse: the same rows as icons; ONE toggle (the rail's), none duplicated in the top bar.
  await side.getByTestId("side-toggle").click();
  await expect(side).toHaveClass(/\bmin\b/);
  await expect(side.getByTestId("side-library").locator("span")).toBeHidden();
  await expect(side.getByTestId("side-library").locator("svg")).toBeVisible();
  await expect(page.locator(".top").getByRole("button", { name: "Отвори лентата" })).toHaveCount(0);
  await side.getByTestId("side-toggle").click();
  await expect(side).not.toHaveClass(/\bmin\b/);
  await g.check();
});

test("top bar: model button, centred Чат | Работа; the home follows the mode", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  await expect(page.getByTestId("model-btn")).toHaveText(/^Тед/);
  const toggle = page.getByTestId("mode-toggle");
  await expect(toggle.getByRole("tab")).toHaveText(["Чат", "Работа"]);
  await expect(toggle.getByRole("tab", { name: "Чат" })).toHaveAttribute("aria-selected", "true");
  // Centred in the window's main area (ChatGPT desktop).
  const bar = await page.locator(".top").boundingBox();
  const seg = await toggle.boundingBox();
  expect(Math.abs(seg.x + seg.width / 2 - (bar.x + bar.width / 2))).toBeLessThan(40);

  await expect(page.locator(".home h1")).toHaveText("Здравейте, Тест. Готови ли сте?");
  await expect(page.locator("#composer")).toHaveAttribute("placeholder", "Попитайте каквото и да е");
  await expect(page.getByTestId("home-plugins")).toHaveCount(0);
  await shot(page, "shell-desktop-home-chat.png");

  await toggle.getByRole("tab", { name: "Работа" }).click();
  await expect(toggle.getByRole("tab", { name: "Работа" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".home h1")).toHaveText("Върху какво ще работим?");
  await expect(page.locator("#composer")).toHaveAttribute("placeholder", "Направете каквото и да е");
  const plugins = page.getByTestId("home-plugins");
  await expect(plugins.locator(".hp-row")).toHaveCount(5);
  for (const t of ["CRM „Имоти Надежда“", "ChatGPT план (Real GPT)", "Интернет", "Имейл през CRM", "Календар през CRM"]) await expect(plugins).toContainText(t);
  await expect(plugins.locator(".hp-row", { hasText: "ChatGPT план" })).toContainText("Свържи");
  await expect(plugins.locator(".hp-row", { hasText: "Календар" })).toContainText("Свързан"); // a real calendar.list read answered
  expect((await mockCalls(page)).read).toContain("calendar.list");
  await shot(page, "shell-desktop-home-work.png");
  await noHorizontalScroll(page);
  await toggle.getByRole("tab", { name: "Чат" }).click();
  await g.check();
});

test("home chips fill or arm the composer and never send", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  const chips = page.getByTestId("home-chips");
  await expect(chips.getByRole("button")).toHaveText(["Създай изображение", "Пиши или редактирай", "Потърси нещо", "Намери имот", "Прегледай документи", "Прикачи имот", "Още"]);
  // Тед (сървър): the hint is a visible prefix of the question.
  await chips.getByRole("button", { name: "Създай изображение" }).click();
  await expect(page.locator("#composer")).toHaveValue("Създай изображение: ");
  await page.fill("#composer", "");
  await chips.getByRole("button", { name: "Пиши или редактирай" }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /Договор от нулата/ }).click();
  await expect(page.locator("#composer")).toHaveValue(/^Напиши договор за наем/);
  await chips.getByRole("button", { name: "Още" }).click();
  for (const t of ["Имоти и клиенти", "Календар и огледи", "Документи и преводи", "Сметки и лихви", "Текстове и писма", "Справки"]) await expect(page.locator(".pop")).toContainText(t);
  await page.locator(".pop").getByRole("menuitem", { name: /Сметки и лихви/ }).click();
  await expect(page.locator("#composer")).toHaveValue(/ипотека/);
  await chips.getByRole("button", { name: "Намери имот" }).click();
  await expect(page.locator(".modal")).toContainText("Прикачи имот");
  await page.keyboard.press("Escape");
  await chips.getByRole("button", { name: "Прегледай документи" }).click();
  await expect(page.locator(".modal")).toContainText("Документи");
  await page.keyboard.press("Escape");
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await g.check();
});

test("„+“ menu: ChatGPT items, submenus Още › and Проекти ›; picking a project tags the composer", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  await page.locator(".c-plus").click();
  const pop = page.locator(".pop");
  await expect(pop.getByRole("menuitem")).toHaveText([/^Добави снимки и файлове/, /^Последни файлове/, /^Създай изображение/, /^Мислене/, /^Задълбочено проучване/, /^Търсене в мрежата/, /^Още/, /^Проекти/]);
  await shot(page, "shell-desktop-plus.png");
  await pop.getByRole("menuitem", { name: /^Още/ }).click();
  await expect(pop.getByRole("menuitem")).toHaveText([/^Назад/, /^Canvas/, /^Видео на имот/, /^Документи от CRM/, /^Имот от CRM/, /^Нов проект/, /^Умения и роли/, /^Свързани услуги/]);
  await pop.getByRole("menuitem", { name: /^Назад/ }).click();
  await pop.getByRole("menuitem", { name: /^Последни файлове/ }).click();
  await expect(pop).toContainText("Последни файлове");
  await pop.getByRole("menuitem", { name: /^Назад/ }).click();
  await pop.getByRole("menuitem", { name: /^Проекти/ }).click();
  await expect(pop).toContainText("Общ разговор");
  await expect(pop).toContainText("Нов проект…");
  await pop.getByRole("menuitem", { name: /Тестов казус · наем/ }).click();
  await expect(page.getByTestId("case-pill")).toContainText("Казус: Тестов казус · наем");
  await page.getByTestId("case-pill").getByRole("button", { name: "Махни казуса" }).click();
  await expect(page.getByTestId("case-pill")).toHaveCount(0);
  // Още › Canvas opens an empty document beside the chat.
  await page.locator(".c-plus").click();
  await pop.getByRole("menuitem", { name: /^Още/ }).click();
  await pop.getByRole("menuitem", { name: /^Canvas/ }).click();
  await expect(page.locator(".canvas")).toBeVisible();
  await page.getByRole("button", { name: "Затвори Canvas" }).click();
  // Още › Умения и роли = the Агенти page.
  await page.locator(".c-plus").click();
  await pop.getByRole("menuitem", { name: /^Още/ }).click();
  await pop.getByRole("menuitem", { name: /^Умения и роли/ }).click();
  await expect(page.getByTestId("agents-page")).toContainText("Роля на Тед");
  await g.check();
});

test("model + effort pill: Разширени → Модел › / Усилие ›; effort only for Real GPT; a hint arms the question", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200&rg=1&rgStep=20");
  const pill = page.getByTestId("effort-pill");
  await expect(pill).toHaveText(/Тед Асистент · сървър/);
  await pill.click();
  const pop = page.locator(".pop");
  await expect(pop.getByRole("menuitem")).toHaveText([/^Модел/, /^Усилие.*само за Real GPT/]);
  await pop.getByRole("menuitem", { name: /^Усилие/ }).click();
  await expect(pop.getByRole("menuitem", { name: /Усилие/ })).toHaveAttribute("aria-disabled", "true");
  await pop.getByRole("menuitem", { name: /^Назад/ }).click();
  await pop.getByRole("menuitem", { name: /^Модел/ }).click();
  await expect(pop).toContainText("Тед Асистент · Сървър");
  await pop.getByRole("menuitem", { name: /Тест GPT А/ }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · Тест GPT А");
  await expect(pill).toHaveText(/Тест GPT А · Стандартно/);
  await pill.click();
  await pop.getByRole("menuitem", { name: /^Усилие/ }).click();
  await expect(pop.getByRole("menuitem")).toHaveText([/Назад/, /Стандартно/, /Мигновено/, /Ниско/, /Средно/, /Високо/, /Много високо/]);
  await shot(page, "shell-desktop-effort.png");
  await pop.getByRole("menuitem", { name: /Ниско/ }).click();
  await expect(pill).toHaveText(/Тест GPT А · Ниско/);

  // „Мислене“ from the „+“ menu: a removable tag; the question is sent with it (a lower chosen effort becomes high).
  await page.locator(".c-plus").click();
  await pop.getByRole("menuitem", { name: /^Мислене/ }).click();
  await expect(page.getByTestId("hint-thinking")).toContainText("Мислене");
  await page.locator(".c-plus").click();
  await pop.getByRole("menuitem", { name: /^Търсене в мрежата/ }).click();
  await page.getByTestId("hint-search").getByRole("button").click();
  await expect(page.getByTestId("hint-search")).toHaveCount(0);
  await send(page, "Тестов въпрос с мислене");
  await answerConsent(page, "Само текст");
  await expect(page.locator('.msg.a[data-engine="realgpt"]').last()).toContainText("Данните са измислени", { timeout: 10000 });
  await expect(page.locator(".msg.u .uhints").last()).toContainText("Мислене");
  await expect(page.getByTestId("hint-thinking")).toHaveCount(0); // hints are per question
  const calls = await mockCalls(page);
  // „Мислене“ raises the chosen lower effort (Ниско) to high for this question (review fix; as MAIN does for the agent).
  expect(calls.rgSend.at(-1)).toMatchObject({ effort: "high", last: "Тестов въпрос с мислене" });
  await g.check();
});

test("settings: the ChatGPT groups and rows, Обновления in Общи, red sign-out at the end", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  await openSettings(page);
  const list = page.locator(".modal .set-list");
  await expect(list.locator(".set-prof")).toContainText("Тест Служител");
  await expect(list.locator(".set-grp-h")).toHaveText(["Направете Тед по ваш избор", "Акаунт", "Тема", "Настройки на приложението", "За помощ"]);
  await expect(list.locator(".set-row .tx")).toHaveText(["Персонализиране", "Памет", "Плъгини", "Имейл", "ChatGPT акаунт", "Използване и лимити", "Външен вид", "Акцентен цвят",
    "Общи", "Модел", "Известия", "Глас", "Диктовка", "Безопасност", "Сигурност и вход", "Браузър", "Съхранение", "Контрол на данните",
    "Съобщете за проблем", "Помощен център", "Център за поверителност", "Относно", "Излизане от акаунта"]);
  for (const absent of ["Абонамент", "Възстановяване на покупките", "Възраст", "Родителски контрол", "Codex"]) await expect(list).not.toContainText(absent);
  // Общи: the 0.1.2 switches + Обновления (honest status, whatever this build supports).
  const pane = page.locator('.pane[data-pane="general"]');
  for (const id of ["#sw-boot", "#sw-compact", "#sw-big", "#sw-enter", "#sw-acts"]) await expect(pane.locator(id)).toBeVisible();
  const upd = page.getByTestId("updates");
  await expect(upd).toContainText("Обновления");
  await expect(upd).toContainText(/само в инсталираната програма|последната версия|Още не е проверявано/);
  await shot(page, "shell-desktop-settings.png");
  // Тема: only our palette, said plainly.
  await list.locator('.set-row[data-row="theme"]').click();
  await expect(page.locator('.pane[data-pane="theme"]')).toContainText("Имоти Надежда");
  await expect(page.locator('.pane[data-pane="theme"]')).toContainText("не са направени");
  // Персонализиране is saved to settings and goes with Real GPT questions.
  await list.locator('.set-row[data-row="personal"]').click();
  await page.fill("#set-nick", "Тести");
  await page.locator('.pane[data-pane="personal"]').getByRole("button", { name: "Запази" }).click();
  await expect(page.locator(".toast")).toContainText("Запазено");
  await page.keyboard.press("Escape");
  await expect(page.locator(".home h1")).toHaveText("Здравейте, Тести. Готови ли сте?");
  // The red row signs out of the CRM.
  await openSettings(page);
  await list.locator('.set-row[data-row="logout"]').click();
  await expect(page.locator("#lg-id")).toBeVisible();
  await g.check();
});

test("update ready: banner under the top bar and „Рестартирай и обнови“", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&upd=ready");
  await openSettings(page);
  const upd = page.getByTestId("updates");
  await expect(upd.getByTestId("upd-status")).toContainText("изтеглена");
  await expect(upd.getByRole("button", { name: "Рестартирай и обнови" })).toBeVisible();
  await page.keyboard.press("Escape");
  const banner = page.getByTestId("upd-banner");
  await expect(banner).toContainText("Ще се инсталира при затваряне");
  await expect(banner.getByRole("button", { name: "Рестартирай и обнови" })).toBeVisible();
  await shot(page, "shell-desktop-update.png");
  await g.check();
});

test("pages: Проекти, Планирани, Библиотека, Плъгини, Агенти show real data or say what is missing", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  const side = page.locator("aside.side");
  await side.getByTestId("side-projects").click();
  await expect(page.getByTestId("project-item")).toHaveCount(2);
  await page.getByTestId("project-item").first().getByRole("button", { name: "Отвори" }).click();
  await expect(page.getByTestId("case-page")).toBeVisible();
  await side.getByTestId("side-scheduled").click();
  await expect(page.getByTestId("scheduled-page")).toContainText("Календар в CRM");
  await expect(page.getByTestId("scheduled-page")).toContainText(/Няма събития|Задачи на този компютър/);
  await side.getByTestId("side-library").click();
  await expect(page.getByTestId("library-page")).toContainText(/Още няма файлове|Всички/);
  await side.getByTestId("side-plugins").click();
  const pl = page.getByTestId("plugins-page");
  for (const t of ["CRM „Имоти Надежда“", "ChatGPT план (Real GPT)", "Интернет", "Имейл през CRM", "Календар през CRM"]) await expect(pl).toContainText(t);
  await expect(pl.locator('[data-plugin="crm"] .status')).toHaveText("Свързано");
  await pl.locator('[data-plugin="chatgpt"]').getByRole("button", { name: "Свържи" }).click();
  await expect(page.locator(".modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await shot(page, "shell-desktop-plugins.png");
  await side.getByTestId("side-agents").click();
  await expect(page.getByTestId("agents-page")).toContainText("Вградени умения");
  await g.check();
});

test("„Отговори пак“ and inline „Редактирай“ resend the question; a CRM change asks first", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150");
  await send(page, "Дай ми справка за март");
  await expect(lastAnswer(page)).toContainText("Тестова справка");
  await lastAnswer(page).locator(".macts").getByRole("button", { name: "Отговори пак" }).click();
  await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(2);
  await expect(page.locator(".msg.a[data-engine=server]")).toHaveCount(1);
  expect((await mockCalls(page)).chat[1]).toMatchObject({ count: 1, last: "Дай ми справка за март" });

  // Inline edit of the newest question: question and answer are replaced, the history before stays.
  await page.locator(".msg.u").last().getByRole("button", { name: "Редактирай" }).click();
  await page.fill("#edit-q", "Дай ми справка за април");
  await page.getByTestId("edit-box").getByRole("button", { name: "Изпрати" }).click();
  await expect(page.locator(".msg.u")).toHaveCount(1);
  await expect(page.locator(".msg.u .bub")).toHaveText("Дай ми справка за април");
  await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(3);
  expect((await mockCalls(page)).chat[2]).toMatchObject({ count: 1, last: "Дай ми справка за април" });
  await expect(lastAnswer(page)).toContainText("Тестова справка");
  await expect(page.getByTestId("waiting")).toHaveCount(0);

  // The default test answer recorded a calendar change: regenerating it asks first.
  await send(page, "Запиши оглед");
  await expect(lastAnswer(page)).toContainText("записах оглед");
  await lastAnswer(page).locator(".macts").getByRole("button", { name: "Отговори пак" }).click();
  await expect(page.locator(".modal")).toContainText("Да отговоря ли пак?");
  await page.locator(".modal .mf").getByRole("button", { name: "Отказ" }).click();
  expect((await mockCalls(page)).chat).toHaveLength(4);
  await g.check();
});

test("phone: drawer like the ChatGPT app, mode in the model menu, settings full screen, no overflow", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, "lat=200");
  await expect(page.locator(".top.ph")).toBeVisible();
  await expect(page.locator(".home h1")).toHaveText("Здравейте, Тест. Готови ли сте?");
  await expect(page.getByTestId("home-chips")).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "shell-phone-home.png");
  await send(page, "Тестов въпрос от телефона");
  await expect(lastAnswer(page)).toContainText("Тестов отговор");
  await page.locator(".top.ph").getByRole("button", { name: "Опции на разговора" }).click();
  await page.locator(".pop").getByRole("menuitem", { name: "Закачи" }).click();

  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  const drawer = page.locator(".side.open");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".side-name")).toHaveText("Тед");
  await expect(drawer.getByTestId("side-search")).toBeVisible();
  const order = await testIds(drawer.locator(".nav[data-testid]"));
  expect(order).toEqual(["side-scheduled", "side-projects", "side-library", "side-plugins", "side-agents", "side-personal"]);
  await expect(drawer.getByTestId("side-pinned")).toHaveText("Закачено");
  await expect(drawer).toContainText("Тестов въпрос от телефона");
  await expect(drawer.getByTestId("side-all")).toContainText("Вижте всички…");
  await expect(drawer.getByTestId("drawer-new")).toHaveText("Чат");
  await expect(drawer.getByTestId("me-btn")).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "shell-phone-drawer.png");
  await drawer.getByTestId("drawer-new").click();
  await expect(page.locator(".side.open")).toHaveCount(0);
  await expect(page.locator(".home h1")).toBeVisible();

  // Чат | Работа sits in the model menu on the phone (as in the ChatGPT app).
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByTestId("mode-toggle").getByRole("tab", { name: "Работа" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".home h1")).toHaveText("Върху какво ще работим?");
  await expect(page.getByTestId("home-plugins")).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "shell-phone-home-work.png");

  await page.locator(".c-plus").click();
  await expect(page.locator(".pop")).toContainText("Добави снимки и файлове");
  await shot(page, "shell-phone-plus.png");
  await page.keyboard.press("Escape");

  await openSettings(page);
  await expect(page.locator(".modal .set-row").first()).toContainText("Персонализиране");
  await shot(page, "shell-phone-settings.png");
  await page.locator('.modal .set-row[data-row="general"]').click();
  await expect(page.getByTestId("updates")).toBeVisible();
  await page.locator(".modal .back-b").click();
  await expect(page.locator(".modal .set-list")).toBeVisible();
  await page.locator(".modal .mh").getByRole("button", { name: "Затвори" }).click();

  // Персонализиране from the drawer opens that settings page directly.
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.locator(".side.open").getByTestId("side-personal").click();
  await expect(page.locator('.pane[data-pane="personal"] h3')).toHaveText("Персонализиране");
  await g.check();
});

test("desktop reference screenshot at 1366x820 with a finished chat and the Real GPT indicator", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=150&rg=1");
  await send(page, "Намери имоти и запиши оглед");
  await expect(lastAnswer(page).getByTestId("actions-card")).toBeVisible();
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Тест GPT А/ }).click();
  await expect(page.getByTestId("rg-ind")).toContainText("Използва вашия ChatGPT план");
  await shot(page, "shell-desktop-chat.png");
  await page.setViewportSize(DESKTOP);
  await noHorizontalScroll(page);
  await g.check();
});
