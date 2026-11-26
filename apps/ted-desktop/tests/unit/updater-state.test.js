// Updater (docs/CONTRACT.md §14): off in development/smoke/non-Windows, the GitHub-only host filter of its
// session, the state machine on (fake) electron-updater events, auto on/off, install only when ready.
import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUpdater, updateUrlAllowed, restrictUpdaterSession, FEED_URL, UPDATER_PARTITION, INTERVAL_MS, FIRST_CHECK_MS } from "../../electron/updater.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fakeUpdater() {
  const u = new EventEmitter();
  u.checks = 0;
  u.downloads = 0;
  u.installs = [];
  u.checkForUpdates = async () => { u.checks++; u.emit("checking-for-update"); return null; };
  u.downloadUpdate = async () => { u.downloads++; return []; };
  u.quitAndInstall = (...a) => { u.installs.push(a); };
  return u;
}

function setup({ packaged = true, platform = "win32", smoke = false, settings: initial = {} } = {}) {
  let saved = { ...initial };
  const settings = { get: () => structuredClone(saved), set: (p) => { saved = { ...saved, ...p }; return saved; } };
  const u = fakeUpdater();
  const states = [];
  const sessions = [];
  const hooks = {};
  const timers = [];
  const updater = createUpdater({
    loadUpdater: async () => u, app: { getVersion: () => "0.1.3" }, settings, packaged, platform, smoke,
    getSession: (name) => { sessions.push(name); return { webRequest: { onBeforeRequest: (fn) => { hooks.req = fn; }, onBeforeSendHeaders: (fn) => { hooks.hdr = fn; } } }; },
    emit: (s) => states.push(s), now: () => new Date("2026-11-17T10:00:00Z"),
    timers: { setTimeout: (fn, ms) => { timers.push(["timeout", ms]); return { unref() {} }; }, setInterval: (fn, ms) => { timers.push(["interval", ms]); return { unref() {} }; }, clearTimeout: () => {}, clearInterval: () => {} },
  });
  return { updater, u, states, sessions, hooks, timers, saved: () => saved };
}

