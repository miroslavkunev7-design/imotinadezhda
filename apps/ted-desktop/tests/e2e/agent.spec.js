// 0.1.3 FEATURES: the Real GPT agent in the renderer (docs/CONTRACT.md §8, §16, §17) – consent, live „Изпълнение“
// steps, approvals (allow / deny / allow_all), FileCards (preview, Отвори, Запази…), internet results, documents,
// reworked attachments, Canvas versions from the agent with a sanitised SVG preview, „Отвори в ChatGPT“ cards for
// pictures and video (Real GPT uses only the ChatGPT plan, §9.6), paid video of Ted's server (approval → progress →
// stitched clip), tools_unsupported without any other engine, the step limit, the library, scheduled tasks and the
// updater states. Mock build only (src/mock/bridge.mock.js); every value is fictional; no network.
import { test, expect } from "@playwright/test";
import { PHONE, guard, login, mockCalls, noHorizontalScroll, openActivity, openSettings, send, shot } from "./helpers.js";

const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();
const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=120";

async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 15000 });

test("consent: asked once per ChatGPT account; „Разбирам“ turns Ted's tools on", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1&rgStep=12");
  await pickRgModel(page);
  await send(page, "Здравей");
  const modal = page.getByTestId("consent-modal");
  await expect(modal.locator(".consent-q")).toHaveText("Real GPT ползва само вашия ChatGPT план. Тед дава достъп до CRM, интернет и файловете на този компютър; друг изкуствен интелект не се ползва.");
  await expect(modal).toContainText("chatgpt.test@example.test");
  await expect(modal).toContainText("промени, записи и имейл в CRM винаги искат вашето потвърждение");
  await expect(modal).toContainText("Снимки и видео се правят в приложението ChatGPT с вашия план");
  await expect(page.locator(".modal").getByRole("button", { name: "Разбирам", exact: true })).toBeVisible();
  await expect(page.locator(".modal").getByRole("button", { name: "Само текст", exact: true })).toBeVisible();
  expect((await mockCalls(page)).rgSend).toHaveLength(0); // nothing is sent before the answer
  await shot(page, "agent-consent.png");
  await page.locator(".modal").getByRole("button", { name: "Разбирам", exact: true }).click();
  await expect(rgAnswer(page)).toContainText("с разрешени инструменти");
  await finished(rgAnswer(page));
  await expect(rgAnswer(page)).not.toContainText("без инструменти");
  await send(page, "Още един въпрос");
  await expect(page.locator('.msg.a[data-engine="realgpt"]')).toHaveCount(2);
  await expect(page.getByTestId("consent-modal")).toHaveCount(0); // once per account
  const calls = await mockCalls(page);
  expect(calls.consent).toEqual(["all"]);
  expect(calls.rgSend.map((c) => [c.consent, c.mode])).toEqual([["all", "chat"], ["all", "chat"]]);
  await g.check();
});

test("consent „Само текст“: the 0.1.2 request without tools, the answer is tagged „без инструменти“", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1&rgStep=12&agent=1");
  await pickRgModel(page);
  await send(page, "Намери обяви");
  await page.locator(".modal").getByRole("button", { name: "Само текст", exact: true }).click();
  const a = rgAnswer(page);
  await expect(a).toContainText("няма достъп до CRM");
  await expect(a.locator(".foot-tags")).toContainText("без инструменти");
  await expect(a.getByTestId("agent-steps")).toHaveCount(0);
  const calls = await mockCalls(page);
  expect(calls.rgSend[0]).toMatchObject({ consent: "text" });
  expect(calls.rgSend[0].mode).toBeUndefined(); // no agent arguments without the consent
  await g.check();
});

