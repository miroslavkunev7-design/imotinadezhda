// Shared helpers for the renderer tests (mock build only; see playwright.config.mjs).
import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";

export const DESKTOP = { width: 1366, height: 860 };
export const PHONE = { width: 400, height: 860 };
export const SHOTS = process.env.TED_SHOTS_DIR || path.resolve("test-results/shots");

// Records page errors, console errors and CSP violations; check() fails the test if any occurred.
export function guard(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  // Failed loads are reported by URL below (the browser's own /favicon.ico probe is not the app's).
  page.on("console", (m) => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !/\/favicon\.ico$/.test(r.url())) problems.push("http " + r.status() + ": " + r.url()); });
  page.on("requestfailed", (r) => { if (!/\/favicon\.ico$/.test(r.url())) problems.push("requestfailed: " + r.url() + " " + (r.failure() || {}).errorText); });
  page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  return {
    problems,
    async check() {
      const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
      expect([...problems, ...csp.map((c) => "csp: " + c)]).toEqual([]);
    },
  };
}

export async function open(page, query = "") {
  await page.goto("/" + (query ? "?" + query : ""));
  await expect(page.locator("#lg-id, .home, .thread").first()).toBeVisible();
}

export async function login(page, query = "lat=600") {
  await open(page, query);
  await page.fill("#lg-id", "sluzhitel@example.test");
  await page.fill("#lg-pw", "test");
  await page.click(".login-btn");
  await expect(page.locator(".home h1")).toContainText("С какво да помогна");
}

export async function send(page, text) {
  await page.fill("#composer", text);
  await page.keyboard.press("Enter");
}

// The newest assistant message (server engine) once it has arrived.
export const lastAnswer = (page) => page.locator('.msg.a[data-engine="server"]').last();

export const mockCalls = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tedMock.calls)));

export async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(450); // let entry animations settle
  await page.screenshot({ path: path.join(SHOTS, name) });
}

// No horizontal overflow anywhere in the visible layout.
export async function noHorizontalScroll(page) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const over = [];
    // Anything the user could scroll sideways (overflow hidden/clip cannot be scrolled by the user).
    for (const el of [document.documentElement, document.body, ...document.querySelectorAll(".shell *")]) {
      const ox = getComputedStyle(el).overflowX;
      const scrollable = el === document.documentElement || el === document.body || ox === "auto" || ox === "scroll";
      if (!scrollable || el.closest(".rail, .sugcards, .cfiles, .mdt, .cb, .tabs, .side:not(.open)")) continue;
      if (el.scrollWidth > el.clientWidth + 1) over.push("scroll " + (String(el.className) || el.tagName) + " " + el.scrollWidth + ">" + el.clientWidth);
    }
    for (const el of document.querySelectorAll(".shell *")) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (el.closest(".side:not(.open)") || el.closest(".rail") || el.closest(".sugcards") || el.closest(".cfiles") || el.closest(".mdt") || el.closest(".pop") || el.closest(".tabs")) continue;
      if (b.right > vw + 1) over.push((el.className && String(el.className)) || el.tagName);
    }
    return { vw, docW: document.documentElement.scrollWidth, over: over.slice(0, 10) };
  });
  expect(r.over).toEqual([]);
  expect(r.docW).toBeLessThanOrEqual(r.vw);
}
