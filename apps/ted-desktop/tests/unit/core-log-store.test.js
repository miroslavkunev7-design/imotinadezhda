import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLog, redact } from "../../electron/log.js";
import { createSecureStore } from "../../electron/store/secure-file.js";
import { createSettings } from "../../electron/store/settings.js";
import { createChats } from "../../electron/store/chats.js";
import { fakeSafeStorage, makeJwt, memoryStore } from "./core-helpers.js";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "ted-core-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe("redact", () => {
  const jwt = makeJwt({ sub: "u1", exp: 1900000000 });

  it("removes Bearer tokens and bare JWTs", () => {
    expect(redact(`Authorization: Bearer ${jwt}`)).toBe("Authorization: Bearer [REDACTED]");
    expect(redact("bearer abc.DEF-123_x")).toBe("Bearer [REDACTED]");
    expect(redact(`token=${jwt} tail`)).not.toContain(jwt);
    expect(redact(`saw ${jwt} here`)).toBe("saw [JWT] here");
  });

  it("removes refresh_token, access_token, id_token and password values in JSON and form bodies", () => {
    const out = redact(JSON.stringify({ refresh_token: "rt-SECRET-1", access_token: "at-SECRET-2", id_token: "it-SECRET-3", password: 'p"a ss-SECRET-4', keep: "ok" }));
    for (const s of ["SECRET-1", "SECRET-2", "SECRET-3", "SECRET-4"]) expect(out).not.toContain(s);
    expect(JSON.parse(out)).toEqual({ refresh_token: "[REDACTED]", access_token: "[REDACTED]", id_token: "[REDACTED]", password: "[REDACTED]", keep: "ok" });
    expect(redact("grant_type=refresh_token&refresh_token=rt-SECRET&client_id=app")).toBe("grant_type=refresh_token&refresh_token=[REDACTED]&client_id=app");
    expect(redact("password=hunter2&x=1")).toBe("password=[REDACTED]&x=1");
    expect(redact("code_verifier=abc123")).toBe("code_verifier=[REDACTED]");
  });

  it("removes secrets inside a JSON string nested in JSON", () => {
    const out = redact(JSON.stringify({ body: JSON.stringify({ refresh_token: "rt-SECRET", password: "pw-SECRET" }) }));
    expect(out).not.toContain("SECRET");
  });

  it("removes code= and state= query parameters", () => {
    expect(redact("GET /auth/callback?code=AbC-123.x&state=s_456 HTTP/1.1")).toBe("GET /auth/callback?code=[REDACTED]&state=[REDACTED] HTTP/1.1");
    expect(redact("http://127.0.0.1:5123/auth/callback?state=zzz&code=yyy")).toBe("http://127.0.0.1:5123/auth/callback?state=[REDACTED]&code=[REDACTED]");
    expect(redact("error_code=5 status_code=200")).toBe("error_code=5 status_code=200");
  });

  it("removes base64 payloads (data URLs and long runs)", () => {
    expect(redact("img data:image/png;base64,iVBORw0KGgoAAAANSUhEUg== end")).toBe("img data:image/png;base64,[REDACTED] end");
    expect(redact("audio data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQ")).toBe("audio data:audio/webm;codecs=opus;base64,[REDACTED]");
    const blob = "QUJD".repeat(100);
    expect(redact(`{"data":"${blob}"}`)).toBe('{"data":"[BASE64]"}');
  });

  it("leaves ordinary log text alone and tolerates non-strings", () => {
    const line = '{"event":"http","method":"POST","host":"imotinadezhda.bg","path":"/api/assistant","status":200,"ms":812}';
    expect(redact(line)).toBe(line);
    expect(redact(undefined)).toBe("");
    expect(redact(42)).toBe("42");
  });
});