test("agent: live steps, a CRM write waits for „Разреши“, the document comes back as a FileCard", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери имоти и запиши оглед");
  const a = rgAnswer(page);
  const steps = a.getByTestId("agent-steps");
  // 0.1.5: while running ONE line with the current step and the time; the full list opens with a click.
  await expect(steps).toHaveAttribute("data-state", "running");
  await expect(a.getByTestId("activity-time")).toBeVisible();
  await openActivity(a);
  await expect(steps).toContainText("Търся в интернет: Намери имоти и запиши оглед");
  await expect(steps).toContainText("Чета страница: example.test/pazar-test");
  await expect(steps).toContainText("CRM: имоти.търсене");
  await expect(steps).toContainText("Правя документ: Тестова справка.docx");
  const ap = a.getByTestId("approval-card");
  await expect(ap).toContainText("Ново събитие в календара");
  await expect(ap).toContainText("Тестов оглед на ТЕСТ-101");
  await expect(ap).toContainText("Без отговор до 10 минути = отказ");
  // The exact data that will be sent is one click away (security review: nothing hidden on the card).
  const json = ap.getByTestId("approval-json");
  await expect(json.locator("pre")).toBeHidden();
  await json.locator("summary").click();
  await expect(json.locator("pre")).toContainText('"client_name": "Тестов Клиент А"');
  await expect(steps.getByTestId("steps-status")).toHaveText("Чака вашето решение");
  await expect(steps.locator('li[data-status="wait"]')).toContainText("CRM: календар.ново събитие");
  await expect(a.getByTestId("activity-text")).toHaveText("Чака вашето решение: CRM: календар.ново събитие");
  await expect(a.getByTestId("file-card")).toContainText("Тестова справка.docx"); // shown as soon as it exists
  await shot(page, "agent-approval.png");

  await ap.getByRole("button", { name: "Разреши", exact: true }).click();
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  await expect(a).toContainText("Записах тестовия оглед в календара.");
  await finished(a);
  await expect(steps).toHaveAttribute("data-state", "done");
  await expect(a.getByTestId("activity-text")).toHaveText("Претърси интернет, прочете 1 страница, изпълни 2 действия в CRM и направи 1 документ");
  await openActivity(a);
  await expect(steps.getByTestId("steps-status")).toHaveText("Изпълнено");
  await expect(steps.locator(".ribbon")).toHaveText("промени в CRM");
  await expect(steps.locator('li[data-status="ok"]')).toHaveCount(5);

  const card = a.getByTestId("file-card");
  await expect(card).toHaveAttribute("data-kind", "docx");
  await expect(card).toContainText("направен от ChatGPT на този компютър");
  await card.getByRole("button", { name: "Отвори" }).click();
  await card.getByRole("button", { name: "Запази…" }).click();
  await expect(page.locator(".toast")).toContainText("Запазено: C:\\Users\\Test\\Documents\\Тестова справка.docx");
  const calls = await mockCalls(page);
  expect(calls.approve).toEqual([{ approvalId: expect.stringMatching(/^ap_test/), decision: "allow" }]);
  expect(calls.filesOpen).toEqual([await card.getAttribute("data-file")]);
  expect(calls.filesSave).toHaveLength(1);
  await shot(page, "agent-done.png");
  await g.check();
});

test("agent: „Откажи“ leaves CRM unchanged; „Разреши всички“ is the allow_all decision of that answer only", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Запиши оглед");
  let a = rgAnswer(page);
  await a.getByTestId("approval-card").getByRole("button", { name: "Откажи" }).click();
  await expect(a).toContainText("Огледът не е записан – отказахте.");
  await finished(a);
  await expect(a.getByTestId("activity-text")).toContainText("· 1 отказана");
  await openActivity(a);
  await expect(a.locator('li[data-status="denied"]')).toContainText("CRM: календар.ново събитие");
  await expect(a.getByTestId("steps-status")).toHaveText("Частично изпълнено");
  await expect(a.getByTestId("agent-steps").locator(".ribbon")).toHaveCount(0); // nothing changed in CRM

  await send(page, "Запиши още един оглед");
  a = rgAnswer(page);
  await expect(page.locator('.msg.a[data-engine="realgpt"]')).toHaveCount(2);
  await a.getByTestId("approval-card").getByRole("button", { name: "Разреши всички в този отговор" }).click();
  await expect(a).toContainText("Записах тестовия оглед");
  const calls = await mockCalls(page);
  expect(calls.approve.map((x) => x.decision)).toEqual(["deny", "allow_all"]);
  await g.check();
});

