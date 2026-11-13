"use strict";
/* Тед · файлове от чата: снимки → PDF, добавяне към клиент/имот, превод, групиране.
   Изолиран тест: Supabase (таблици + хранилище) и Gemini са имитирани в паметта; pdf-lib е истинският.
   Стартиране: node api/_ted-files.test.js */
const assert = require("assert");
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key";
const JPEG = require("./_vendor/jpeg-js");
const { PNG } = require("./_vendor/pngjs/lib/png.js");
const PDFLib = require("./_vendor/pdf-lib.min.js");
const GEM = require("./_gem.js");
const TED = require("./_ted-skills.js");
const API = require("./tools.js");

/* ---------- имитация на Supabase ---------- */
function makeCtx() {
  const tables = {}, files = new Map(); let seq = 0;
  const tbl = (n) => (tables[n] = tables[n] || []);
  const col = (r, c) => (r[c] !== undefined ? r[c] : (r.data || {})[c]);
  function query(name) {
    const st = { filters: [], op: "select", payload: null };
    const run = () => {
      const t = tbl(name);
      if (st.op === "upsert") {
        const r = st.payload; let hit = r.id ? t.find((x) => x.id === r.id) : null;
        if (hit) hit.data = r.data; else { hit = { id: r.id || ("id" + String(++seq).padStart(10, "0")), data: r.data, created_at: new Date().toISOString() }; t.push(hit); }
        hit.updated_at = new Date().toISOString(); return [hit];
      }
      if (st.op === "insert") { [].concat(st.payload).forEach((r) => t.push(Object.assign({ id: "id" + String(++seq).padStart(10, "0") }, r))); return []; }
      return t.filter((r) => st.filters.every(([c, v]) => col(r, c) === v));
    };
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; },
      eq(c, v) { st.filters.push([c, v]); return q; },
      upsert(r) { st.op = "upsert"; st.payload = r; return q; },
      insert(r) { st.op = "insert"; st.payload = r; return q; },
      maybeSingle() { const d = run(); return Promise.resolve({ data: d[0] || null, error: null }); },
      single() { const d = run(); return Promise.resolve(d[0] ? { data: d[0], error: null } : { data: null, error: { message: "no rows" } }); },
      then(ok, bad) { return Promise.resolve({ data: run(), error: null }).then(ok, bad); }
    };
    return q;
  }
  const storage = { from() { return {
    download(p) { const b = files.get(p); return Promise.resolve(b ? { data: { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }, error: null } : { data: null, error: { message: "Object not found" } }); },
    upload(p, buf) { files.set(p, Buffer.from(buf)); return Promise.resolve({ error: null }); },
    createSignedUrl(p) { return Promise.resolve({ data: { signedUrl: "https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files/" + p + "?token=t" }, error: null }); }
  }; } };
  const sb = { from: query, storage };
  return { ctx: { sb, userId: "u1", user: { id: "u1", email: "broker@test.local" }, token: "t" }, tables, files, tbl,
    addClient(name, num) { const r = { id: "cl" + String(++seq).padStart(10, "0"), data: { name, num }, updated_at: new Date().toISOString() }; tbl("nd_clients").push(r); return r.id; },
    addProp(code, title) { const r = { id: "pr" + String(++seq).padStart(10, "0"), data: { code, title, docs: [], pics: [] }, updated_at: new Date().toISOString() }; tbl("nd_properties").push(r); return r.id; },
    put(p, buf) { files.set(p, buf); return p; } };
}
/* ---------- тестови снимки (истински JPEG/PNG) ---------- */
function rgba(w, h, c) { const d = Buffer.alloc(w * h * 4); for (let k = 0; k < w * h; k++) { d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255; } return d; }
const jpg = (w, h, c) => Buffer.from(JPEG.encode({ data: rgba(w, h, c), width: w, height: h }, 80).data);
const png = (w, h, c) => { const p = new PNG({ width: w, height: h }); rgba(w, h, c).copy(p.data); return PNG.sync.write(p); };
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.from([20, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);
async function pdfOf(n) { const d = await PDFLib.PDFDocument.create(); for (let k = 0; k < n; k++) d.addPage([300, 400]); return Buffer.from(await d.save()); }
async function pages(buf) { assert.strictEqual(buf.slice(0, 4).toString(), "%PDF", "файлът не е PDF"); return (await PDFLib.PDFDocument.load(buf)).getPageCount(); }
/* извикване точно както /api/tools: първо валидиране на входа, после run */
async function call(env, tool, input) {
  const t = API.tools[tool]; assert.ok(t, "няма умение " + tool);
  const parsed = t.input.safeParse(input); assert.ok(parsed.success, tool + ": невалиден вход " + JSON.stringify(parsed.error && parsed.error.issues));
  return t.run(env.ctx, parsed.data);
}
async function fails(p, re, label) { try { await p; } catch (e) { assert.ok(re.test(e.message), label + ": неочаквана грешка „" + e.message + "“"); return e; } assert.fail(label + ": очаквана грешка, но мина"); }

const results = [];
async function t(name, fn) { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e && e.message]); } }