describe("createLog", () => {
  const read = (name = "main.log") => fs.readFileSync(path.join(dir, "logs", name), "utf8");

  it("writes redacted JSON lines into <dir>/main.log", () => {
    const log = createLog({ dir: path.join(dir, "logs") });
    expect(log.dir).toBe(path.join(dir, "logs"));
    log.info("http", { method: "POST", path: "/api/assistant", status: 200, ms: 12 });
    log.warn("session.refresh_failed", { detail: `Bearer ${makeJwt({ sub: "x" })}`, url: "https://x/cb?code=abc&state=def" });
    log.error("boom", { message: "bad" });
    const lines = read().trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => [l.level, l.event])).toEqual([["info", "http"], ["warn", "session.refresh_failed"], ["error", "boom"]]);
    expect(lines[0]).toMatchObject({ method: "POST", path: "/api/assistant", status: 200, ms: 12 });
    expect(lines[0].ts).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(lines[1].detail).toBe("Bearer [REDACTED]");
    expect(lines[1].url).toBe("https://x/cb?code=[REDACTED]&state=[REDACTED]");
  });

  it("never writes message text, file contents or credentials even if a caller passes them", () => {
    const log = createLog({ dir: path.join(dir, "logs") });
    log.info("chat", { requestId: "r1", text: "поверителен въпрос за клиент", messages: [{ text: "тайна" }], files: [{ data: "QUJD" }], password: "hunter2", identifier: "0888123456", body: "{}", data: "QUJD" });
    const raw = read();
    for (const secret of ["поверителен", "тайна", "hunter2", "0888123456", "QUJD"]) expect(raw).not.toContain(secret);
    expect(JSON.parse(raw)).toMatchObject({ requestId: "r1", text: "[omitted]", messages: "[omitted]", files: "[omitted]", password: "[REDACTED]" });
  });

  it("rotates at 1 MB and keeps three files", () => {
    const log = createLog({ dir: path.join(dir, "logs") });
    const pad = "x ".repeat(190); // ~380 chars per line, below the per-field cap
    for (let i = 0; i < 9000; i++) log.info("fill", { i, pad });
    const names = fs.readdirSync(path.join(dir, "logs")).sort();
    expect(names).toEqual(["main.1.log", "main.2.log", "main.log"]);
    for (const n of names) expect(fs.statSync(path.join(dir, "logs", n)).size).toBeLessThanOrEqual(1024 * 1024);
    expect(read().trim().split("\n").pop()).toContain('"i":8999');
  });

  it("is a harmless no-op without a directory or when the directory cannot be created", () => {
    expect(() => createLog().info("x", {})).not.toThrow();
    const file = path.join(dir, "not-a-dir");
    fs.writeFileSync(file, "x");
    expect(() => createLog({ dir: path.join(file, "logs") }).error("x", { a: 1 })).not.toThrow();
  });
});