describe("updater", () => {
  it("is disabled (no network, no import) in development, on Linux and in the smoke test", async () => {
    for (const opts of [{ packaged: false }, { platform: "linux" }, { smoke: true }]) {
      const t = setup(opts);
      expect(t.updater.state()).toEqual({ supported: false, version: "0.1.3", auto: true, status: "disabled" });
      expect(await t.updater.check()).toMatchObject({ status: "disabled" });
      t.updater.start();
      expect(t.timers).toEqual([]);
      expect(t.u.checks).toBe(0);
      expect(t.sessions).toEqual([]);
    }
  });

  it("checks 20 s after start and every 6 h", () => {
    const t = setup();
    t.updater.start();
    expect(t.timers).toEqual([["timeout", FIRST_CHECK_MS], ["interval", INTERVAL_MS]]);
    expect(FIRST_CHECK_MS).toBe(20000);
    expect(INTERVAL_MS).toBe(21600000);
  });

  it("restricts its own session to GitHub over HTTPS and strips credentials", async () => {
    const t = setup();
    await t.updater.check();
    expect(t.sessions).toEqual([UPDATER_PARTITION]);
    const ask = (url) => new Promise((r) => t.hooks.req({ url }, r));
    expect(await ask(`${FEED_URL}/latest.yml`)).toEqual({});
    expect(await ask("https://release-assets.githubusercontent.com/github-production-release-asset/1/x?sig=y")).toEqual({});
    expect(await ask("https://objects.githubusercontent.com/x")).toEqual({});
    for (const bad of ["http://github.com/x", "https://imotinadezhda.bg/x", "https://api.openai.com/v1", "https://evil.example.com/latest.yml", "https://github.com.evil.example.com/", "https://github.com:8443/x"]) {
      expect(await ask(bad), bad).toEqual({ cancel: true });
    }
    const h = await new Promise((r) => t.hooks.hdr({ requestHeaders: { Authorization: "Bearer x", Cookie: "a", "User-Agent": "u" } }, r));
    expect(h).toEqual({ requestHeaders: { "User-Agent": "u" } });
    expect(updateUrlAllowed(FEED_URL)).toBe(true);
    const ses = { webRequest: { onBeforeRequest: () => {}, onBeforeSendHeaders: () => {} } };
    expect(() => restrictUpdaterSession(ses)).not.toThrow();
  });

  it("state machine: checking -> downloading -> ready -> install; settings applied to the updater", async () => {
    const t = setup();
    await t.updater.check();
    expect(t.u).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: false, allowDowngrade: false, disableDifferentialDownload: true, disableWebInstaller: true });
    expect(t.states.at(-1)).toMatchObject({ status: "checking" });
    expect(t.updater.install()).toMatchObject({ ok: false });
    t.u.emit("update-available", { version: "0.1.4", releaseDate: "2026-11-20T00:00:00Z" });
    expect(t.states.at(-1)).toMatchObject({ status: "downloading", available: { version: "0.1.4" }, lastCheck: "2026-11-17T10:00:00.000Z" });
    t.u.emit("download-progress", { percent: 41.6, transferred: 41, total: 100 });
    expect(t.states.at(-1).progress).toEqual({ percent: 42, transferred: 41, total: 100 });
    t.u.emit("update-downloaded", { version: "0.1.4" });
    expect(t.updater.state()).toMatchObject({ status: "ready", available: { version: "0.1.4" } });
    expect(t.updater.state()).not.toHaveProperty("progress");
    expect(await t.updater.check()).toMatchObject({ status: "ready" }); // no new check while an update waits
    expect(t.updater.install()).toEqual({ ok: true });
    expect(t.u.installs).toEqual([[true, true]]);
  });

  it("auto off: an update is only announced; turning auto on downloads it; errors are friendly", async () => {
    const t = setup({ settings: { updates: { auto: false } } });
    await t.updater.check();
    expect(t.u.autoDownload).toBe(false);
    t.u.emit("update-available", { version: "0.1.4" });
    expect(t.updater.state()).toMatchObject({ status: "available", auto: false });
    await t.updater.setAuto(true);
    expect(t.saved().updates).toEqual({ auto: true });
    expect(t.u.downloads).toBe(1);
    expect(t.updater.state()).toMatchObject({ status: "downloading", auto: true });
    t.u.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED"));
    expect(t.updater.state()).toMatchObject({ status: "error", error: "Няма връзка с GitHub – проверката ще се повтори по-късно." });
    t.u.emit("error", new Error("HttpError: 404 Not Found https://github.com/x/latest.yml"));
    expect(t.updater.state().error).toBe("В последното издание няма файл за обновяване (latest.yml).");
    t.u.emit("update-not-available");
    expect(t.updater.state()).toMatchObject({ status: "none" });
  });

  it("auto off: „Изтегли“ (ted.updates.download) downloads an announced update; nothing installs at quit", async () => {
    const t = setup({ settings: { updates: { auto: false } } });
    await t.updater.check();
    expect(await t.updater.download()).toMatchObject({ ok: false }); // nothing announced yet
    t.u.emit("update-available", { version: "0.1.4" });
    expect(await t.updater.download()).toEqual({ ok: true });
    expect(t.u.downloads).toBe(1);
    expect(t.updater.state()).toMatchObject({ status: "downloading", auto: false });
    expect(t.u.autoInstallOnAppQuit).toBe(false);
  });
});

describe("packaging and CI for updates", () => {
  const builder = fs.readFileSync(path.join(root, "electron-builder.yml"), "utf8");
  const workflow = fs.readFileSync(path.join(root, "../../.github/workflows/ted-desktop.yml"), "utf8");

  it("electron-builder publishes a generic feed (latest.yml) at GitHub releases/latest/download", () => {
    expect(builder).toMatch(/publish:\s*\n\s*- provider: generic\s*\n\s*url: "https:\/\/github\.com\/miroslavkunev7-design\/imotinadezhda\/releases\/latest\/download"/);
    expect(builder).toContain("useMultipleRangeRequest: false");
    expect(builder).not.toMatch(/^publish: null/m);
    expect(builder).toMatch(/differentialPackage: false/);
    expect(builder).toContain('artifactName: "Ted-Setup-${version}-x64.${ext}"');
    expect(builder).not.toMatch(/^\s*publisherName:/m); // unsigned: sha512 only
    expect(builder).toContain("src/assets/fonts/*.woff2");
  });

  it("the workflow checks latest.yml against the installer and ships it with the artifact and the release", () => {
    expect(workflow).toContain("dist-installer/latest.yml");
    expect(workflow).toMatch(/openssl dgst -sha512 -binary/);
    // 0.1.8: the Mac disk image travels in the same release (no update feed for it – latest.yml stays Windows-only).
    expect(workflow).toMatch(/assets=\("Ted-Setup-\$\{version\}-x64\.exe" "Ted-Setup-x64\.exe" "Ted-Mac-\$\{version\}-universal\.dmg" "Ted-Mac\.dmg" "SHA256SUMS\.txt" "latest\.yml"\)/);
    expect(workflow).toMatch(/apps\/ted-desktop\/dist-installer\/latest\.yml/);
  });
});