test("internet: listings as a table with the real links; photos inline; fetched photos are FileCards", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери обяви за двустаен в Тестоград");
  let a = rgAnswer(page);
  await finished(a);
  await openActivity(a);
  const steps = a.getByTestId("agent-steps");
  await expect(steps).toContainText("Търся в интернет: тестови обяви двустаен Тестоград");
  await expect(steps).toContainText("Чета страница: example.test/obiava-101");
  await expect(a.locator(".md table")).toContainText("Тестов двустаен апартамент");
  await expect(a.locator(".md table")).toContainText("99 000 €");
  await expect(a.locator(".md table")).toContainText("+359 00 000 0001");
  await expect(a.locator(".md a.md-a").first()).toHaveAttribute("href", "https://example.test/obiava-101");
  await expect(a.getByTestId("md-img")).toHaveCount(5);
  await expect(a.getByTestId("file-card")).toHaveCount(0); // nothing downloaded into the store for showing

  // Downloading the photos as files (fetch_image): FileCards with preview, and the same photos inline from the store.
  await send(page, "Изтегли снимките от първия линк");
  await expect(page.locator('.msg.a[data-engine="realgpt"]')).toHaveCount(2);
  a = rgAnswer(page);
  await finished(a);
  await openActivity(a);
  await expect(a.getByTestId("agent-steps")).toContainText("Изтеглям снимка: example.test/img/obiava-101-1.png");
  const photos = a.locator('[data-testid="file-card"][data-kind="image"]');
  await expect(photos).toHaveCount(2);
  await expect(photos.first()).toContainText("от интернет");
  await expect(photos.first()).toContainText("Източник: example.test/img/obiava-101-1.png");
  await expect(photos.first().locator(".fc-img img")).toHaveAttribute("src", /^data:image\/(jpeg|png);base64,/);
  await photos.first().locator(".fc-img").click();
  const lb = page.getByTestId("file-lightbox");
  await expect(lb.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => lb.locator("img").evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  await shot(page, "agent-listings-lightbox.png");
  await page.keyboard.press("Escape");
  await expect(lb).toHaveCount(0);
  await g.check();
});

test("browsing off (Настройки → Браузър): the agent says so and does not search", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT + "&browse=0");
  await pickRgModel(page);
  await send(page, "Намери обяви");
  const a = rgAnswer(page);
  await expect(a).toContainText("Интернетът е изключен в Настройки → Браузър");
  await finished(a);
  await openActivity(a);
  await expect(a.getByTestId("agent-steps")).not.toContainText("Търся в интернет");
  await g.check();
});

test("picture with Real GPT: a „Отвори в ChatGPT“ card with the exact prompt – nothing opens until the click", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("activity-text")).toContainText("Подготви заявка за ChatGPT");
  await openActivity(a);
  await expect(a.getByTestId("agent-steps")).toContainText("Заявка за ChatGPT: снимка");
  await expect(a.getByTestId("agent-steps")).not.toContainText("Генерирам снимка");
  await expect(a).toContainText("Оттук не мога да създам снимка");
  const card = a.getByTestId("chatgpt-card");
  await expect(card).toHaveAttribute("data-kind", "image");
  await expect(card).toContainText("Създаването на снимки и видео с вашия ChatGPT план става в ChatGPT – в панела ChatGPT тук, в Тед");
  const ta = card.getByTestId("chatgpt-prompt");
  await expect(ta).toHaveValue(/^Фотореалистична снимка \(16:9\) на тестова дневна/);
  await expect(a.getByTestId("file-card")).toHaveCount(0); // no picture is claimed or made
  let calls = await mockCalls(page);
  expect(calls.openInChatGpt).toEqual([]);                   // never opened by itself
  expect(calls.openExternal).toEqual([]);
  await shot(page, "agent-open-in-chatgpt.png");
  await card.getByTestId("chatgpt-copy").click();
  await expect(page.locator(".toast")).toContainText("Заявката е копирана");
  await ta.fill("Снимка на хол, топли цветове & дървен под #2");   // the employee may edit the prompt
  // 0.1.7: the main button opens the ChatGPT panel in Ted (MAIN builds the address); the browser is the secondary link.
  await card.getByTestId("chatgpt-open").click();
  await expect(page.locator(".toast")).toContainText("ChatGPT е отворен в панела");
  await expect(page.getByTestId("chatgpt-panel")).toBeVisible();
  calls = await mockCalls(page);
  expect(calls.copy.at(-1)).toMatch(/^Фотореалистична снимка/);
  const want = { prompt: "Снимка на хол, топли цветове & дървен под #2", url: "https://chatgpt.com/?q=" + encodeURIComponent("Снимка на хол, топли цветове & дървен под #2") };
  expect(calls.chatgptOpen).toEqual([want]);
  expect(calls.openInChatGpt).toEqual([]);
  await card.getByTestId("chatgpt-open-browser").click();
  await expect(page.locator(".toast")).toContainText("Отворих ChatGPT в браузъра");
  calls = await mockCalls(page);
  expect(calls.openInChatGpt).toEqual([want]);
  expect(calls.openExternal).toEqual([]);                    // the page never builds or opens a link itself
  expect(calls.chat).toHaveLength(0);                        // Ted's server engine is never asked
  await ta.fill("   ");
  await expect(card.getByTestId("chatgpt-open")).toBeDisabled();
  await g.check();
});