describe("secure-file store", () => {
  const make = (opts) => createSecureStore({ dir: path.join(dir, "secure"), safeStorage: fakeSafeStorage(opts) });

  it("round-trips an object and stores it encrypted, not as plaintext", () => {
    const store = make();
    expect(store.available()).toBe(true);
    expect(store.read("session")).toBeNull();
    const value = { access_token: "at-PLAINTEXT-CHECK", refresh_token: "rt", user: { name: "Тест" } };
    expect(store.write("session", value)).toBe(true);
    expect(store.read("session")).toEqual(value);
    const raw = fs.readFileSync(path.join(dir, "secure", "session.bin"), "utf8");
    expect(raw.startsWith("enc1:")).toBe(true);
    expect(raw).not.toContain("PLAINTEXT-CHECK");
  });

  it("writes atomically: tmp file first, then rename; no tmp file is left behind", () => {
    const store = make();
    const seen = [];
    const realWrite = fs.writeFileSync;
    const realRename = fs.renameSync;
    fs.writeFileSync = (file, ...rest) => { seen.push(["write", path.basename(String(file))]); return realWrite(file, ...rest); };
    fs.renameSync = (from, to) => { seen.push(["rename", path.basename(String(from)), path.basename(String(to))]); return realRename(from, to); };
    try {
      store.write("session", { a: 1 });
    } finally {
      fs.writeFileSync = realWrite;
      fs.renameSync = realRename;
    }
    expect(seen).toHaveLength(2);
    expect(seen[0][0]).toBe("write");
    expect(seen[0][1]).toMatch(/^session\.bin\.\d+\.[0-9a-f]{8}\.tmp$/);
    expect(seen[1]).toEqual(["rename", seen[0][1], "session.bin"]);
    expect(fs.readdirSync(path.join(dir, "secure"))).toEqual(["session.bin"]);
  });

  it("keeps the previous file intact when a write fails half way", () => {
    const store = make();
    store.write("session", { v: 1 });
    const realRename = fs.renameSync;
    fs.renameSync = () => { throw new Error("disk full"); };
    try {
      expect(() => store.write("session", { v: 2 })).toThrow("disk full");
    } finally {
      fs.renameSync = realRename;
    }
    expect(store.read("session")).toEqual({ v: 1 });
    expect(fs.readdirSync(path.join(dir, "secure"))).toEqual(["session.bin"]);
  });

  it("corrupt file -> null, set aside, and the next write works", () => {
    const store = make();
    fs.mkdirSync(path.join(dir, "secure"), { recursive: true });
    const file = path.join(dir, "secure", "session.bin");
    for (const garbage of ["garbage that cannot be decrypted", "enc1:" + Buffer.from("{not json").toString("hex"), "enc1:" + Buffer.from('"just a string"').toString("hex"), ""]) {
      fs.writeFileSync(file, garbage);
      expect(store.read("session")).toBeNull();
      expect(fs.existsSync(file)).toBe(false);
      expect(fs.existsSync(file + ".corrupt")).toBe(true);
    }
    expect(store.write("session", { ok: true })).toBe(true);
    expect(store.read("session")).toEqual({ ok: true });
  });

  it("never writes plaintext when encryption is unavailable", () => {
    const store = make({ available: false });
    expect(store.available()).toBe(false);
    expect(store.write("session", { access_token: "x" })).toBe(false);
    expect(fs.existsSync(path.join(dir, "secure"))).toBe(false);
    expect(store.read("session")).toBeNull();
    // A file written earlier is left untouched (not treated as corrupt) while encryption is unavailable.
    make().write("session", { v: 1 });
    expect(store.read("session")).toBeNull();
    expect(make().read("session")).toEqual({ v: 1 });
  });

  it("remove deletes the file and is safe to repeat", () => {
    const store = make();
    store.write("chats", { chats: [] });
    store.remove("chats");
    store.remove("chats");
    expect(store.read("chats")).toBeNull();
  });

  it("keeps odd names inside its own directory", () => {
    const store = make();
    for (const name of ["../../escape", "..", "a/b", "realgpt-auth0|abc.def", "C:\\x"]) {
      store.write(name, { name });
      expect(store.read(name)).toEqual({ name });
    }
    const files = fs.readdirSync(path.join(dir, "secure"));
    expect(files).toHaveLength(5);
    for (const f of files) expect(f).toMatch(/^[A-Za-z0-9_~-]+\.bin$/);
    expect(fs.readdirSync(dir)).toEqual(["secure"]);
    expect(() => store.write("", {})).toThrow();
  });
});

describe("settings", () => {
  it("merges patches, persists as plain JSON and survives a corrupt file", () => {
    const file = path.join(dir, "cfg", "settings.json");
    const a = createSettings({ file });
    expect(a.get()).toEqual({});
    expect(a.set({ voice: "Charon", big: true })).toEqual({ voice: "Charon", big: true });
    expect(a.set({ big: false, role: "auto" })).toEqual({ voice: "Charon", big: false, role: "auto" });
    expect(a.set({ role: undefined })).toEqual({ voice: "Charon", big: false });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ voice: "Charon", big: false });
    expect(createSettings({ file }).get()).toEqual({ voice: "Charon", big: false });
    expect(fs.readdirSync(path.dirname(file))).toEqual(["settings.json"]); // no tmp left

    fs.writeFileSync(file, "{broken");
    const b = createSettings({ file });
    expect(b.get()).toEqual({});
    expect(b.set({ x: 1 })).toEqual({ x: 1 });
  });

  it("ignores non-object patches and returns copies", () => {
    const s = createSettings({ file: path.join(dir, "settings.json") });
    s.set({ nested: { a: 1 } });
    for (const bad of [null, undefined, "x", 5, [1, 2]]) expect(s.set(bad)).toEqual({ nested: { a: 1 } });
    const copy = s.get();
    copy.nested.a = 99;
    expect(s.get()).toEqual({ nested: { a: 1 } });
  });
});

