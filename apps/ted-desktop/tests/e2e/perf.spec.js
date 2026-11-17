// Speed and load of the renderer (0.1.5, owner: „по-бързо да бъде и да не влияе на скоростта на сайта“).
// Measured in the mock build with Chromium's CPU slowed down 4× (an older laptop). The numbers are written to
// test-results/perf.json (or $PERF_OUT) for the report; the budgets below are generous so that a slow CI machine does
// not fail – the important ones are exact: no request to the site while idle, one request per server answer.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { guard } from "./helpers.js";

const OUT = process.env.PERF_OUT || path.resolve("test-results/perf.json");
const results = {};
const save = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); };
const SLOW = 4;

async function throttle(page, rate = SLOW) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return cdp;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const round = (n) => Math.round(n * 10) / 10;

test.describe.configure({ mode: "serial" });
test.afterAll(save);

test("start: first paint and the home screen (CPU 4× slower)", async ({ page }) => {
  const g = guard(page);
  await throttle(page);
  const t0 = Date.now();
  await page.goto("/?signedIn=1&lat=50");
  await expect(page.locator(".home h1")).toBeVisible();
  const m = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const nav = performance.getEntriesByType("navigation")[0];
    return { fcp: fcp ? fcp.startTime : null, domContentLoaded: nav ? nav.domContentLoadedEventEnd : null, homeAt: performance.now() };
  });
  results.start = { cpuSlowdown: SLOW, firstContentfulPaintMs: round(m.fcp), domContentLoadedMs: round(m.domContentLoaded), homeVisibleMs: round(m.homeAt), wallMs: Date.now() - t0 };
  save();
  expect(m.fcp).toBeLessThan(4000);
  await g.check();
});

test("long chats: switching and typing stay fast (150 question/answer pairs, CPU 4× slower)", async ({ page }) => {
  const g = guard(page);
  await page.goto("/?signedIn=1&lat=50&long=150");
  await expect(page.locator(".home h1")).toBeVisible();
  await throttle(page);
  // Open A, then switch A -> B -> A three times; each time until the next frame after React committed.
  const open = (title) => page.evaluate(async (t) => {
    const row = [...document.querySelectorAll(".side .row .t")].find((b) => b.title === t);
    const t0 = performance.now();
    row.click();
    await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    await new Promise((r) => requestAnimationFrame(() => r()));
    return performance.now() - t0;
  }, title);
  await open("Дълъг чат А");
  await expect(page.locator(".thread")).toContainText("Тестов въпрос 150 в дълъг чат А");
  const switches = [];
  for (let k = 0; k < 3; k++) {
    switches.push(await open("Дълъг чат Б"));
    await expect(page.locator(".thread")).toContainText("Тестов въпрос 150 в дълъг чат Б");
    switches.push(await open("Дълъг чат А"));
    await expect(page.locator(".thread")).toContainText("Тестов въпрос 150 в дълъг чат А");
  }
  const rendered = await page.locator(".thread .msg").count();
  // Typing: one character at a time into the composer under the long thread – the time React needs per key.
  const typing = await page.evaluate(async () => {
    const el = document.querySelector("#composer");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    const out = [];
    el.focus();
    for (let i = 0; i < 40; i++) {
      setter.call(el, el.value + "а");
      const t0 = performance.now();
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      out.push(performance.now() - t0);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    return out;
  });
  // Scrolling the long thread to the top: average frame time.
  const scroll = await page.evaluate(async () => {
    const el = document.querySelector(".thread");
    const frames = [];
    let last = performance.now();
    for (let i = 0; i < 40; i++) {
      el.scrollTop = Math.max(0, el.scrollTop - 400);
      await new Promise((r) => requestAnimationFrame(() => r()));
      const t = performance.now(); frames.push(t - last); last = t;
    }
    return frames;
  });
  results.longChat = {
    cpuSlowdown: SLOW, pairs: 150, messagesInDom: rendered,
    switchMedianMs: round(median(switches)), switchMaxMs: round(Math.max(...switches)),
    typingMedianMs: round(median(typing)), typingMaxMs: round(Math.max(...typing)),
    scrollFrameMedianMs: round(median(scroll)), scrollFrameMaxMs: round(Math.max(...scroll)),
  };
  save();
  expect(median(typing)).toBeLessThan(250);
  expect(median(switches)).toBeLessThan(4000);
  await g.check();
});

test("CSS cost: blurred layers (backdrop-filter) on the home screen, in a chat and with a menu open", async ({ page }) => {
  const g = guard(page);
  await page.goto("/?signedIn=1&lat=50&long=5");
  await expect(page.locator(".home h1")).toBeVisible();
  const blurs = () => page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const f = getComputedStyle(el).backdropFilter;
      if (!f || f === "none") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const px = Number((/blur\(([\d.]+)px\)/.exec(f) || [])[1] || 0);
      out.push({ el: el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : el.tagName, blurPx: px, areaPx: Math.round(r.width * r.height) });
    }
    return out;
  });
  const home = await blurs();
  await page.locator(".side .row .t", { hasText: "Дълъг чат А" }).click();
  await expect(page.locator(".thread")).toBeVisible();
  const thread = await blurs();
  await page.locator(".c-plus").click();
  await expect(page.locator(".pop")).toBeVisible();
  const menu = await blurs();
  const sum = (l) => ({ layers: l.length, maxBlurPx: Math.max(0, ...l.map((x) => x.blurPx)), blurArea: l.reduce((n, x) => n + x.areaPx * x.blurPx, 0), list: l });
  results.blur = { home: sum(home), thread: sum(thread), menuOpen: sum(menu) };
  save();
  await g.check();
});

test("load on the site: no request while idle; one per server answer", async ({ page }) => {
  const g = guard(page);
  await page.clock.install();
  await page.goto("/?signedIn=1&lat=50");
  await page.clock.runFor(3000);
  await expect(page.locator(".home h1")).toBeVisible();
  const at = () => page.evaluate(() => window.__tedMock.calls.site.map((c) => c.fn));
  const start = await at();
  await page.clock.runFor(60_000);
  const minute = (await at()).slice(start.length);
  await page.clock.runFor(9 * 60_000);
  const tenMinutes = (await at()).slice(start.length);
  // One server answer (the mock's default answer has a CRM write, so the case list is refreshed once).
  const before = (await at()).length;
  await page.fill("#composer", "Тестов въпрос за натоварването");
  await page.keyboard.press("Enter");
  await page.clock.runFor(2000);
  await expect(page.locator('.msg.a[data-engine="server"]').last()).toContainText("Тестов отговор");
  await page.clock.runFor(2000);
  const answer = (await at()).slice(before);
  results.requests = { atStart: start, idleFirstMinute: minute, idleTenMinutes: tenMinutes, perServerAnswer: answer };
  save();
  expect(minute).toEqual([]);
  expect(tenMinutes).toEqual([]);
  expect(answer.filter((f) => f === "api.chat")).toHaveLength(1);
  await g.check();
});