test("„+“ with Real GPT: „Създай изображение“ and „Още › Видео“ are hints for a ChatGPT card; the engine is named", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await expect(page.getByTestId("engine-tag")).toHaveText("ChatGPT");
  await page.locator(".c-plus").click();
  await expect(page.locator(".pop").getByRole("menuitem", { name: /^Създай изображение/ })).toContainText("в панела ChatGPT с вашия план");
  await page.locator(".pop").getByRole("menuitem", { name: /^Създай изображение/ }).click();
  await expect(page.getByTestId("hint-image")).toBeVisible();
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await expect(page.locator(".pop").getByRole("menuitem", { name: /^Видео на имот/ })).toHaveCount(0); // no AI video of the server here
  await page.locator(".pop").getByRole("menuitem", { name: /^Видео/ }).click();
  await expect(page.getByTestId("hint-video")).toBeVisible();
  await expect(page.locator(".modal")).toHaveCount(0);
  await send(page, "Разходка из тестовия апартамент");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("chatgpt-card")).toHaveAttribute("data-kind", "video");
  const calls = await mockCalls(page);
  expect(calls.rgSend.at(-1)).toMatchObject({ hints: ["image", "video"], consent: "all" });
  expect(calls.videoPrepare || []).toHaveLength(0);
  // The model menu says what each engine uses; the server engine keeps its own AI video.
  await page.getByTestId("model-btn").click();
  await expect(page.getByTestId("engine-note-realgpt")).toHaveText("само вашият ChatGPT план – без друг изкуствен интелект");
  await expect(page.getByTestId("engine-note-server")).toContainText("Тед на сървъра");
  await page.locator(".pop").getByRole("menuitem", { name: /По подразбиране/ }).click();
  await expect(page.getByTestId("engine-tag")).toHaveText("Тед");
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await expect(page.locator(".pop").getByRole("menuitem", { name: /^Видео на имот/ })).toBeVisible();
  await g.check();
});

test("attached Word file: read on this computer, a reworked .docx comes back", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await page.setInputFiles('[data-testid="files-in"]', { name: "тестов-договор.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK\u0003\u0004 тестов word/document.xml") });
  await expect(page.locator(".cfile")).toContainText("тестов-договор.docx");
  await send(page, "Преработи договора с по-кратки изречения");
  const a = rgAnswer(page);
  await finished(a);
  await openActivity(a);
  await expect(a.getByTestId("agent-steps")).toContainText("Чета файла: тестов-договор.docx");
  await expect(a.getByTestId("agent-steps")).toContainText("Правя документ: Преработен – тестов-договор.docx");
  await expect(a.getByTestId("file-card")).toContainText("Преработен – тестов-договор.docx");
  await expect(a).toContainText("Прочетох „тестов-договор.docx“");
  const calls = await mockCalls(page);
  expect(calls.rgSend.at(-1).files).toHaveLength(1);              // the model gets the store id, not the bytes
  expect(calls.filesAdd.some((f) => f.name === "тестов-договор.docx" && f.chatId)).toBe(true);
  await g.check();
});

