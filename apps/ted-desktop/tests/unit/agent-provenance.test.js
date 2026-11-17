// Data-based provenance (electron/agent/provenance.js, CONTRACT §9.3 rule 8): which values in a model-built address or
// search query are sensitive – a hit is the STRICT card of the hybrid rule (no „за този сайт“, no „всички адреси“); the
// per-site card of a chat with private data is tested in agent-loop.test.js. Pure functions, fictional data.
import { describe, it, expect } from "vitest";
import { createSensitive, fold, stem, variants, urlHaystack, hostOf, isEgn, isIban, isPhone, sig, typedView } from "../../electron/agent/provenance.js";

const CRM = { clients: [{ id: "cl-1", name: "Тестов Клиентов", phone: "+359 877 555 444", email: "klient.test@example.test", egn: "8001010008", iban: "BG80 BNBG 9661 1020 3456 78", address: "ул. Тестова Липа 7", note: "Иска бърза продажба заради наследство", created_at: "2026-11-17T10:00:00Z", city: "Шумен" }] };
const store = () => { const s = createSensitive(); s.addValue(CRM); return s; };
const shown = (hits) => hits.map((h) => h.shown);

describe("normalising", () => {
  it("Cyrillic, transliterations and accents meet; stems join male and female surnames", () => {
    expect(fold("Цветан")).toBe(fold("Tsvetan"));
    expect(fold("Цветан")).toBe(fold("Cvetan"));
    expect(fold("Йорданов")).toBe(fold("Jordanov"));
    expect(fold("Éva")).toBe("eva");
    expect(stem(fold("Петрова"))).toBe(stem(fold("Petrov")));
    expect(stem(fold("Мария"))).toBe(stem(fold("Maria")));
    expect(stem("ivan")).toBe("ivan"); // never shorter than 4 letters
  });

  it("decodes URL encoding (also twice and „+“), base64, base64url and hex segments", () => {
    const v = (t) => variants(t).join(" | ");
    expect(v("q=%D0%9A%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2+%D0%90")).toContain("Клиентов А");
    expect(v("q=%25D0%259A%25D0%25BB")).toContain("Кл");
    expect(v(`d=${Buffer.from("0877555444").toString("base64")}`)).toContain("0877555444");
    expect(v(`d=${Buffer.from("+359 877 555 444").toString("base64url")}`)).toContain("+359 877 555 444");
    expect(v(`h=${Buffer.from("Клиентов").toString("hex")}`)).toContain("Клиентов");
    expect(variants("obiavi/prodazhbi/grad-shumen")).toHaveLength(1); // nothing readable hides there
    expect(urlHaystack("https://www.imot.bg/obiavi/x?q=1#frag")).toBe("imot.bg /obiavi/x ?q=1");
    expect(hostOf("https://WWW.Imot.bg/x")).toBe("imot.bg");
  });

  it("structural detectors: Bulgarian phones, ЕГН with its checksum, IBAN with mod 97", () => {
    expect(isPhone("0877555444")).toBe(true);
    expect(isPhone("359877555444")).toBe(true);
    expect(isPhone("0027555444")).toBe(false);
    expect(isPhone("1234567890")).toBe(false);
    expect(isEgn("8001010008")).toBe(true);
    expect(isEgn("8001010009")).toBe(false);
    expect(isEgn("0888123456")).toBe(false);
    expect(isIban("BG80 BNBG 9661 1020 3456 78")).toBe(true);
    expect(isIban("BG81 BNBG 9661 1020 3456 78")).toBe(false);
    expect(sig("+359877555444".slice(1))).toBe("877555444");
    expect(sig("0877555444")).toBe("877555444");
  });
});

