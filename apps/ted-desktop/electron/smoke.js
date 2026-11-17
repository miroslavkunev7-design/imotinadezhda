// --smoke-test: self-check of the real, built program (CI on Windows, xvfb on Linux).
//   TedImotiNadezhda.exe --smoke-test --smoke-report=<file.json> [--smoke-shot=<file.png>]
// Runs with a temporary userData folder, loads the renderer from app://ted/, checks the hardening
// and the network transport against a local 127.0.0.1 echo server, writes a JSON report and exits
// 0 (all checks passed) or 1. It never contacts imotinadezhda.bg, Supabase or OpenAI, and the
// system browser is replaced by a recorder (nothing is opened).
// Electron objects are injected by main.js, so this module stays free of the electron import.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export const SMOKE_TIMEOUT_MS = 90000;

// The window.ted surface of docs/CONTRACT.md §2 + §8 + §22 (also pinned by tests/unit/core-electron.test.js).
export const TED_SURFACE = {
  app: ["info", "setCompact", "getLaunchAtLogin", "setLaunchAtLogin", "openLogs", "openExternal", "copy", "saveFile", "storage", "clearTemp", "reportProblem"],
  auth: ["state", "login", "logout", "onChange"],
  api: ["models", "chat", "cancel"],
  crm: ["read"],
  cases: ["create"],
  memory: ["remember", "forget"],
  email: ["confirmSend"],
  voice: ["tts", "transcribe"],
  store: ["getSettings", "setSettings", "loadChats", "saveChats", "clearLocal"],
  realgpt: ["status", "signIn", "cancelSignIn", "signOut", "models", "send", "cancel", "onDelta", "consent", "setConsent", "approve", "onEvent", "openInChatGpt"],
  files: ["add", "read", "extract", "open", "save", "forget"],
  browse: ["test", "image"],
  video: ["prepare", "start", "cancel", "finish", "onEvent"],
  library: ["list", "remove", "clear", "onChange"],
  projects: ["assign", "saveAnswer", "exportZip", "saveToCrm"],
  scheduled: ["list", "save", "remove", "onDue"],
  updates: ["state", "check", "setAuto", "download", "install", "onChange"],
  window: ["bubble", "miniChat", "restore", "state", "onMode"], // 0.1.6 „Балонче“ (§22)
};

// null when the program runs normally.
export function parseSmokeArgs(argv) {
  const args = Array.isArray(argv) ? argv.map(String) : [];
  if (!args.includes("--smoke-test")) return null;
  const pick = (name) => {
    const a = args.find((x) => x.startsWith(name + "="));
    const v = a ? a.slice(name.length + 1).replace(/^"(.*)"$/, "$1") : "";
    return v ? path.resolve(v) : null;
  };
  return { report: pick("--smoke-report"), shot: pick("--smoke-shot"), userData: null };
}

// Must run before app.requestSingleInstanceLock(): the lock lives in userData, so a smoke run never
// touches (or is blocked by) the user's real profile.
// Chromium writes a few files while it shuts down, after removeSmokeProfile ran, so profiles of
// earlier runs (older than 10 minutes) are removed here.
export function prepareSmoke(app, smoke) {
  const tmp = os.tmpdir();
  for (const name of fs.readdirSync(tmp).filter((n) => /^ted-smoke-[A-Za-z0-9]{6}$/.test(n))) {
    try {
      const dir = path.join(tmp, name);
      if (Date.now() - fs.statSync(dir).mtimeMs > 600000) fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* another user's or a locked folder */ }
  }
  smoke.userData = fs.mkdtempSync(path.join(tmp, "ted-smoke-"));
  app.setPath("userData", smoke.userData);
  return smoke;
}

// Stand-in for Electron's shell: records links instead of opening the system browser.
export function recordingShell() {
  const opened = [];
  return { opened, openExternal: async (url) => { opened.push(String(url)); }, openPath: async () => "" };
}

// The renderer may load only its own files. Anything else is recorded and cancelled, so even a
// broken guard elsewhere cannot make the smoke run reach the internet.
export function guardRendererRequests(webRequest) {
  const external = [];
  webRequest.onBeforeRequest((details, callback) => {
    const scheme = String(details.url || "").split(":")[0];
    if (["app", "data", "blob", "devtools"].includes(scheme)) { callback({}); return; }
    external.push(String(details.url).slice(0, 200));
    callback({ cancel: true });
  });
  return external;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitLoaded(wc) {
  if (!wc.isLoading() && wc.getURL()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    wc.once("did-finish-load", resolve);
    wc.on("did-fail-load", (_e, code, description, _url, isMainFrame) => {
      if (isMainFrame) reject(new Error(`load failed: ${code} ${description}`));
    });
  });
}

async function poll(fn, ms, every = 200) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await sleep(every);
  }
}