test("e-mail from the agent is only a draft shown with the existing card; nothing is sent by the model", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Подготви имейл с офертата до клиента");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a).toContainText("нищо не е изпратено");
  const mail = a.getByTestId("email-card");
  await expect(mail).toContainText("Тестова оферта за ТЕСТ-101");
  await openActivity(a);
  await expect(a.getByTestId("agent-steps")).toContainText("CRM: имейл.чернова");
  expect((await mockCalls(page)).confirmSend).toBe(0);
  await g.check();
});

// The draft's watermark is the answer's own time (App.jsx run()), so the newest agent draft stays sendable.
test("the agent's newest draft can be sent with „✅ Да, изпрати“ (native confirmation)", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Подготви имейл с офертата до клиента");
  const a = rgAnswer(page);
  await finished(a);
  const mail = a.getByTestId("email-card");
  await expect(mail.getByRole("button", { name: "✅ Да, изпрати" })).toBeEnabled();
  await mail.getByRole("button", { name: "✅ Да, изпрати" }).click();
  await expect.poll(async () => (await mockCalls(page)).confirmSend).toBe(1);
  await g.check();
});

test("Canvas: the agent adds a NEW version, „Преглед“ shows Markdown and a sanitised SVG chart, export", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  // The employee's own draft first: it must survive the agent's edit.
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Canvas/ }).click();
  await page.fill("#cv-txt", "Моя тестова чернова");
  await page.getByRole("button", { name: "Запази версия" }).click();
  await send(page, "Напиши договор за наем в Canvas");
  const a = rgAnswer(page);
  await finished(a);
  const cv = page.getByTestId("canvas");
  await expect(cv.locator("#cv-ver option")).toHaveText(["Версия 1", "Версия 2 · ръчна редакция", "Версия 3 · ChatGPT: първа чернова"]);
  await expect(cv.locator("#cv-ver")).toHaveValue("3");
  await expect(cv.locator("#cv-txt")).toHaveValue(/^# Тестов договор за наем/);
  expect((await mockCalls(page)).rgSend.at(-1).canvas).toMatchObject({ title: "Нов документ", version: 2 }); // the open document went along

  await cv.getByRole("tab", { name: "Преглед" }).click();
  const prev = cv.getByTestId("canvas-preview");
  await expect(prev.locator(".mdh").first()).toHaveText("Тестов договор за наем");
  await expect(prev.locator("ol li")).toHaveCount(3);
  const img = prev.locator("img.cv-svg");
  await expect(img).toHaveCount(1);
  await expect.poll(() => img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  const svg = Buffer.from((await img.getAttribute("src")).split(",")[1], "base64").toString("utf8");
  expect(svg).toContain("<rect");
  expect(svg).toContain("Тестова графика");
  expect(svg).not.toMatch(/script|onclick|<image|example\.test|alert/);
  await expect(prev.locator("script, iframe, foreignObject")).toHaveCount(0);
  await shot(page, "agent-canvas-preview.png");

  // Back to the older version: nothing was overwritten.
  await cv.locator("#cv-ver").selectOption("2");
  await expect(prev).toContainText("Моя тестова чернова");

  // Export: Word/PDF through the agent (Real GPT with tools), Markdown through the save dialog.
  await cv.locator("#cv-ver").selectOption("3");
  await cv.getByRole("button", { name: "Експорт" }).click();
  await expect(cv.locator(".cv-menu").getByRole("menuitem")).toHaveText(["Word (.docx)", "PDF (.pdf)", "Markdown (.md)"]);
  await cv.locator(".cv-menu").getByRole("menuitem", { name: "Word (.docx)" }).click();
  await expect.poll(async () => (await mockCalls(page)).rgSend.at(-1).last).toContain("Експортирай документа от Canvas");
  await finished(rgAnswer(page));
  await cv.getByRole("button", { name: "Експорт" }).click();
  await cv.locator(".cv-menu").getByRole("menuitem", { name: "Markdown (.md)" }).click();
  await expect.poll(async () => (await mockCalls(page)).saveFile.at(-1)).toMatch(/\.md$/);
  await g.check();
});