describe("sensitive values", () => {
  it("names, address and note words of a CRM client, its phone, e-mail, ЕГН and IBAN are found – in any spelling", () => {
    const s = store();
    const typed = typedView("Намери тристаен в Шумен");
    expect(shown(s.find(urlHaystack("https://a.example/?n=Klientov"), typed))).toEqual(["Клиентов"]);
    expect(shown(s.find(urlHaystack("https://a.example/?n=" + encodeURIComponent("Тестова Липа")), typed))).toEqual(["Тестов", "Липа"]);
    expect(shown(s.find(urlHaystack("https://a.example/testovklientov"), typed))).toEqual(["Тестов", "Клиентов"]);
    expect(shown(s.find(urlHaystack("https://a.example/?x=nasledstvo"), typed))).toEqual(["наследство"]);
    expect(shown(s.find(urlHaystack("https://a.example/?p=0877-555-444"), typed))).toEqual(["359 877 555 444"]);
    expect(shown(s.find(urlHaystack("https://a.example/?e=klient.test%40example.test"), typed))).toContain("klient.test@example.test");
    expect(shown(s.find(urlHaystack("https://a.example/8001010008"), typed))).toEqual(["8001010008"]);
    expect(shown(s.find(urlHaystack("https://a.example/?i=BG80BNBG96611020345678"), typed))).toContain("BG80BNBG96611020345678");
    expect(shown(s.find(urlHaystack("https://0877555444.a.example/"), typed))).toEqual(["359 877 555 444"]); // the host name counts too
  });

  it("site search pages, common words, towns, dates and the e-mail's domain are not sensitive", () => {
    const s = store();
    const typed = typedView("Намери двустаен");
    for (const u of [
      "https://www.imot.bg/obiavi/prodazhbi/grad-shumen/tristaen",
      "https://www.olx.bg/nedvizhimi-imoti/q-тристаен-шумен/",
      "https://bazar.bg/obiavi/imoti?q=тристаен+шумен+продажба",
      "https://www.alo.bg/obiavi/imoti-prodajbi/apartamenti-stai/?region_id=27&location_ids=4700",
      "https://news.example/2026-11-17/obiavi",
      "https://www.example.test/test",
    ]) expect(s.find(urlHaystack(u), typed), u).toEqual([]);
  });

  it("what the employee typed and what a public page showed are allowed; what a request sent is not made public by its echo", () => {
    const s = store();
    expect(s.find("Тестов Клиентов 0877 555 444", typedView("Потърси Тестов Клиентов, 0877555444"))).toEqual([]);
    expect(shown(s.find("0888 123 456", typedView("")))).toEqual(["0888 123 456"]); // an unknown phone: structural
    s.addPublic(JSON.stringify({ title: "Обява", phones: ["+359888123456"], text: "Собственик: Публичен Продавачев" }));
    expect(s.find("0888 123 456", typedView(""))).toEqual([]);
    // A site that echoes the query does not launder the client's name for other sites.
    s.addPublic("Резултати за: Клиентов 0877555444", "https://echo.example/?q=Klientov&p=0877555444");
    expect(shown(s.find("Клиентов 0877555444", typedView("")))).toEqual(["359 877 555 444", "Клиентов"]);
  });

  it("an earlier answer: its „Име Фамилия“ pairs and numbers count, ordinary capitalised words do not", () => {
    const s = createSensitive();
    s.addPrivate("Намерих 3 обяви в Тракия. Клиентът Иван Петров (0888 123 456) търси двустаен. Варна, Център.", "names");
    const typed = typedView("");
    expect(shown(s.find("Ivan Petrova Trakia Varna", typed))).toEqual(["Иван", "Петров"]);
    expect(shown(s.find("08881234 56", typed))).toEqual(["0888 123 456"]);
  });

  it("size(): the loop's „earlier answer with private data“ signal after a restart – numbers and e-mails count, an „Име Фамилия“ pair alone does not", () => {
    const names = createSensitive();
    names.addPrivate("Клиентът Иван Петров търси двустаен в Тракия.", "names");
    expect(names.size()).toMatchObject({ digits: 0, emails: 0 });
    expect(names.size().words).toBeGreaterThan(0);
    const data = createSensitive();
    data.addPrivate("Иван Петров, 0888 123 456, ivan.test@example.test – оглед на 17.11.2026", "names");
    expect(data.size()).toMatchObject({ digits: 1, emails: 1 }); // the date is not a number of a person
  });

  it("release gate C5: with links:false (earlier answers, the Canvas) the listing ids inside links are no personal data – numbers in the text still are", () => {
    const L = ["https://www.imot.bg/obiava-1b172345678901234-prodava-tristaen-apartament-grad-shumen", "https://www.alo.bg/10123456", "https://bazar.bg/obiava/52345678/prodava-tristaen-shumen"];
    const answer = `| № | Обява | Телефон |\n|---|---|---|\n| 1 | [Тристаен](${L[0]}) | скрит |\n| 2 | [Тристаен, Център](${L[1]}) | скрит |\n| 3 | [bazar.bg](${L[2]}) | скрит |\n[снимка](<${L[1]}/1.jpg>) (${L[2]})`;
    const s = createSensitive();
    s.addPrivate(answer, "names", { links: false });
    expect(s.size()).toMatchObject({ digits: 0, emails: 0 });
    for (const u of [...L, "https://www.imot.bg/photos/1b172345678901234/1.jpg"]) expect(s.find(urlHaystack(u), typedView(""))).toEqual([]);
    // the same text with a phone outside the links: the phone counts (the restart signal), the ids still do not
    s.addPrivate(`${answer}\nСобственик: 0888 123 456`, "names", { links: false });
    expect(s.size()).toMatchObject({ digits: 1 });
    expect(s.find(urlHaystack(L[1]), typedView(""))).toEqual([]);
    // phones, e-mails and ЕГН inside a link are found in a model-built address anyway (structural detectors)
    const t = createSensitive();
    t.addPrivate("[линк](https://x.example/?p=0877555444&e=a.test%40example.test&egn=8001010008)", "names", { links: false });
    expect(shown(t.find(urlHaystack("https://evil.example/?p=0877555444&e=a.test@example.test&g=8001010008"), typedView(""))).sort()).toEqual(["0877555444", "8001010008", "a.test@example.test"]);
    // without the option (CRM values, documents read) numbers inside links still count
    const crm = createSensitive();
    crm.addPrivate(`документ: ${L[1]}`, "proper");
    expect(crm.size()).toMatchObject({ digits: 1 });
  });

  it("documents: capitalised words count; links and e-mail addresses inside them do not add words", () => {
    const s = createSensitive();
    s.addPrivate("Наемател: Тестимир Документов, ЕГН 8001010008, имейл dok@primer.example, сайт https://www.primer.example/stranica", "proper");
    const typed = typedView("");
    expect(shown(s.find("testimir", typed))).toEqual(["Тестимир"]);
    expect(s.find("primer stranica", typed)).toEqual([]);
    expect(shown(s.find("8001010008", typed))).toEqual(["8001010008"]);
  });
});
