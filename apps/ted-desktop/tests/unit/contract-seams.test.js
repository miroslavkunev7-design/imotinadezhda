// Cross-area seams of docs/CONTRACT.md: the window.ted surface must be the same in the contract,
// the smoke test, the mock bridge and every call the renderer makes; the CSP must be the same in
// protocol.js and index.html; the packaging config must match the file layout.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TED_SURFACE, parseSmokeArgs } from "../../electron/smoke.js";
import { CSP, META_CSP } from "../../electron/protocol.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const sortedSurface = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, [...o[k]].sort()]));

describe("window.ted surface", () => {
  it("CONTRACT.md §2 + §8 + §22 + §23 list exactly the surface the smoke test checks", () => {
    const contract = read("docs/CONTRACT.md");
    const section = (n) => contract.split(new RegExp(`^## ${n}\\.`, "m"))[1].split(/^## \d+\./m)[0];
    const block = section(2) + section(8) + section(22) + section(23) + section(24);
    const found = {};
    const add = (g, fn) => { found[g] = found[g] || []; if (!found[g].includes(fn)) found[g].push(fn); };
    for (const m of block.matchAll(/^ted\.(\w+)\.(\w+)\(/gm)) add(m[1], m[2]);
    // §8.10, §22 and §23 name the new subscriptions: "Subscriptions in preload: `realgpt.onEvent`, `video.onEvent`, …".
    const subs = [...block.matchAll(/Subscriptions in preload:([\s\S]*?)(\n\n|$)/g)];
    expect(subs).toHaveLength(4);
    for (const sub of subs) for (const m of sub[1].matchAll(/`(\w+)\.(\w+)`/g)) add(m[1], m[2]);
    expect(sortedSurface(found)).toEqual(sortedSurface(TED_SURFACE));
  });

  it("every window.ted call in the renderer exists in the contract", () => {
    const files = fs.readdirSync(path.join(root, "src"), { recursive: true })
      .map(String).filter((f) => /\.(js|jsx)$/.test(f) && !f.startsWith("mock"));
    const used = new Set();
    for (const f of files) for (const m of read(path.join("src", f)).matchAll(/\bted\.(\w+)\.(\w+)\(/g)) used.add(`${m[1]}.${m[2]}`);
    expect(used.size).toBeGreaterThan(30);
    const known = new Set(Object.entries(TED_SURFACE).flatMap(([g, fns]) => fns.map((fn) => `${g}.${fn}`)));
    expect([...used].filter((u) => !known.has(u))).toEqual([]);
  });

  describe("mock bridge", () => {
    let saved;
    beforeAll(() => { saved = globalThis.window; globalThis.window = {}; });
    afterAll(() => { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; });

    it("implements exactly the contract surface, all functions", async () => {
      const { createMockBridge } = await import("../../src/mock/bridge.mock.js");
      const bridge = createMockBridge();
      const shape = Object.fromEntries(Object.entries(bridge).map(([k, v]) => [k, Object.keys(v)]));
      expect(sortedSurface(shape)).toEqual(sortedSurface(TED_SURFACE));
      for (const group of Object.values(bridge)) for (const fn of Object.values(group)) expect(typeof fn).toBe("function");
    });

    it("every subscription returns an unsubscribe function, like preload", async () => {
      const { createMockBridge } = await import("../../src/mock/bridge.mock.js");
      const bridge = createMockBridge();
      for (const [g, fn] of SUBS) {
        const un = bridge[g][fn](() => {});
        expect(typeof un, `${g}.${fn}`).toBe("function");
        un();
      }
    });

    it("handles every URL flag of CONTRACT §17", () => {
      const mock = read("src/mock/bridge.mock.js");
      const contract = read("docs/CONTRACT.md");
      const s17 = contract.split(/^## 17\./m)[1].split(/^## \d+\./m)[0];
      const flags = [...new Set([...s17.matchAll(/`(\w+)=/g)].map((m) => m[1]))];
      expect(flags).toEqual(expect.arrayContaining(["consent", "agent", "agentFail", "upd", "lib", "sched", "video", "browse"]));
      for (const f of flags) expect(mock, f).toContain(`params.get("${f}")`);
    });
  });

  // preload.cjs is the real bridge: its groups/functions, the IPC channels they invoke and the push channels they
  // subscribe to must match TED_SURFACE, the handlers in ipc.js and the channels MAIN pushes (main.js).
  describe("preload ↔ MAIN", () => {
    const preload = read("electron/preload.cjs");
    const ipc = read("electron/ipc.js");
    const main = read("electron/main.js");
    const exposed = preload.slice(preload.indexOf('exposeInMainWorld("ted"'));

    it("exposes exactly TED_SURFACE, each function bound to its own ted:<group>.<fn> channel", () => {
      const shape = {};
      let group = null;
      for (const line of exposed.split("\n")) {
        const g = /^ {2}(\w+): \{$/.exec(line);
        if (g) { group = g[1]; shape[group] = []; continue; }
        const f = /^ {4}(\w+): \((\w*)[^)]*\) => (invoke|subscribe)\("ted:(\w+)\.(\w+)"/.exec(line);
        if (f && group) {
          shape[group].push(f[1]);
          if (f[3] === "invoke") expect(`${f[4]}.${f[5]}`, line).toBe(`${group}.${f[1]}`);
        }
      }
      expect(sortedSurface(shape)).toEqual(sortedSurface(TED_SURFACE));
      // No generic invoke or send is exposed.
      expect(exposed).not.toMatch(/ipcRenderer\.(send|sendSync|invoke)\(\s*[a-z]+\s*[,)]/);
    });

    it("every invoked channel has exactly one handler in ipc.js and every handler is reachable", () => {
      const invoked = [...exposed.matchAll(/invoke\("(ted:[\w.]+)"/g)].map((m) => m[1]).sort();
      const handled = [...ipc.matchAll(/^ {4}"(ted:\w+\.\w+)": /gm)].map((m) => m[1]).sort();
      expect(new Set(invoked).size).toBe(invoked.length);
      expect(handled).toEqual(invoked);
    });

    it("push channels: preload subscriptions = what main.js pushes = §2 + §8.10", () => {
      const subscribed = [...exposed.matchAll(/subscribe\("(ted:[\w.]+)"/g)].map((m) => m[1]).sort();
      const pushed = [...new Set([...main.matchAll(/push\("(ted:[\w.]+)"/g)].map((m) => m[1]))].sort();
      expect(pushed).toEqual(subscribed);
      const s810 = read("docs/CONTRACT.md").split(/^### 8\.10/m)[1].split(/^### /m)[0];
      const listed = [...s810.matchAll(/`(ted:[\w.]+)`/g)].map((m) => m[1]);
      // §22 (0.1.6): "Subscriptions in preload: `window.onMode` (channel `ted:window.mode`)." – §23 (0.1.7) likewise.
      const subsOf = (n) => {
        const sec = read("docs/CONTRACT.md").split(new RegExp(`^## ${n}\\.`, "m"))[1].split(/^## \d+\./m)[0];
        return [...(/Subscriptions in preload:([^\n]*)/.exec(sec)[1]).matchAll(/`(ted:[\w.]+)`/g)].map((m) => m[1]);
      };
      const listed22 = subsOf(22);
      const listed23 = subsOf(23);
      const listed24 = subsOf(24);
      expect(listed24).toEqual(["ted:social.state"]);
      expect(listed22).toEqual(["ted:window.mode"]);
      expect(listed23).toEqual(["ted:chatgpt.state"]);
      // 0.1.2 (§2) had auth.changed and realgpt.delta; §8.10 lists the 0.1.3 ones, §22 the 0.1.6 one, §23 the 0.1.7 one.
      expect([...listed, ...listed22, ...listed23, ...listed24, "ted:auth.changed", "ted:realgpt.delta"].sort()).toEqual(subscribed);
      expect(SUBS.map(([g, fn]) => `${g}.${fn}`).sort()).toEqual(
        Object.entries(TED_SURFACE).flatMap(([g, fns]) => fns.filter((fn) => /^on[A-Z]/.test(fn)).map((fn) => `${g}.${fn}`)).sort());
    });
  });

  it("the renderer uses the 0.1.3 surface (no dead functions besides the documented ones)", () => {
    const files = fs.readdirSync(path.join(root, "src"), { recursive: true })
      .map(String).filter((f) => /\.(js|jsx)$/.test(f) && !f.startsWith("mock"));
    const src = files.map((f) => read(path.join("src", f))).join("\n");
    const unused = Object.entries(TED_SURFACE).flatMap(([g, fns]) => fns.map((fn) => `${g}.${fn}`))
      .filter((k) => !new RegExp(`\\bted\\.${k.replace(".", "\\.")}\\b`).test(src));
    // files.forget is called through the ted.files object handed to lib/files.js addFiles().
    // window.miniChat (0.1.6, §22): the employee reaches the mini chat through the bubble (MAIN's own path).
    expect(unused).toEqual(["files.forget", "window.miniChat"]);
    expect(read("src/lib/files.js")).toMatch(/files\.forget\(/);
  });

  it("no placeholder seams: FEATURES modules are imported statically", () => {
    expect(fs.existsSync(path.join(root, "src/components/layout/features.js"))).toBe(false);
    const app = read("src/App.jsx");
    for (const c of ["AgentSteps", "ApprovalCard", "ConsentModal", "FileCard", "ToolsUnsupportedCard", "VideoCard"]) {
      expect(app).toContain(`import ${c} from "./components/agent/${c}.jsx";`);
    }
    expect(app).toContain('import { agentSnapshot, useAgentEvents } from "./lib/agent.js";');
    const main = read("src/main.jsx");
    const order = ["style.css", "desktop.css", "layout.css", "agent.css"].map((f) => main.indexOf(`./styles/${f}`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

// Every subscription of the surface (on* functions).
const SUBS = [["auth", "onChange"], ["realgpt", "onDelta"], ["realgpt", "onEvent"], ["video", "onEvent"], ["library", "onChange"], ["scheduled", "onDue"], ["updates", "onChange"], ["window", "onMode"], ["chatgpt", "onState"], ["social", "onState"]];

// 0.1.6 „Балонче“ (§22): the bubble window has its own preload and channels, documented in the contract.
describe("bubble window bridge", () => {
  const preload = read("electron/preload-bubble.cjs");
  const bubble = read("electron/bubble.js");
  const s22 = read("docs/CONTRACT.md").split(/^## 22\./m)[1] || "";

  it("preload-bubble.cjs exposes only window.tedBubble with the §22 functions, each on its own ted-bubble: channel", () => {
    expect([...preload.matchAll(/exposeInMainWorld\("(\w+)"/g)].map((m) => m[1])).toEqual(["tedBubble"]);
    const fns = [...preload.matchAll(/^ {2}(\w+): \(/gm)].map((m) => m[1]);
    const documented = [...s22.matchAll(/^tedBubble\.(\w+)\(/gm)].map((m) => m[1]);
    expect(fns.sort()).toEqual([...documented].sort());
    const invoked = [...preload.matchAll(/invoke\("(ted-bubble:\w+)"/g)].map((m) => m[1]);
    expect(invoked.sort()).toEqual(fns.filter((f) => f !== "onState").map((f) => "ted-bubble:" + f).sort());
    // Exactly the channels registerBubbleIpc handles, and one push channel.
    const handled = [...bubble.matchAll(/^ {4}"(ted-bubble:\w+)": /gm)].map((m) => m[1]);
    expect(handled.sort()).toEqual(invoked.sort());
    expect([...preload.matchAll(/ipcRenderer\.on\("([\w:.-]+)"/g)].map((m) => m[1])).toEqual(["ted-bubble:state"]);
    expect(bubble).toContain('BUBBLE_STATE = "ted-bubble:state"');
    // Nothing of the main bridge, no generic invoke, no other module.
    expect(preload).not.toMatch(/"ted:/);
    expect(preload).not.toMatch(/ipcRenderer\.(send|sendSync|postMessage|sendToHost)\b/);
    expect(preload).not.toMatch(/require\((?!"electron"\))/);
    const code = preload.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(code).not.toMatch(/\b(crm|realgpt|openai|fetch|files|api|chat|store|auth)\b/i);
  });

  it("bubble.html carries the same CSP and is built as a second page; the bubble renderer uses only tedBubble", () => {
    const meta = read("bubble.html").match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    expect(meta && meta[1]).toBe(META_CSP);
    expect(read("vite.config.mjs")).toMatch(/bubble: fileURLToPath\(new URL\("\.\/bubble\.html"/);
    expect(read("scripts/check-bundle.mjs")).toMatch(/"index\.html", "bubble\.html"/);
    const src = read("src/bubble/bubble.js");
    expect(src).not.toMatch(/window\.ted\b(?!Bubble)|from "\.\.\/bridge\.js"/);
    expect(src).toMatch(/import\.meta\.env\.MODE === "mock"/); // the mock is dead code in the production build
  });
});

describe("CSP", () => {
  it("index.html carries META_CSP: the header policy without frame-ancestors", () => {
    const meta = read("index.html").match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    expect(meta && meta[1]).toBe(META_CSP);
    expect(META_CSP).toBe(CSP.replace("; frame-ancestors 'none'", ""));
    expect(CSP).toContain("frame-ancestors 'none'");
  });
});

describe("README ↔ CONTRACT", () => {
  const rows = (text) => text.split("\n").filter((l) => /^\| /.test(l) && !/^\|---/.test(l)).length;
  it("README carries the parity table of CONTRACT §20 (same rows) and the updater facts", () => {
    const s20 = read("docs/CONTRACT.md").split(/^## 20\./m)[1].split(/^## \d+\./m)[0];
    const readme = read("README.md");
    const table = readme.split(/^## ChatGPT → Тед за Windows$/m)[1].split(/^## /m)[0];
    expect(rows(table)).toBe(rows(s20));
    expect(rows(s20)).toBeGreaterThan(40);
    expect(readme).toMatch(/Версия 0\.1\.2 няма обновяване/);
    expect(readme).toContain("SHA-512");
    for (const h of ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]) expect(readme).toContain(h);
    expect(readme).toContain("latest.yml");
  });
});

describe("smoke arguments", () => {
  it("is off unless --smoke-test is given; paths are resolved", () => {
    expect(parseSmokeArgs(["electron", "."])).toBeNull();
    const s = parseSmokeArgs(["x", "--smoke-test", "--smoke-report=out/r.json"]);
    expect(s.report).toBe(path.resolve("out/r.json"));
    expect(s.shot).toBeNull();
    expect(parseSmokeArgs(["x", "--smoke-test", '--smoke-shot="a b.png"']).shot).toBe(path.resolve("a b.png"));
  });
});

describe("packaging layout", () => {
  const pkg = JSON.parse(read("package.json"));
  const builder = read("electron-builder.yml");
  const workflow = read("../../.github/workflows/ted-desktop.yml");

  it("package.json main, preload and dist are where electron-builder packs them", () => {
    expect(pkg.main).toBe("electron/main.js");
    expect(fs.existsSync(path.join(root, pkg.main))).toBe(true);
    expect(read("electron/main.js")).toMatch(/path\.join\(here, "preload\.cjs"\)/);
    expect(read("electron/main.js")).toMatch(/path\.join\(app\.getAppPath\(\), "dist"\)/);
    for (const entry of ["- dist/**", "- electron/**", "- package.json"]) expect(builder).toContain(entry);
    // Packed by electron-builder from node_modules; exact versions (CONTRACT §10.4).
    // fflate 0.8.3 (MIT, 2026-05-16): the ZIP of a project folder (0.1.5, CONTRACT §8.12); already used inside docx/pdfkit.
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["docx", "electron-updater", "fflate", "jose", "mammoth", "pdfkit", "read-excel-file", "unpdf", "write-excel-file"]);
    for (const v of Object.values(pkg.dependencies)) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies).toMatchObject({ "electron-updater": "6.8.11", docx: "9.15.1", pdfkit: "0.20.2", "write-excel-file": "4.1.1", "read-excel-file": "9.3.14", mammoth: "1.13.0", unpdf: "2.1.0", fflate: "0.8.3" });
  });

  it("the workflow uses existing npm scripts and the packaged exe name", () => {
    for (const m of workflow.matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts, m[1]).toHaveProperty(m[1]);
    const exe = builder.match(/executableName:\s*(\S+)/)[1];
    expect(workflow).toContain(`win-unpacked\\${exe}.exe`);
    expect(workflow).toContain("--smoke-test");
    expect(workflow).toContain("--smoke-report=");
  });
});

// 0.1.7 „ChatGPT панел“ (§23): the one documented exception to the MAIN-only network rule, wired where the contract says.
describe("ChatGPT panel seams", () => {
  const panel = read("electron/chatgpt-panel.js");
  const main = read("electron/main.js");
  const contract = read("docs/CONTRACT.md");
  const s23 = contract.split(/^## 23\./m)[1] || "";

  it("the panel module imports no Electron and nothing of the app's tokens, sessions or IPC; its view has no preload", async () => {
    expect(panel).not.toMatch(/from "electron"/);
    expect(panel).not.toMatch(/ipcMain|ipcRenderer|preload\s*:|backend\/|realgpt\/|ted-backend|ted-browse|secureStore|secure-file|getAccessToken/);
    const { panelWebPreferences } = await import("../../electron/chatgpt-panel.js");
    expect(panelWebPreferences({ packaged: true })).not.toHaveProperty("preload");
  });

  it("main.js hands the panel to security.js as a delegate, detaches it on a CRM user change, hides it in the bubble, checks it in the smoke run", () => {
    expect(main).toMatch(/delegate: \{ owns: \(contents\) => \(!!panel && panel\.owns\(contents\)\) \|\| \(!!social && social\.owns\(contents\)\), harden: \(contents\) => \(panel && panel\.owns\(contents\) \? panel\.harden\(contents\) : social\.harden\(contents\)\) \}/);
    expect(main).toMatch(/onUserChange = \(\) => \{\s*\n\s*if \(panel\) panel\.detach\(\);/);
    expect(main).toMatch(/panel\.setWindowMode\(mode\)/);
    expect(main).toMatch(/panelMade: \(\) => panel\.created\(\)/);
    expect(main).toMatch(/userAgent: chromeUserAgent\(app\.userAgentFallback\)/);
    // Fixer (review): sign-in windows of a fixed shape need BrowserWindow; Accept-Language from the program's locale.
    expect(main).toMatch(/panel = createChatGptPanel\(\{\s*\n\s*WebContentsView, BrowserWindow, fromPartition/);
    expect(main).toMatch(/locale: app\.getLocale\(\), platform: process\.platform/);
    expect(read("electron/smoke.js")).toMatch(/the ChatGPT panel was not opened/);
  });

  it("the contract names the exception, the hosts and the permission exactly as the code has them", async () => {
    const m = await import("../../electron/chatgpt-panel.js");
    expect(contract).toMatch(/The ONE documented exception/);
    for (const h of [...m.SIGNIN_HOSTS, ...m.PANEL_DOMAINS, "auth.openai.com"]) expect(s23, h).toContain("`" + h + "`");
    expect(s23).toContain("`clipboard-sanitized-write`");
    expect(m.PANEL_PERMISSIONS).toEqual(["clipboard-sanitized-write"]);
    const readme = read("README.md");
    expect(readme).toMatch(/^## ChatGPT панел \(от 0\.1\.7\)$/m);
    for (const h of m.SIGNIN_HOSTS) expect(readme, h).toContain(h);
    expect(read("CHANGES.md")).toMatch(/^## 0\.1\.7/m);
  });

  it("the contract states the panel's limits and the download allowlist exactly as the code has them", async () => {
    const m = await import("../../electron/chatgpt-panel.js");
    expect(s23).toContain("`GESTURE_MS` = " + m.GESTURE_MS / 1000 + " s");
    expect(s23).toContain("`MAX_CHILDREN` = " + m.MAX_CHILDREN);
    expect(s23).toContain("`BLANK_CHILD_MS` = " + m.BLANK_CHILD_MS / 1000 + " s");
    for (const d of m.DOWNLOAD_DOMAINS) expect(s23, d).toContain("`" + d + "`");
    const types = /\\.\((.*)\)\$/.exec(m.DOWNLOADABLE.source)[1].replace("jpe?g", "jpg|jpeg").split("|");
    const listed = /`DOWNLOADABLE`: ([^)]*)\)/.exec(s23.replace(/\s+/g, " "))[1].replace("jpg/jpeg", "jpg, jpeg").split(/,\s*/);
    expect(listed.sort()).toEqual(types.sort());
    const readme = read("README.md");
    for (const t of types) expect(readme, t).toContain(t.toUpperCase());
    expect(s23).toContain("ted.chatgpt.openInBrowser({blocked:true}?)");
  });
});