test("Canvas: unsaved typing is kept as its own version when Тед adds one", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Canvas/ }).click();
  await page.fill("#cv-txt", "Незапазен тестов текст");
  await send(page, "Напиши договор в Canvas");
  await finished(rgAnswer(page));
  const opts = page.locator("#cv-ver option");
  await expect(opts).toHaveText(["Версия 1", "Версия 2 · ChatGPT: първа чернова", "Версия 3 · ваша незапазена редакция"]);
  await page.locator("#cv-ver").selectOption("3");
  await expect(page.locator("#cv-txt")).toHaveValue("Незапазен тестов текст");
  await g.check();
});

test("video with Real GPT: a ChatGPT card for Sora – no paid server video, no approval, nothing started", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Направи видео разходка на ТЕСТ-101");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("chatgpt-card")).toHaveAttribute("data-kind", "video");
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  await expect(a.getByTestId("video-card")).toHaveCount(0);
  await expect(a).toContainText("Оттук не мога да създам видео");
  const calls = await mockCalls(page);
  expect(calls.videoStart).toHaveLength(0);
  expect(calls.openInChatGpt).toEqual([]);
  await g.check();
});

test("video of Ted's server („+ › Още › Видео на имот“): engine, length and price → progress → the stitched clip as a FileCard", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Видео на имот/ }).click();
  await page.fill("#vw-q", "ТЕСТ-101");
  await page.locator(".modal").getByRole("button", { name: "Търси" }).click();
  await page.locator(".modal .clist button", { hasText: "Измислен двустаен апартамент" }).click();
  const vc = page.locator(".modal").getByTestId("video-card");
  await expect(vc).toHaveAttribute("data-status", "approval");
  await expect(vc.getByTestId("video-cost")).toHaveText("$2,55"); // 3 parts × 5 s × $0.17
  await vc.getByRole("button", { name: "Започни (платено)" }).click();
  await expect(vc).toHaveAttribute("data-status", /running|stitch|done/);
  await expect(vc).toHaveAttribute("data-status", "done", { timeout: 40000 });
  const fc = vc.getByTestId("file-card").filter({ hasText: "AI видео ТЕСТ-101" });
  await expect(fc).toHaveAttribute("data-kind", "video");
  await fc.getByRole("button", { name: "Преглед", exact: true }).click();
  await expect(fc.getByTestId("file-video")).toHaveAttribute("src", /^blob:/);
  await shot(page, "agent-video-done.png");
  const calls = await mockCalls(page);
  expect(calls.videoStart).toEqual([{ jobId: expect.stringMatching(/^v_test/), engine: "kling", duration: 5 }]);
  expect(calls.videoFinish).toHaveLength(1);                         // stitched once, in this window
  const made = (await page.evaluate(() => window.__tedMock.files())).find((f) => f.id === calls.videoFinish[0].fileId);
  expect(made).toMatchObject({ kind: "video" });
  await g.check();
});

test("video of Ted's server: no engine on the server is said plainly; nothing is offered for payment", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&video=noengine");
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Видео на имот/ }).click();
  await page.fill("#vw-q", "ТЕСТ-101");
  await page.locator(".modal").getByRole("button", { name: "Търси" }).click();
  await page.locator(".modal .clist button", { hasText: "Измислен двустаен апартамент" }).click();
  await expect(page.locator(".modal")).toContainText("На сървъра няма настроен ключ за AI видео");
  await expect(page.locator(".modal").getByRole("button", { name: /Започни/ })).toHaveCount(0);
  expect((await mockCalls(page)).videoStart).toHaveLength(0);
  await g.check();
});