describe("chats", () => {
  const chat = (id) => ({ id, title: "Разговор " + id, messages: [{ role: "user", text: "здравей" }] });

  it("stores chats encrypted under the name 'chats', separately for each profile", () => {
    const store = createSecureStore({ dir: path.join(dir, "secure"), safeStorage: fakeSafeStorage() });
    let user = "user-a";
    const chats = createChats({ secureStore: store, userId: () => user });
    expect(chats.load()).toEqual({ chats: [] });
    expect(chats.save([chat(1), chat(2)])).toEqual({ ok: true });
    expect(chats.load()).toEqual({ chats: [chat(1), chat(2)] });
    expect(fs.readdirSync(path.join(dir, "secure"))).toEqual(["chats.bin"]);
    expect(fs.readFileSync(path.join(dir, "secure", "chats.bin"), "utf8")).not.toContain("Разговор");

    user = "user-b";
    expect(chats.load()).toEqual({ chats: [] });
    chats.save([chat(3)]);
    user = "user-a";
    expect(chats.load().chats.map((c) => c.id)).toEqual([1, 2]);
  });

  it("clear removes only the chats of the signed-in profile", () => {
    const store = memoryStore();
    let user = "user-a";
    const chats = createChats({ secureStore: store, userId: () => user });
    chats.save([chat(1)]);
    user = "user-b";
    chats.save([chat(2)]);
    expect(chats.clear()).toEqual({ ok: true });
    expect(chats.load()).toEqual({ chats: [] });
    user = "user-a";
    expect(chats.load().chats).toHaveLength(1);
    chats.clear();
    expect(store.read("chats")).toBeNull();
  });

  it("does not load or save when signed out, and refuses to save without encryption", () => {
    const store = memoryStore();
    const out = createChats({ secureStore: store, userId: () => null });
    expect(out.load()).toEqual({ chats: [] });
    expect(out.save([chat(1)])).toMatchObject({ ok: false });
    expect(store.data.size).toBe(0);

    const plain = memoryStore({ available: false });
    const chats = createChats({ secureStore: plain, userId: () => "user-a" });
    expect(chats.save([chat(1)])).toMatchObject({ ok: false });
    expect(plain.data.size).toBe(0);
  });
});

describe("atomic write under a short Windows file lock", () => {
  it("retries the rename a few times before giving up", () => {
    const store = createSecureStore({ dir: path.join(dir, "secure"), safeStorage: fakeSafeStorage() });
    const realRename = fs.renameSync;
    let attempts = 0;
    fs.renameSync = (from, to) => {
      attempts++;
      if (attempts <= 2) throw Object.assign(new Error("locked"), { code: "EPERM" });
      return realRename(from, to);
    };
    try {
      expect(store.write("session", { v: 3 })).toBe(true);
    } finally {
      fs.renameSync = realRename;
    }
    expect(attempts).toBe(3);
    expect(store.read("session")).toEqual({ v: 3 });

    attempts = 0;
    fs.renameSync = () => { attempts++; throw Object.assign(new Error("locked"), { code: "EBUSY" }); };
    try {
      expect(() => store.write("session", { v: 4 })).toThrow("locked");
    } finally {
      fs.renameSync = realRename;
    }
    expect(attempts).toBe(5);
    expect(store.read("session")).toEqual({ v: 3 }); // the previous content survives
    expect(fs.readdirSync(path.join(dir, "secure"))).toEqual(["session.bin"]);
  });
});
