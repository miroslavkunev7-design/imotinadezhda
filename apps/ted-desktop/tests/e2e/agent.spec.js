// 0.1.3 FEATURES: the Real GPT agent in the renderer (docs/CONTRACT.md §8, §16, §17) – consent, live „Изпълнение“
// steps, approvals (allow / deny / allow_all), FileCards (preview, Отвори, Запази…), internet results, documents,
// reworked attachments, Canvas versions from the agent with a sanitised SVG preview, paid video (approval →
// progress → stitched clip), the tools_unsupported fallback, the step limit, the library, scheduled tasks and the
// updater states. Mock build only (src/mock/bridge.mock.js); every value is fictional; no network.
import { test, expect } from "@playwright/test";
import { PHONE, guard, login, mockCalls, noHorizontalScroll, openSettings, send, shot } from "./helpers.js";

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
  await expect(modal).toContainText("Real GPT ще ползва CRM, интернет и файловете, които прикачите, през вашия ChatGPT акаунт.");
  await expect(modal).toContainText("chatgpt.test@example.test");
  await expect(modal).toContainText("Промени в CRM, имейл и платено видео винаги искат вашето потвърждение");
  expect((await mockCalls(page)).rgSend).toHaveLength(0); // nothing is sent before the answer
  await shot(page, "agent-consent.png");
  await page.locator(".modal").getByRole("button", { name: "Разбирам", exact: true }).click();
  await expect(rgAnswer(page)).toContainText("с разрешени инструменти");
  await finished(rgAnswer(page));
  await expect(rgAnswer(page).locator(".foot-tags")).not.toContainText("без инструменти");
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
  await expect(a.getByTestId("file-card")).toContainText("Тестова справка.docx"); // shown as soon as it exists
  await shot(page, "agent-approval.png");

  await ap.getByRole("button", { name: "Разреши", exact: true }).click();
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  await expect(a).toContainText("Записах тестовия оглед в календара.");
  await finished(a);
  await expect(steps.getByTestId("steps-status")).toHaveText("Изпълнено");
  await expect(steps.locator(".ribbon")).toHaveText("промени в CRM");
  await expect(steps.locator('li[data-status="ok"]')).toHaveCount(5);

  const card = a.getByTestId("file-card");
  await expect(card).toHaveAttribute("data-kind", "docx");
  await expect(card).toContainText("направен от Тед");
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

test("internet: listings with price, place, phone and link directly in the answer; photos as FileCards", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери обяви за двустаен в Тестоград");
  const a = rgAnswer(page);
  await finished(a);
  const steps = a.getByTestId("agent-steps");
  await expect(steps).toContainText("Търся в интернет: тестови обяви двустаен Тестоград");
  await expect(steps).toContainText("Чета страница: example.test/obiava-101");
  await expect(steps).toContainText("Изтеглям снимка: example.test/img/obiava-101-1.png");
  await expect(a.locator(".md")).toContainText("Тестов двустаен апартамент");
  await expect(a.locator(".md")).toContainText("99 000 €");
  await expect(a.locator(".md")).toContainText("+359 00 000 0001");
  await expect(a.locator(".md a")).toContainText("example.test/obiava-101");
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
  await expect(a.getByTestId("agent-steps")).not.toContainText("Търся в интернет");
  await g.check();
});

test("AI image: images.generate step, the picture as a FileCard with the server's own „Записано“ text", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("agent-steps")).toContainText("Генерирам снимка");
  const card = a.locator('[data-testid="file-card"][data-kind="image"]');
  await expect(card).toContainText("AI визуализация (тест).png");
  await expect(card.getByTestId("file-saved")).toHaveText("Записано: папка „Тед“");
  await card.getByRole("button", { name: "Преглед", exact: true }).click();
  await expect(page.getByTestId("file-lightbox").locator("img")).toHaveAttribute("src", /^blob:/);
  await page.getByTestId("file-lightbox").getByRole("button", { name: "Затвори" }).click();
  await expect(page.getByTestId("file-lightbox")).toHaveCount(0);
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
  await expect(cv.locator("#cv-ver option")).toHaveText(["Версия 1", "Версия 2 · ръчна редакция", "Версия 3 · Тед: първа чернова"]);
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
  await expect(opts).toHaveText(["Версия 1", "Версия 2 · Тед: първа чернова", "Версия 3 · ваша незапазена редакция"]);
  await page.locator("#cv-ver").selectOption("3");
  await expect(page.locator("#cv-txt")).toHaveValue("Незапазен тестов текст");
  await g.check();
});