test("video from the „+“ menu: the job card itself asks, starts on the paid click, and resumes a failed part", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&video=fail");
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Видео на имот/ }).click();
  await page.fill("#vw-q", "ТЕСТ-101");
  await page.locator(".modal").getByRole("button", { name: "Търси" }).click();
  await page.locator(".modal .clist button", { hasText: "Измислен двустаен апартамент" }).click();
  const vc = page.locator(".modal").getByTestId("video-card");
  await expect(vc).toHaveAttribute("data-status", "approval");
  await expect(vc.getByTestId("video-cost")).toHaveText("$2,55");
  await vc.getByRole("button", { name: "Започни (платено)" }).click();
  await expect(vc).toHaveAttribute("data-status", "failed", { timeout: 20000 });
  await expect(vc).toContainText("Готови 2 от 3 части");
  await expect(vc.getByTestId("file-card")).toHaveCount(2);         // the finished parts stay usable
  await expect(vc.getByRole("button", { name: /Продължи \(1 части, платено\)/ })).toBeVisible();
  const calls = await mockCalls(page);
  expect(calls.videoStart).toEqual([{ jobId: expect.stringMatching(/^v_test/), engine: "kling", duration: 5 }]);
  await g.check();
});

test("tools_unsupported: what OpenAI refused, only „Само текст“ – never Ted's server, never a silent switch", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&rg=1&consent=all&agentFail=tools_unsupported&rgStep=12");
  await pickRgModel(page);
  await send(page, "Намери обяви за наем");
  const card = rgAnswer(page).getByTestId("tools-unsupported");
  await expect(card).toContainText("Планът на ChatGPT не прие инструментите на Тед");
  await expect(card).toContainText("нищо не е превключено към друг изкуствен интелект");
  await expect(card.getByTestId("tools-refused")).toContainText("параметър „tools[0]“ · код subscription_sharing_unsupported_capability · HTTP 400");
  await expect(card.getByTestId("tools-refused")).toContainText("Function tools are not supported for this test model.");
  await expect(card.getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Отговори с Тед/ })).toHaveCount(0);
  await expect(page.getByTestId("rg-fallback")).toHaveCount(0);
  await shot(page, "agent-tools-unsupported.png");
  await card.getByRole("button", { name: "Само текст" }).click();
  const a = rgAnswer(page);
  await expect(a.locator(".foot-tags")).toContainText("без инструменти");
  await expect(a).toContainText("няма достъп до CRM");
  const calls = await mockCalls(page);
  expect(calls.consent).toEqual([]);                                 // the stored choice is not changed
  expect(calls.rgSend.at(-1)).toMatchObject({ consent: "all", textOnly: true, last: "Намери обяви за наем" });
  expect(calls.rgSend.at(-1).mode).toBeUndefined();                   // no agent arguments in the text-only retry
  expect(calls.chat).toHaveLength(0);                                 // Ted's server was never asked
  await g.check();
});

test("step limit: said plainly, „Продължи“ continues the work", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&rg=1&consent=all&agentFail=limit&rgStep=12&agentStep=80");
  await pickRgModel(page);
  await send(page, "Рови всички сайтове за обяви");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("limit-note")).toContainText("8 кръга / 40 извиквания");
  await expect(a.getByTestId("activity-text")).toHaveText("Претърси интернет 3 пъти");
  await openActivity(a);
  await expect(a.getByTestId("agent-steps").locator("li")).toHaveCount(3);
  await a.locator(".macts").getByRole("button", { name: "Продължи" }).click();
  await expect.poll(async () => (await mockCalls(page)).rgSend.length).toBe(2);
  expect((await mockCalls(page)).rgSend[1]).toMatchObject({ last: "Продължи" });
  await g.check();
});

test("stop while an approval waits: the approval is denied and the answer says what may have run", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Запиши оглед");
  const a = rgAnswer(page);
  await expect(a.getByTestId("approval-card")).toBeVisible();
  await page.locator(".snd").click(); // the round button is „Спри“ while busy
  await expect(a.getByTestId("stop-note")).toContainText("Стъпките, завършени преди спирането, остават изпълнени");
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  expect((await mockCalls(page)).approve).toHaveLength(0); // nobody answered for the employee
  await g.check();
});

