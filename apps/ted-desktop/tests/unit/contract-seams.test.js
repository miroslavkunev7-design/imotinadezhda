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
  it("CONTRACT.md §2 + §8 list exactly the surface the smoke test checks", () => {
    const contract = read("docs/CONTRACT.md");
    const section = (n) => contract.split(new RegExp(`^## ${n}\\.`, "m"))[1].split(/^## \d+\./m)[0];
    const block = section(2) + section(8);
    const found = {};
    const add = (g, fn) => { found[g] = found[g] || []; if (!found[g].includes(fn)) found[g].push(fn); };
    for (const m of block.matchAll(/^ted\.(\w+)\.(\w+)\(/gm)) add(m[1], m[2]);
    // §8.10 names the new subscriptions: "Subscriptions in preload: `realgpt.onEvent`, `video.onEvent`, …".
    const subs = /Subscriptions in preload:([\s\S]*?)(\n\n|$)/.exec(block);
    expect(subs).not.toBeNull();
    for (const m of subs[1].matchAll(/`(\w+)\.(\w+)`/g)) add(m[1], m[2]);
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
      // 0.1.2 (§2) had auth.changed and realgpt.delta; §8.10 lists the new ones.
      expect([...listed, "ted:auth.changed", "ted:realgpt.delta"].sort()).toEqual(subscribed);
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
    expect(unused).toEqual(["files.forget"]);
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
const SUBS = [["auth", "onChange"], ["realgpt", "onDelta"], ["realgpt", "onEvent"], ["video", "onEvent"], ["library", "onChange"], ["scheduled", "onDue"], ["updates", "onChange"]];

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
    const s20 = read("docs/CONTRACT.md").split(/^## 20\./m)[1];
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
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["docx", "electron-updater", "jose", "mammoth", "pdfkit", "read-excel-file", "unpdf", "write-excel-file"]);
    for (const v of Object.values(pkg.dependencies)) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies).toMatchObject({ "electron-updater": "6.8.11", docx: "9.15.1", pdfkit: "0.20.2", "write-excel-file": "4.1.1", "read-excel-file": "9.3.14", mammoth: "1.13.0", unpdf: "2.1.0" });
  });

  it("the workflow uses existing npm scripts and the packaged exe name", () => {
    for (const m of workflow.matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts, m[1]).toHaveProperty(m[1]);
    const exe = builder.match(/executableName:\s*(\S+)/)[1];
    expect(workflow).toContain(`win-unpacked\\${exe}.exe`);
    expect(workflow).toContain("--smoke-test");
    expect(workflow).toContain("--smoke-report=");
  });
});