test("video: approval with engine, length and price → progress → the stitched clip as a FileCard", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Направи видео разходка на ТЕСТ-101");
  const a = rgAnswer(page);
  const ap = a.locator('[data-testid="approval-card"][data-kind="video"]');
  await expect(ap).toContainText("Платено AI видео");
  await expect(ap).toContainText("ТЕСТ-101 · Измислен двустаен апартамент");
  await expect(ap.getByTestId("video-cost")).toHaveText("$2,55"); // 3 parts × 5 s × $0.17
  await expect(ap).toContainText("Баланс на сървъра");
  await expect(ap.getByRole("button", { name: "Разреши всички в този отговор" })).toHaveCount(0); // never allow_all
  const vc = a.getByTestId("video-card");
  await expect(vc).toHaveAttribute("data-status", "approval");
  await expect(vc.getByTestId("video-wait-approval")).toBeVisible(); // no second start button on the job card
  await expect(vc.getByRole("button", { name: /Започни/ })).toHaveCount(0);
  await ap.locator("select").first().selectOption("veo");
  await ap.locator("select").nth(1).selectOption("6");
  await expect(ap.getByTestId("video-cost")).toHaveText("$1,80"); // 3 × 6 s × $0.10
  await shot(page, "agent-video-approval.png");
  await ap.getByRole("button", { name: "Започни (платено)" }).click();
  await expect(a).toContainText("Видеото започна на сървъра");
  await expect(a).toContainText("не е готово още");
  await expect(vc).toHaveAttribute("data-status", /running|stitch|done/);
  await expect(vc).toHaveAttribute("data-status", "done", { timeout: 40000 });
  const fc = vc.getByTestId("file-card");
  await expect(fc).toContainText("AI видео ТЕСТ-101");
  await expect(fc).toHaveAttribute("data-kind", "video");
  await fc.getByRole("button", { name: "Преглед", exact: true }).click();
  await expect(fc.getByTestId("file-video")).toHaveAttribute("src", /^blob:/);
  await shot(page, "agent-video-done.png");
  const calls = await mockCalls(page);
  expect(calls.approve.at(-1)).toMatchObject({ decision: "allow", options: { engine: "veo", duration: 6 } });
  expect(calls.videoStart).toEqual([{ jobId: expect.stringMatching(/^v_test/), engine: "veo", duration: 6 }]);
  expect(calls.videoFinish).toHaveLength(1);                         // stitched once, in this window
  const made = (await page.evaluate(() => window.__tedMock.files())).find((f) => f.id === calls.videoFinish[0].fileId);
  expect(made).toMatchObject({ kind: "video" });
  await g.check();
});

test("video: no engine on the server is said plainly; nothing is offered for payment", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT + "&video=noengine");
  await pickRgModel(page);
  await send(page, "Направи клип на имота");
  const a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("video-card")).toContainText("На сървъра няма настроен ключ за AI видео");
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  await expect(a.locator('li[data-status="fail"]')).toContainText("Видео на имот");
  await expect(a).toContainText("Мога първо да направя AI снимка");
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

test("tools_unsupported: the card offers Ted's server or text only – never a silent switch", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&rg=1&consent=all&agentFail=tools_unsupported&rgStep=12");
  await pickRgModel(page);
  await send(page, "Намери обяви за наем");
  let card = rgAnswer(page).getByTestId("tools-unsupported");
  await expect(card).toContainText("Планът на ChatGPT не прие инструментите на Тед");
  await expect(card).toContainText("нищо не е превключено без вас");
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await shot(page, "agent-tools-unsupported.png");
  await card.getByRole("button", { name: "Отговори с Тед (сървъра)" }).click();
  await expect(page.getByTestId("rg-fallback")).toHaveText("↪ Отговор от Тед (сървъра) вместо Real GPT");
  expect((await mockCalls(page)).chat.at(-1)).toMatchObject({ last: "Намери обяви за наем" });

  await send(page, "Още обяви");
  card = rgAnswer(page).getByTestId("tools-unsupported");
  await card.getByRole("button", { name: "Само текст" }).click();
  await expect(rgAnswer(page).locator(".foot-tags")).toContainText("без инструменти");
  const calls = await mockCalls(page);
  expect(calls.consent).toEqual(["text"]);
  expect(calls.rgSend.at(-1)).toMatchObject({ consent: "text", last: "Още обяви" });
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