// Local echo server: records method, headers and body of every request.
async function startEcho() {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: { ...req.headers }, body });
      if (req.url === "/slow") { const t = setTimeout(() => { res.writeHead(200); res.end("late"); }, 5000); t.unref(); return; }
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "ted_smoke=1; Path=/" });
      res.end(JSON.stringify({ ok: true, length: body.length }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const close = () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  return { base: `http://127.0.0.1:${server.address().port}`, seen, close };
}

async function freePort() {
  const s = http.createServer();
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const port = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return port;
}

const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, [...o[k]].sort()]));

// Runs every check and returns the report. Never throws: a crash becomes a failed check.
export async function runSmoke({ win, appUrl, csp, metaCsp, appFetch, backendFetch, createHttp, shell, external, windowCount, bubbleOpen, info, shot }) {
  const t0 = Date.now();
  const checks = [];
  const consoleErrors = [];
  const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); return !!ok; };
  const wc = win.webContents;
  const js = (code, gesture = false) => wc.executeJavaScript(code, gesture);

  wc.on("console-message", (event) => {
    const level = String(event.level || "");
    const message = String(event.message || "");
    // The deliberate CSP probe below logs its own violation; that one is expected.
    if (level === "error" && !message.includes("ted-smoke-")) consoleErrors.push(message.slice(0, 300));
  });

  let echo = null;
  try {
    await waitLoaded(wc);
    check("renderer loaded from app://ted/", wc.getURL() === appUrl, wc.getURL());

    const screen = await poll(() => js(`document.querySelector("#lg-pw") ? "login" : document.querySelector(".no-bridge") ? "no-bridge" : ""`), 20000);
    check("login screen rendered", screen === "login", screen || "nothing rendered");

    // CSP: the app:// response header and the <meta> in the page.
    const res = await appFetch(appUrl);
    check("CSP response header", res.headers.get("content-security-policy") === csp, res.headers.get("content-security-policy"));
    check("nosniff response header", res.headers.get("x-content-type-options") === "nosniff");
    const page = await js(`(() => {
      const t = window.ted;
      const shape = t && typeof t === "object" ? Object.fromEntries(Object.keys(t).map((k) => [k, Object.keys(t[k] || {})])) : null;
      const allFns = !!shape && Object.keys(t).every((k) => Object.values(t[k]).every((f) => typeof f === "function"));
      let evalBlocked = false;
      try { (0, eval)("1"); } catch (e) { evalBlocked = true; }
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return { shape, allFns, evalBlocked, requireType: typeof require, processType: typeof process, moduleType: typeof module,
        bufferType: typeof Buffer, meta: meta ? meta.content : null };
    })()`);
    check("CSP <meta> matches", page.meta === metaCsp, page.meta);
    check("CSP blocks eval", page.evalBlocked);
    check("window.ted has exactly the contract keys", !!page.shape && JSON.stringify(sorted(page.shape)) === JSON.stringify(sorted(TED_SURFACE)), page.shape);
    check("window.ted members are functions", page.allFns);
    check("no Node in the renderer (require/process/module/Buffer undefined)",
      page.requireType === "undefined" && page.processType === "undefined" && page.moduleType === "undefined" && page.bufferType === "undefined",
      { require: page.requireType, process: page.processType, module: page.moduleType, Buffer: page.bufferType });

    const prefs = typeof wc.getLastWebPreferences === "function" ? wc.getLastWebPreferences() : null;
    if (prefs) {
      check("webPreferences: sandbox, contextIsolation, no nodeIntegration",
        prefs.sandbox === true && prefs.contextIsolation === true && prefs.nodeIntegration === false,
        { sandbox: prefs.sandbox, contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration });
    }

    if (shot) {
      const img = await wc.capturePage();
      const png = img.toPNG();
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      fs.writeFileSync(shot, png);
      const size = img.getSize();
      check("screenshot of the login screen", png.length > 1000 && size.width > 0, { file: shot, width: size.width, height: size.height });
    }

    // The renderer has no network of its own (connect-src 'none').
    const fetched = await js(`fetch("https://example.com/ted-smoke-fetch").then(() => "loaded", () => "blocked")`);
    check("renderer fetch() blocked by CSP before the network", fetched === "blocked" && !external.some((u) => u.includes("ted-smoke-fetch")), fetched);

    // window.open: denied; an https link is handed to the (recording) system browser only.
    const before = windowCount();
    const openTarget = "https://example.com/ted-smoke-window-open";
    const opened = await js(`window.open(${JSON.stringify(openTarget)}) === null`, true);
    await sleep(500);
    check("window.open denied", opened === true && windowCount() === before, { returnedNull: opened, windows: windowCount() });
    check("window.open link routed to the system browser (recorded, not opened)", shell.opened.includes(openTarget), shell.opened);

    // Navigation away from the app is blocked before any request is made.
    await js(`location.href = "https://example.com/ted-smoke-navigation"; 1`, true);
    await sleep(1500);
    const still = wc.getURL() === appUrl && (await js(`typeof window.ted === "object" && !!document.querySelector("#lg-pw")`));
    check("navigation to https://example.com blocked", still && !external.some((u) => u.includes("ted-smoke-navigation")), wc.getURL());
    check("renderer made no external requests", external.length === 0, external);
    // „Балонче“ (0.1.6): the bubble window is made only when the employee asks for it – never by a smoke run.
    check("no bubble window was opened (only the main window exists)", windowCount() === 1 && !(bubbleOpen && bubbleOpen()), { windows: windowCount() });
    // Automatic updates never run in a smoke test (electron/updater.js: disabled with --smoke-test).
    check("updater is off in the smoke test", info.updater === "off", info.updater);

    // Transport: the production MAIN fetch (Electron net) against a local echo server.
    echo = await startEcho();
    const client = createHttp({ fetchImpl: backendFetch, allowedHosts: ["127.0.0.1"], userAgent: info.userAgent });
    const post = await client.request({
      url: echo.base + "/post", method: "POST", json: { smoke: true, text: "Тед" },
      headers: { Origin: "https://evil.example", Referer: "https://evil.example/page", Authorization: "Bearer smoke" },
    });
    const p1 = echo.seen.find((s) => s.url === "/post") || { headers: {} };
    check("POST reaches the echo server and the JSON answer is read", post.status === 200 && post.json && post.json.ok === true, { status: post.status });
    check("POST carries no Origin and no Referer header", !("origin" in p1.headers) && !("referer" in p1.headers),
      Object.keys(p1.headers).sort());
    check("POST body, Content-Type and User-Agent as sent", p1.method === "POST" && p1.body === JSON.stringify({ smoke: true, text: "Тед" }) &&
      String(p1.headers["content-type"]).startsWith("application/json") && p1.headers["user-agent"] === info.userAgent,
      { method: p1.method, contentType: p1.headers["content-type"], userAgent: p1.headers["user-agent"] });
    await client.request({ url: echo.base + "/again", method: "POST", body: "x", headers: { "Content-Type": "text/plain" } });
    const p2 = echo.seen.find((s) => s.url === "/again") || { headers: {} };
    check("no cookies are stored or sent (credentials omitted)", !("cookie" in p2.headers) && !("origin" in p2.headers), Object.keys(p2.headers).sort());

    let timeoutCode = null;
    try { await client.request({ url: echo.base + "/slow", method: "POST", json: {}, timeoutMs: 400 }); } catch (e) { timeoutCode = e && e.code; }
    check("a slow answer ends as code 'timeout'", timeoutCode === "timeout", timeoutCode);

    let refused = null;
    try { await client.request({ url: `http://127.0.0.1:${await freePort()}/x`, method: "POST", json: {} }); } catch (e) { refused = { code: e && e.code, sent: e && e.sent }; }
    check("a refused connection is reported as 'network', not sent", !!refused && refused.code === "network" && refused.sent === false, refused);

    let hostRefused = null;
    try { await client.request({ url: "https://example.com/" }); } catch (e) { hostRefused = e && e.code; }
    check("hosts outside the allowlist are refused without a request", hostRefused === "host", hostRefused);
  } catch (e) {
    check("smoke run completed", false, String((e && e.stack) || e).slice(0, 2000));
  } finally {
    if (echo) await echo.close().catch(() => {});
  }

  check("no console errors in the renderer", consoleErrors.length === 0, consoleErrors);
  return {
    ok: checks.length > 0 && checks.every((c) => c.ok),
    durationMs: Date.now() - t0,
    ...info.meta,
    transport: "electron net (session.fetch, in-memory partition)",
    updater: info.updater || "unknown",
    checks,
  };
}

// Writes the report, removes the temporary profile (best effort) and returns the exit code.
export function writeSmokeReport(smoke, report) {
  const json = JSON.stringify(report, null, 2);
  if (smoke.report) {
    fs.mkdirSync(path.dirname(smoke.report), { recursive: true });
    fs.writeFileSync(smoke.report, json + "\n");
  }
  process.stdout.write(`ted-smoke: ${report.ok ? "PASS" : "FAIL"} (${(report.checks || []).filter((c) => c.ok).length}/${(report.checks || []).length})\n`);
  if (!report.ok) process.stdout.write(json + "\n");
  return report.ok ? 0 : 1;
}

export function removeSmokeProfile(smoke) {
  if (!smoke.userData || !path.basename(smoke.userData).startsWith("ted-smoke-")) return;
  try { fs.rmSync(smoke.userData, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Windows may still hold a lock */ }
}