(async () => {
  const gemCalls = []; let gemImpl = null;
  GEM.generate = async (o) => { gemCalls.push(o); return { text: await gemImpl(o) }; };

  await t("F1 три снимки от чата → един PDF (3 стр.) при клиента: документ, папка „Тед“, активност, кратък линк", async () => {
    const env = makeCtx(), cid = env.addClient("Рамадан Ахмед", 7);
    const files = [
      { path: env.put("ted-chat/2026-11/a.jpg", jpg(64, 40, [200, 180, 150])), name: "лк-лице.jpg", mime: "image/jpeg" },
      { path: env.put("ted-chat/2026-11/b.jpg", jpg(64, 40, [150, 180, 200])), name: "лк-гръб.jpg", mime: "image/jpeg" },
      { path: env.put("ted-chat/2026-11/c.jpg", png(40, 64, [240, 240, 230])), name: "акт.jpg", mime: "image/jpeg" } /* PNG с име и mime на JPEG – както идва от телефон */
    ];
    const r = await call(env, "files.to_pdf", { files, title: "Документи – Рамадан", client_name: "рамадан" });
    assert.strictEqual(r.created, true); assert.strictEqual(r.pages, 3); assert.strictEqual(r.skipped.length, 0);
    assert.strictEqual(r.name, "Документи – Рамадан.pdf"); assert.deepStrictEqual(r.client, { id: cid, name: "Рамадан Ахмед" });
    assert.ok(/^https:\/\/imotinadezhda\.bg\/f\/[a-z0-9]+\.pdf\?k=/.test(r.download_url), "линк: " + r.download_url);
    assert.ok(r.path.startsWith("clients/" + cid + "/ted/") && /^[\x20-\x7e]+$/.test(r.path), "път: " + r.path);
    assert.strictEqual(await pages(env.files.get(r.path)), 3);
    const doc = env.tbl("nd_documents").find((d) => d.id === r.document_id);
    assert.ok(doc && doc.data.client_id === cid && doc.data.folder === "Тед" && doc.data.mime === "application/pdf" && doc.data.by === "ted");
    assert.ok(env.tbl("nd_activities").some((a) => a.data.client_id === cid && /PDF/.test(a.data.text)));
    assert.deepStrictEqual(r.files[0].parts.map((p) => p.name), ["лк-лице.jpg", "лк-гръб.jpg", "акт.jpg"], "редът се пази");
  });

  await t("F2 без клиент → PDF в папка „Тед“ и ясна бележка; с имот → влиза в документите на имота", async () => {
    const env = makeCtx(), pid = env.addProp("ND-101", "Двустаен, Център");
    const f = [{ path: env.put("ted-chat/2026-11/a.jpg", jpg(50, 50, [9, 9, 9])), name: "a.jpg", mime: "image/jpeg" }];
    const r1 = await call(env, "files.to_pdf", { files: f });
    assert.strictEqual(r1.client, null); assert.ok(/без клиент/.test(r1.saved_to)); assert.ok(r1.path.startsWith("ted/")); assert.strictEqual(await pages(env.files.get(r1.path)), 1);
    const r2 = await call(env, "files.to_pdf", { files: f, property_code: "nd-101", title: "Скица" });
    assert.strictEqual(r2.property.id, pid);
    const prop = env.tbl("nd_properties").find((p) => p.id === pid);
    assert.strictEqual(prop.data.docs.length, 1); assert.strictEqual(prop.data.docs[0].name, "Скица.pdf"); assert.strictEqual(prop.data.code, "ND-101", "останалите полета на имота са непокътнати");
  });

  await t("F3 несъществуващ клиент → грешка с името; няколко съвпадения → списък за избор; нищо не се записва", async () => {
    const env = makeCtx(); env.addClient("Иван Петров", 1); env.addClient("Иван Петков", 2);
    const f = [{ path: env.put("ted-chat/2026-11/a.jpg", jpg(50, 50, [9, 9, 9])), name: "a.jpg" }];
    await fails(call(env, "files.to_pdf", { files: f, client_name: "Георги" }), /Няма клиент с име „Георги“/, "няма клиент");
    const e = await fails(call(env, "files.to_pdf", { files: f, client_name: "Иван" }), /Няколко клиенти/, "няколко");
    assert.ok(/К#1 Иван Петров/.test(e.message) && /К#2 Иван Петков/.test(e.message));
    assert.strictEqual(env.tbl("nd_documents").length, 0);
  });

  await t("F4 неподдържан формат (webp) и липсващ файл се пропускат с причина; останалите стават PDF; всички негодни → грешка", async () => {
    const env = makeCtx(), cid = env.addClient("Мария Колева");
    const ok = { path: env.put("ted-chat/2026-11/a.jpg", jpg(50, 50, [9, 9, 9])), name: "a.jpg" };
    const wp = { path: env.put("ted-chat/2026-11/w.webp", webp()), name: "w.webp", mime: "image/webp" };
    const r = await call(env, "files.to_pdf", { files: [ok, wp, { path: "ted-chat/2026-11/missing.jpg", name: "няма.jpg" }], client_id: cid });
    assert.strictEqual(r.pages, 1); assert.strictEqual(r.skipped.length, 2);
    assert.ok(r.skipped.some((s) => s.name === "w.webp" && /JPG или PNG/.test(s.reason)) && r.skipped.some((s) => s.name === "няма.jpg"));
    await fails(call(env, "files.to_pdf", { files: [wp] }), /PDF не се получи|Нито един файл/, "само webp");
    await fails(call(env, "files.to_pdf", {}), /Подай files/, "без файлове");
    await fails(call(env, "files.to_pdf", { files: [{ path: "../../etc/passwd" }] }), /Нито един файл/, "опасен път");
  });

  await t("F5 снимка + PDF от чата → един PDF с всички страници (PDF страниците се копират)", async () => {
    const env = makeCtx();
    const r = await call(env, "files.to_pdf", { paths: [env.put("ted-chat/2026-11/a.jpg", jpg(50, 50, [9, 9, 9])), env.put("ted-chat/2026-11/d.pdf", await pdfOf(4))], title: "Пакет" });
    assert.strictEqual(r.pages, 5); assert.strictEqual(await pages(env.files.get(r.path)), 5);
  });

  await t("F6 files.attach: снимка от чата → документ на клиента; повторно → без дубликат; после files.to_pdf с doc_ids → PDF при същия клиент", async () => {
    const env = makeCtx(), cid = env.addClient("Петър Димов");
    const p1 = env.put("ted-chat/2026-11/a.jpg", jpg(50, 50, [9, 9, 9])), p2 = env.put("ted-chat/2026-11/b.jpg", jpg(50, 50, [99, 9, 9]));
    const a1 = await call(env, "files.attach", { path: p1, name: "снимка 1.jpg", mime: "image/jpeg", client_name: "Петър" });
    const a2 = await call(env, "documents.attach", { path: p2, name: "снимка 2.jpg", mime: "image/jpeg", client_id: cid });
    assert.ok(a1.attached && a1.client.document_id && !a1.client.already && a2.client.document_id);
    assert.ok(env.files.has(a1.client.path) && a1.client.path.startsWith("clients/" + cid + "/chat/"));
    const again = await call(env, "files.attach", { path: p1, name: "снимка 1.jpg", client_id: cid });
    assert.strictEqual(again.client.already, true); assert.strictEqual(env.tbl("nd_documents").length, 2);
    const r = await call(env, "files.to_pdf", { doc_ids: [a1.client.document_id, a2.client.document_id], title: "Снимки" });
    assert.strictEqual(r.pages, 2); assert.strictEqual(r.client.id, cid, "PDF-ът отива при клиента на документите");
  });

  await t("F7 documents.merge: старият път (само doc_ids) работи както досега; с файлове от чата също обединява", async () => {
    const env = makeCtx(), cid = env.addClient("Анна Тодорова");
    const mk = async (name, buf, mime) => { const p = env.put("clients/" + cid + "/x/" + name, buf); const { data } = await env.ctx.sb.from("nd_documents").upsert({ data: { client_id: cid, client: "Анна Тодорова", name, path: p, mime } }).select().single(); return data.id; };
    const d1 = await mk("a.pdf", await pdfOf(2), "application/pdf"), d2 = await mk("b.jpg", jpg(40, 40, [1, 2, 3]), "image/jpeg");
    const r = await call(env, "documents.merge", { doc_ids: [d1, d2], title: "Обединени", client_id: cid });
    assert.strictEqual(r.pages, 3); assert.strictEqual(r.name, "Обединени.pdf"); assert.ok(r.document_id && r.download_url); assert.deepStrictEqual(r.parts.map((p) => p.pages), [2, 1]);
    const r2 = await call(env, "documents.merge", { doc_ids: [d1], files: [{ path: env.put("ted-chat/2026-11/n.jpg", jpg(40, 40, [5, 5, 5])), name: "нова.jpg" }], client_id: cid, title: "Смесен" });
    assert.strictEqual(r2.pages, 3); assert.strictEqual(r2.client.id, cid);
    await fails(call(env, "documents.merge", {}), /Подай files/, "merge без нищо");
  });

  await t("F8 превод на файл от чата (path) → PDF „Превод – …“ в папка „Преводи“ при посочения клиент; заявката към AI носи самия файл", async () => {
    const env = makeCtx(), cid = env.addClient("Ханс Мюлер");
    gemCalls.length = 0; gemImpl = async () => JSON.stringify({ source_language: "de", source_language_bg: "немски", pages: [{ n: 1, text: "Банково извлечение\nСалдо: 1 250,00 EUR\nIBAN: DE89 3704 0044 0532 0130 00" }] });
    const p = env.put("ted-chat/2026-11/k.jpg", jpg(60, 80, [250, 250, 250]));
    const r = await call(env, "documents.translate", { path: p, name: "Kontoauszug.jpg", mime: "image/jpeg", client_name: "Мюлер" });
    assert.strictEqual(r.name, "Превод – Kontoauszug.pdf"); assert.strictEqual(r.source_language, "de"); assert.strictEqual(r.translated_pages, 1); assert.strictEqual(r.client.id, cid);
    assert.ok(await pages(env.files.get(r.path)) >= 1);
    const doc = env.tbl("nd_documents").find((d) => d.id === r.document_id); assert.ok(doc.data.folder === "Преводи" && doc.data.client_id === cid);
    assert.strictEqual(gemCalls.length, 1); assert.strictEqual(gemCalls[0].parts[0].inline_data.mime_type, "image/jpeg"); assert.ok(/български/.test(gemCalls[0].parts[1].text));
    const r2 = await call(env, "documents.translate", { path: p, name: "Kontoauszug.jpg", append_original: true, target: "en" });
    assert.ok(/английски/.test(gemCalls[1].parts[1].text)); assert.strictEqual(r2.pages, r2.translated_pages + 1, "оригиналът е добавен след превода"); assert.strictEqual(r2.client, null);
  });

  await t("F9 превод на документ от CRM (doc_id) работи както досега; без източник → ясна грешка; AI без страници → грешка, без запис", async () => {
    const env = makeCtx(), cid = env.addClient("Ханс Мюлер");
    const p = env.put("clients/" + cid + "/x/v.pdf", await pdfOf(2)); const { data } = await env.ctx.sb.from("nd_documents").upsert({ data: { client_id: cid, client: "Ханс Мюлер", name: "Vertrag.pdf", path: p, mime: "application/pdf" } }).select().single();
    gemCalls.length = 0; gemImpl = async () => JSON.stringify({ source_language: "de", pages: [{ n: 1, text: "Договор" }, { n: 2, text: "Подписи" }] });
    const r = await call(env, "documents.translate", { doc_id: data.id });
    assert.strictEqual(r.name, "Превод – Vertrag.pdf"); assert.strictEqual(r.translated_pages, 2); assert.strictEqual(r.client.id, cid); assert.strictEqual(gemCalls[0].parts[0].inline_data.mime_type, "application/pdf");
    await fails(call(env, "documents.translate", {}), /Подай doc_id/, "без източник");
    const before = env.tbl("nd_documents").length; gemImpl = async () => JSON.stringify({ pages: [] });
    await fails(call(env, "documents.translate", { doc_id: data.id }), /не върна страници/, "празен превод"); assert.strictEqual(env.tbl("nd_documents").length, before);
  });

  await t("F10 групиране по вид: 5 снимки → отделен PDF за всеки вид документ, с името на клиента; при отказ на AI → „Други“", async () => {
    const env = makeCtx(), cid = env.addClient("Рамадан Ахмед");
    const mk = (n, c) => ({ path: env.put("ted-chat/2026-11/" + n, jpg(40, 40, c)), name: n, mime: "image/jpeg" });
    const files = [mk("lk1.jpg", [1, 1, 1]), mk("akt1.jpg", [2, 2, 2]), mk("lk2.jpg", [3, 3, 3]), mk("akt2.jpg", [4, 4, 4]), mk("x.jpg", [5, 5, 5])];
    gemImpl = async (o) => { const n = /Име на файла: (\S+?)\./.exec(o.parts[1].text)[1]; if (n === "x") throw new Error("лимит"); return JSON.stringify({ type: /^lk/.test(n) ? "лична карта" : "нотариален акт", language: "bg" }); };
    const r = await call(env, "files.to_pdf", { files, group_by_type: true, client_id: cid });
    assert.strictEqual(r.count, 3);
    const by = Object.fromEntries(r.files.map((f) => [f.name, f.pages]));
    assert.deepStrictEqual(by, { "Лична карта – Рамадан Ахмед.pdf": 2, "Нотариален акт – Рамадан Ахмед.pdf": 2, "Други – Рамадан Ахмед.pdf": 1 });
    assert.strictEqual(env.tbl("nd_documents").filter((d) => d.data.client_id === cid).length, 3);
    for (const f of r.files) assert.strictEqual(await pages(env.files.get(f.path)), f.pages);
  });

  await t("F11 агентът греши формата: files като низове, doc_ids с обекти, path в doc_ids, подписан адрес вместо path – пак работи", async () => {
    const env = makeCtx(), cid = env.addClient("Мария Колева");
    const p1 = env.put("ted-chat/2026-11/a.jpg", jpg(40, 40, [1, 1, 1])), p2 = env.put("ted-chat/2026-11/b.jpg", jpg(40, 40, [2, 2, 2]));
    const a = await call(env, "files.attach", { path: p1, name: "a.jpg", client_id: cid });
    const r = await call(env, "files.to_pdf", { files: [p1, "nd-files/" + p2], doc_ids: [{ id: a.client.document_id }], client_id: cid });
    assert.strictEqual(r.pages, 3);
    const r2 = await call(env, "documents.merge", { doc_ids: [p1, p2], client_id: cid });
    assert.strictEqual(r2.pages, 2);
    const r3 = await call(env, "files.to_pdf", { files: [{ url: "https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files/" + p1 + "?token=abc" }, { path: p1 }] });
    assert.strictEqual(r3.pages, 1, "един и същ файл не се дублира");
  });

  await t("F12 умението е в регистъра на /api/tools и в описанието за чата на сайта", async () => {
    const m = API.tools["files.to_pdf"]; assert.ok(m && /ЕДИН PDF/.test(m.description) && /ATTACHMENTS/.test(m.description));
    assert.ok(/files\.to_pdf/.test(TED.SPEC) && /path от ATTACHMENTS/.test(API.tools["documents.translate"].description) && /files \[\{path,name,mime\}\]/.test(API.tools["documents.merge"].description));
  });

  const pass = results.filter((r) => r[0] === "PASS").length;
  results.forEach((r) => console.log(r[0] + "  " + r[1] + (r[2] ? "\n      → " + r[2] : "")));
  console.log("\nРЕЗУЛТАТ: " + pass + "/" + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