test("library: every file with preview, Отвори and Запази…; filter by kind", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200&lib=1");
  await page.locator("aside.side").getByTestId("side-library").click();
  const lib = page.getByTestId("library-page");
  await expect(lib.getByTestId("file-card")).toHaveCount(3);
  const img = lib.locator('[data-testid="file-card"][data-kind="image"]');
  await expect(img.locator(".fc-img img")).toHaveAttribute("src", /^data:image\/(jpeg|png);base64,/);
  await expect(img.getByTestId("file-saved")).toHaveText("Записано: папка „Тед“");
  await expect(lib.locator('[data-testid="file-card"][data-kind="pdf"]')).toContainText("2 стр.");
  await expect(lib.locator('[data-testid="file-card"][data-kind="docx"]')).toContainText("Word");
  await shot(page, "agent-library.png");
  await lib.getByRole("button", { name: "Снимки" }).click();
  await expect(lib.getByTestId("file-card")).toHaveCount(1);
  await lib.getByRole("button", { name: "Документи" }).click();
  await expect(lib.getByTestId("file-card")).toHaveCount(2);
  await lib.locator('[data-testid="file-card"][data-kind="pdf"]').getByRole("button", { name: "Запази…" }).click();
  await expect(page.locator(".toast")).toContainText("Тестов договор.pdf");
  await g.check();
});

test("scheduled: a run missed while the program was closed is reported, never run silently", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=150&sched=1");
  await expect(page.locator(".toast")).toContainText("Пропусната планирана задача: „Тестова седмична справка“");
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await page.locator("aside.side").getByTestId("side-scheduled").click();
  const sp = page.getByTestId("scheduled-page");
  await expect(sp.getByTestId("sched-item")).toHaveCount(2);
  await sp.getByRole("button", { name: "Изпълни сега" }).click();
  await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(1);
  expect((await mockCalls(page)).chat[0]).toMatchObject({ last: "Направи тестова справка за седмицата" });
  await g.check();
});

test("updates: honest states from MAIN; „Провери сега“ and the automatic switch reach the bridge", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&upd=downloading");
  await openSettings(page);
  const upd = page.getByTestId("updates");
  await expect(upd.getByTestId("upd-status")).toContainText("Изтеглям версия 0.1.4-test… 42 %");
  await page.evaluate(() => window.__tedMock.setUpd("none"));
  await expect(upd.getByTestId("upd-status")).toHaveText("Имате последната версия.");
  await upd.getByRole("button", { name: "Провери сега" }).click();
  await expect(upd.getByTestId("upd-status")).toHaveText("Имате последната версия.");
  await upd.locator("#sw-upd-auto").click();
  const calls = await mockCalls(page);
  expect(calls.updCheck).toBe(1);
  expect(calls.updAuto).toEqual([false]);
  await expect(page.getByTestId("upd-banner")).toHaveCount(0);
  await page.evaluate(() => window.__tedMock.setUpd("ready"));
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("upd-banner")).toContainText("0.1.4-test");
  await g.check();
});

test("Работа and the „+“ hints go with the agent request (one assistant, hints optional)", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await page.getByTestId("mode-toggle").getByRole("tab", { name: "Работа" }).click();
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Търсене в мрежата/ }).click();
  await send(page, "Намери обяви за пазара");
  await finished(rgAnswer(page));
  expect((await mockCalls(page)).rgSend.at(-1)).toMatchObject({ mode: "work", hints: ["search"], consent: "all" });
  await g.check();
});

test("phone: steps, approval and file cards fit the narrow window", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, AGENT);
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Тест GPT А/ }).click();
  await send(page, "Намери имоти и запиши оглед");
  const a = rgAnswer(page);
  const ap = a.getByTestId("approval-card");
  await expect(ap).toBeVisible();
  await expect(a.getByTestId("file-card")).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "agent-phone-approval.png");
  await ap.getByRole("button", { name: "Разреши", exact: true }).click();
  await finished(a);
  await noHorizontalScroll(page);
  await g.check();
});
