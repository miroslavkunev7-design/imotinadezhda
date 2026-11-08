/* Договори: pick a contract type, a client and a property, fill the few missing details, and get a finished
   printable contract. Everything comes from the database; the contract is saved to the client's documents. */
(function () {
  "use strict";
  var IS_NODE = typeof window === "undefined";
  var U = IS_NODE ? { esc: function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }, money: function (n) { return new Intl.NumberFormat("bg-BG").format(Math.round(Number(n) || 0)); }, ic: function () { return ""; } } : window.NDUI;
  var D = IS_NODE ? null : window.ND, esc = U.esc, fld = U.fld, G = U.group, money = U.money;
  var AGENCY = { name: "„НЕДВИЖИМИ ИМОТИ НАДЕЖДА“", short: "Недвижими Имоти Надежда", city: "гр. Шумен", phone: "0898 977 370", rep: "Мирослав Кънев", email: "kuneto77@abv.bg" };
  var TYPES = [
    ["pre", "Предварителен договор за покупко-продажба", "file-pen"],
    ["broker-seller", "Договор за посредничество – продавач", "handshake"],
    ["broker-buyer", "Договор за посредничество – купувач", "handshake"],
    ["rent", "Договор за наем", "key-round"],
    ["deposit", "Разписка за капаро (депозит)", "coins"],
    ["viewing", "Протокол за оглед", "eye"],
    ["power", "Пълномощно за продажба", "shield"]
  ];
  function bgDate(s) { if (!s) return "……………"; var p = String(s).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] + " г." : s; }
  function words(n) { /* euro amount in words (Bulgarian) */
    n = Math.round(Number(n) || 0); if (!n) return "нула";
    var u = ["", "един", "два", "три", "четири", "пет", "шест", "седем", "осем", "девет", "десет", "единадесет", "дванадесет", "тринадесет", "четиринадесет", "петнадесет", "шестнадесет", "седемнадесет", "осемнадесет", "деветнадесет"],
      t = ["", "", "двадесет", "тридесет", "четиридесет", "петдесет", "шестдесет", "седемдесет", "осемдесет", "деветдесет"],
      h = ["", "сто", "двеста", "триста", "четиристотин", "петстотин", "шестстотин", "седемстотин", "осемстотин", "деветстотин"];
    function below1000(x, fem) { var r = []; if (x >= 100) { r.push(h[Math.floor(x / 100)]); x %= 100; } if (x >= 20) { r.push(t[Math.floor(x / 10)]); x %= 10; if (x) r.push("и " + (fem && x === 1 ? "една" : fem && x === 2 ? "две" : u[x])); } else if (x) { if (r.length) r.push("и " + (fem && x === 1 ? "една" : fem && x === 2 ? "две" : u[x])); else r.push(fem && x === 1 ? "една" : fem && x === 2 ? "две" : u[x]); } return r.join(" "); }
    var out = [], m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (m) out.push(m === 1 ? "един милион" : below1000(m) + " милиона");
    if (k) out.push(k === 1 ? "хиляда" : below1000(k, true) + " хиляди");
    if (r) out.push((out.length ? "и " : "") + below1000(r));
    return out.join(" ").replace(/ и и /g, " и ");
  }
  function party(o, label) {
    return "<p><b>" + label + ":</b> " + esc(o.name || "………………………………") + (o.egn ? ", ЕГН " + esc(o.egn) : ", ЕГН ……………") + (o.addr ? ", с адрес: " + esc(o.addr) : ", с адрес: ………………………") + (o.phone ? ", тел. " + esc(o.phone) : "") + "</p>";
  }
  function propDesc(p) {
    if (!p) return "недвижим имот: ………………………………………………";
    var parts = [p.type || "имот", p.area ? "с площ " + p.area + " кв.м." : "", p.floor ? "на етаж " + p.floor : "", p.rooms ? p.rooms + " стаи" : ""].filter(Boolean).join(", ");
    var where = [p.address ? "адрес: " + p.address : "", p.city ? "гр./с. " + p.city : "", p.hood ? "кв. " + p.hood : ""].filter(Boolean).join(", ");
    return parts + (where ? ", находящ се в " + where : "") + (p.code ? " (обява № " + p.code + ")" : "");
  }
  function sign(a, b) { return '<div class="sg"><div><div class="ln"></div>' + a + "</div><div><div class=\"ln\"></div>" + b + "</div></div>"; }
  function head(title, f) { return "<h1>" + title + "</h1><p class=\"c\">Днес, " + bgDate(f.date) + ", в " + esc(f.place || AGENCY.city) + ", между:</p>"; }
  var agencyParty = "<p><b>ПОСРЕДНИК:</b> " + AGENCY.name + ", представлявано от " + AGENCY.rep + ", " + AGENCY.city + ", тел. " + AGENCY.phone + "</p>";

  var T = {
    pre: function (f, c, s, p) {
      var dep = Number(f.deposit) || 0, price = Number(f.price) || 0;
      return head("ПРЕДВАРИТЕЛЕН ДОГОВОР ЗА ПОКУПКО-ПРОДАЖБА НА НЕДВИЖИМ ИМОТ", f) + party(s, "ПРОДАВАЧ") + "<p class=\"c\">и</p>" + party(c, "КУПУВАЧ") +
        "<p>се сключи настоящият предварителен договор на основание чл. 19 от ЗЗД, при следните условия:</p>" +
        "<h2>I. Предмет</h2><p>1. Продавачът се задължава да прехвърли на Купувача правото на собственост върху следния недвижим имот: <b>" + propDesc(p) + "</b>, заедно с всички подобрения и принадлежности, а Купувачът се задължава да заплати уговорената цена.</p>" +
        "<h2>II. Цена и плащане</h2><p>2. Продажната цена е <b>" + money(price) + " € (" + words(price) + " евро)</b>.</p>" +
        "<p>3. При подписване на настоящия договор Купувачът заплаща капаро (задатък) в размер на <b>" + money(dep) + " € (" + words(dep) + " евро)</b>, което се приспада от цената.</p>" +
        "<p>4. Остатъкът от <b>" + money(Math.max(0, price - dep)) + " €</b> се заплаща в деня на подписване на окончателния договор във формата на нотариален акт" + (f.payment ? ", " + esc(f.payment) : "") + ".</p>" +
        "<h2>III. Срок</h2><p>5. Окончателният договор ще бъде сключен в срок до <b>" + bgDate(f.deadline) + "</b> пред нотариус" + (f.notary ? " " + esc(f.notary) : "") + ". Разноските по прехвърлянето (нотариални такси, местен данък, вписване) са за сметка на " + esc(f.costs || "Купувача") + ".</p>" +
        "<h2>IV. Задължения и отговорност</h2><p>6. Продавачът декларира, че имотът е негова собственост, не е обременен с тежести, възбрани и ипотеки" + (f.special ? ", с изключение на: " + esc(f.special) : "") + ", и няма да го продава или обременява до сключване на окончателния договор.</p>" +
        "<p>7. При неизпълнение по вина на Купувача, капарото остава за Продавача. При неизпълнение по вина на Продавача, той връща капарото в двоен размер. Изправната страна може да иска обявяване на договора за окончателен по реда на чл. 19, ал. 3 ЗЗД.</p>" +
        "<p>8. Продавачът предава владението на имота" + (f.handover ? " на " + bgDate(f.handover) : " в деня на нотариалното прехвърляне") + ", освободен от вещи и лица, с платени консумативи.</p>" +
        (f.extra ? "<h2>V. Други условия</h2><p>" + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        "<p>Настоящият договор се състави в " + (f.copies || 3) + " еднообразни екземпляра. Сделката се осъществява с посредничеството на " + AGENCY.short + ".</p>" +
        sign("ПРОДАВАЧ: " + esc(s.name || ""), "КУПУВАЧ: " + esc(c.name || ""));
    },
    "broker-seller": function (f, c, s, p) {
      return head("ДОГОВОР ЗА ПОСРЕДНИЧЕСТВО ПРИ ПРОДАЖБА НА НЕДВИЖИМ ИМОТ", f) + party(c, "ВЪЗЛОЖИТЕЛ (Продавач)") + "<p class=\"c\">и</p>" + agencyParty +
        "<h2>I. Предмет</h2><p>1. Възложителят възлага, а Посредникът приема да извършва посредническа дейност за продажба на: <b>" + propDesc(p) + "</b>, при желана цена <b>" + money(f.price) + " €</b>.</p>" +
        "<h2>II. Възнаграждение</h2><p>2. При сключване на сделка с купувач, намерен от Посредника, Възложителят дължи възнаграждение в размер на <b>" + esc(f.commission || "3") + " %</b> от продажната цена" + (f.minComm ? ", но не по-малко от " + money(f.minComm) + " €" : "") + ", платимо при подписване на предварителен договор или, ако такъв не се сключва, при нотариалното прехвърляне.</p>" +
        "<h2>III. Срок и условия</h2><p>3. Договорът се сключва за срок до <b>" + bgDate(f.deadline) + "</b>" + (f.exclusive === "1" ? " и е <b>ексклузивен</b> – Възложителят няма да предлага имота чрез други посредници и ще насочва всички запитвания към Посредника." : ".") + "</p>" +
        "<p>4. Посредникът рекламира имота за своя сметка, организира огледи, води преговори и съдейства за подготовката на документите. Възложителят предоставя достъп до имота и верни данни за него.</p>" +
        "<p>5. Ако в срок до 12 месеца след прекратяване на договора Възложителят сключи сделка с купувач, представен от Посредника, възнаграждението по т. 2 се дължи изцяло.</p>" +
        (f.extra ? "<h2>IV. Други условия</h2><p>" + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        sign("ВЪЗЛОЖИТЕЛ: " + esc(c.name || ""), "ПОСРЕДНИК: " + AGENCY.rep);
    },
    "broker-buyer": function (f, c, s, p) {
      return head("ДОГОВОР ЗА ПОСРЕДНИЧЕСТВО ПРИ ПОКУПКА НА НЕДВИЖИМ ИМОТ", f) + party(c, "ВЪЗЛОЖИТЕЛ (Купувач)") + "<p class=\"c\">и</p>" + agencyParty +
        "<h2>I. Предмет</h2><p>1. Възложителят възлага на Посредника да му съдейства при намиране и закупуване на недвижим имот" + (p ? ", включително: <b>" + propDesc(p) + "</b>" : "") + (c.budget ? ", с бюджет до <b>" + money(c.budget) + " €</b>" : "") + ".</p>" +
        "<h2>II. Възнаграждение</h2><p>2. При сключване на сделка за имот, представен от Посредника, Възложителят дължи възнаграждение <b>" + esc(f.commission || "3") + " %</b> от цената" + (f.minComm ? ", но не по-малко от " + money(f.minComm) + " €" : "") + ", платимо при подписване на предварителен договор.</p>" +
        "<h2>III. Условия</h2><p>3. Възложителят няма да сключва сделка за представен от Посредника имот директно със собственика или чрез трето лице, заобикаляйки Посредника; при нарушение дължи възнаграждението по т. 2 в двоен размер.</p>" +
        "<p>4. Договорът е със срок до <b>" + bgDate(f.deadline) + "</b>. Огледите се удостоверяват с протокол.</p>" +
        (f.extra ? "<h2>IV. Други условия</h2><p>" + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        sign("ВЪЗЛОЖИТЕЛ: " + esc(c.name || ""), "ПОСРЕДНИК: " + AGENCY.rep);
    },
    rent: function (f, c, s, p) {
      var rent = Number(f.price) || 0;
      return head("ДОГОВОР ЗА НАЕМ НА НЕДВИЖИМ ИМОТ", f) + party(s, "НАЕМОДАТЕЛ") + "<p class=\"c\">и</p>" + party(c, "НАЕМАТЕЛ") +
        "<h2>I. Предмет</h2><p>1. Наемодателят предоставя на Наемателя за временно и възмездно ползване: <b>" + propDesc(p) + "</b>, за жилищни нужди" + (f.furnished === "1" ? ", обзаведен съгласно приемо-предавателен протокол" : "") + ".</p>" +
        "<h2>II. Наемна цена и депозит</h2><p>2. Месечният наем е <b>" + money(rent) + " € (" + words(rent) + " евро)</b>, платим до " + esc(f.payday || "5") + "-то число на текущия месец" + (f.payment ? ", " + esc(f.payment) : "") + ". Консумативите (ток, вода, отопление, такси) са за сметка на Наемателя.</p>" +
        "<p>3. При подписване Наемателят внася гаранционен депозит в размер на <b>" + money(f.deposit || rent) + " €</b>, който се връща при прекратяване след приспадане на дължими суми и щети.</p>" +
        "<h2>III. Срок</h2><p>4. Договорът се сключва за срок от <b>" + esc(f.term || "12") + " месеца</b>, считано от <b>" + bgDate(f.handover || f.date) + "</b>" + (f.deadline ? " до " + bgDate(f.deadline) : "") + ". Всяка страна може да го прекрати с " + esc(f.notice || "1") + "-месечно писмено предизвестие.</p>" +
        "<h2>IV. Права и задължения</h2><p>5. Наемателят ползва имота с грижата на добър стопанин, не го преотдава и не променя предназначението му без писмено съгласие; дребните поправки са за негова сметка. Наемодателят осигурява спокойно ползване и поема основните ремонти.</p>" +
        (f.extra ? "<h2>V. Други условия</h2><p>" + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        "<p>Договорът се сключи с посредничеството на " + AGENCY.short + ".</p>" +
        sign("НАЕМОДАТЕЛ: " + esc(s.name || ""), "НАЕМАТЕЛ: " + esc(c.name || ""));
    },
    deposit: function (f, c, s, p) {
      var dep = Number(f.deposit) || 0;
      return "<h1>РАЗПИСКА ЗА КАПАРО</h1><p class=\"c\">" + bgDate(f.date) + ", " + esc(f.place || AGENCY.city) + "</p>" +
        "<p>Долуподписаният/ата <b>" + esc(s.name || "………………………") + "</b>" + (s.egn ? ", ЕГН " + esc(s.egn) : "") + ", в качеството си на продавач/собственик, удостоверявам, че получих от <b>" + esc(c.name || "………………………") + "</b>" + (c.egn ? ", ЕГН " + esc(c.egn) : "") + " сумата от <b>" + money(dep) + " € (" + words(dep) + " евро)</b>, представляваща капаро (задатък) за покупката на: <b>" + propDesc(p) + "</b>, при обща цена <b>" + money(f.price) + " €</b>.</p>" +
        "<p>Капарото се приспада от цената. При отказ на купувача капарото остава за продавача; при отказ на продавача той го връща в двоен размер. Окончателният договор ще се сключи до <b>" + bgDate(f.deadline) + "</b>.</p>" +
        (f.extra ? "<p>" + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        sign("ПОЛУЧИЛ: " + esc(s.name || ""), "ПРЕДАЛ: " + esc(c.name || "")) + "<p class=\"c\">Съставено в присъствието на " + AGENCY.short + ", " + AGENCY.rep + "</p>";
    },
    viewing: function (f, c, s, p) {
      return "<h1>ПРОТОКОЛ ЗА ОГЛЕД НА НЕДВИЖИМ ИМОТ</h1><p class=\"c\">" + bgDate(f.date) + ", " + esc(f.place || AGENCY.city) + "</p>" +
        "<p>Днес <b>" + esc(c.name || "………………………") + "</b>" + (c.phone ? ", тел. " + esc(c.phone) : "") + ", извърши оглед на: <b>" + propDesc(p) + "</b>" + (f.price ? ", обявен за " + money(f.price) + " €" : "") + ", организиран от " + AGENCY.short + ".</p>" +
        "<p>С подписа си потвърждавам, че имотът ми беше показан от Посредника, и се задължавам при интерес да водя преговорите и да сключа сделка само чрез него. Това важи и за членове на семейството ми и свързани лица. При заобикаляне на Посредника дължа възнаграждение в размер на <b>" + esc(f.commission || "3") + " %</b> от цената на имота.</p>" +
        (f.extra ? "<p>Бележки от огледа: " + esc(f.extra).replace(/\n/g, "<br>") + "</p>" : "") +
        sign("КЛИЕНТ: " + esc(c.name || ""), "БРОКЕР: " + AGENCY.rep);
    },
    power: function (f, c, s, p) {
      return "<h1>ПЪЛНОМОЩНО</h1>" +
        "<p>Долуподписаният/ата <b>" + esc(c.name || "………………………") + "</b>" + (c.egn ? ", ЕГН " + esc(c.egn) : ", ЕГН ……………") + (c.addr ? ", с адрес " + esc(c.addr) : "") + ",</p><p class=\"c\"><b>УПЪЛНОМОЩАВАМ</b></p>" +
        "<p><b>" + esc(f.attorney || "………………………") + "</b>" + (f.attorneyEgn ? ", ЕГН " + esc(f.attorneyEgn) : ", ЕГН ……………") + ", да ме представлява пред всички държавни, общински и съдебни органи, нотариуси, банки и трети лица във връзка с <b>продажбата</b> на собствения ми недвижим имот: <b>" + propDesc(p) + "</b>, като:</p>" +
        "<p>1. Договаря цена не по-ниска от <b>" + money(f.price) + " €</b> и условия по свое усмотрение; 2. Подписва предварителен и окончателен договор във формата на нотариален акт; 3. Получава продажната цена" + (f.iban ? " по банкова сметка IBAN " + esc(f.iban) : "") + "; 4. Снабдява се с всички необходими документи – скици, схеми, данъчни оценки, удостоверения за тежести, декларации; 5. Подава и получава документи, заплаща такси и данъци.</p>" +
        "<p>Пълномощното е валидно до <b>" + bgDate(f.deadline) + "</b>" + (f.extra ? ". " + esc(f.extra) : "") + ".</p>" +
        sign("УПЪЛНОМОЩИТЕЛ: " + esc(c.name || ""), "") + "<p class=\"c\">Подписът подлежи на нотариална заверка.</p>";
    }
  };
  var CSS = "body{margin:0;padding:34px 44px;font:15px/1.55 'Times New Roman',Georgia,serif;color:#111;background:#fff}h1{font-size:19px;text-align:center;margin:0 0 6px;letter-spacing:.5px}h2{font-size:15px;margin:16px 0 4px}p{margin:6px 0;text-align:justify}p.c{text-align:center}.sg{display:flex;gap:40px;margin-top:38px}.sg>div{flex:1;font-weight:700}.ln{border-top:1px solid #111;margin-bottom:6px;height:28px}.hd{display:flex;align-items:center;gap:14px;margin:0 0 18px;padding-bottom:10px;border-bottom:2px solid #7a0f22}.hd img{height:54px}.hd small{color:#7a0f22;font:700 12px Arial}@page{margin:18mm 16mm}@media print{body{padding:0}}";
  function docHtml(title, body) {
    return "<!doctype html><html lang=\"bg\"><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title><style>" + CSS + "</style></head><body>" +
      '<div class="hd"><img src="' + (IS_NODE ? 'https://imotinadezhda.bg' : location.origin) + '/mobile/crm/assets/logo.png" alt=""><small>' + AGENCY.name + " · " + AGENCY.city + " · тел. " + AGENCY.phone + "</small></div>" + body + "</body></html>";
  }
  function fields(kind, f) {
    var m = {
      pre: [["price", "Цена €", "number"], ["deposit", "Капаро €", "number"], ["deadline", "Нотариус до", "date"], ["handover", "Предаване на", "date"], ["notary", "Нотариус (име / район)"], ["payment", "Начин на плащане"], ["costs", "Разноски за сметка на"], ["special", "Тежести / особености"], ["copies", "Екземпляри", "number"]],
      "broker-seller": [["price", "Желана цена €", "number"], ["commission", "Комисионна %", "number"], ["minComm", "Минимум €", "number"], ["deadline", "Срок до", "date"], ["exclusive", "Ексклузив", "select", [["", "Не"], ["1", "Да"]]]],
      "broker-buyer": [["commission", "Комисионна %", "number"], ["minComm", "Минимум €", "number"], ["deadline", "Срок до", "date"]],
      rent: [["price", "Месечен наем €", "number"], ["deposit", "Депозит €", "number"], ["term", "Срок (месеци)", "number"], ["handover", "Начало", "date"], ["deadline", "Край", "date"], ["payday", "Плащане до (число)", "number"], ["notice", "Предизвестие (месеци)", "number"], ["payment", "Начин на плащане"], ["furnished", "Обзаведен", "select", [["", "Не"], ["1", "Да"]]]],
      deposit: [["price", "Цена €", "number"], ["deposit", "Капаро €", "number"], ["deadline", "Окончателен договор до", "date"]],
      viewing: [["price", "Обявена цена €", "number"], ["commission", "Комисионна %", "number"]],
      power: [["attorney", "Пълномощник – име"], ["attorneyEgn", "Пълномощник – ЕГН"], ["price", "Минимална цена €", "number"], ["iban", "IBAN"], ["deadline", "Валидно до", "date"]]
    }[kind] || [];
    return m.map(function (x) { return fld({ id: "ct-" + x[0], label: x[1], icon: x[2] === "date" ? "calendar" : x[2] === "number" ? "coins" : "pencil", type: x[2] === "select" ? "select" : x[2] || "text", value: f[x[0]], options: x[3] }); }).join("");
  }
  function open(opts) {
    opts = opts || {};
    var clients = [], props = [], ctx, kind = opts.kind || "pre", f = { date: new Date().toLocaleDateString("sv-SE"), place: AGENCY.city, commission: 3, copies: 3 }, lastHtml = "", lastTitle = "";
    function cid() { return ctx ? ctx.get("ct-client") : opts.client_id || ""; }
    function form() {
      var cl = clients.map(function (c) { return [c.id, (c.num ? "К#" + c.num + " · " : "") + c.name + (c.phone ? " · " + c.phone : "")]; });
      var pl = props.map(function (p) { return [p.id, (p.num ? "И#" + p.num + " · " : "") + (p.code || "") + " · " + (p.title || "") + (p.city ? ", " + p.city : "")]; });
      var needSeller = /pre|rent|deposit/.test(kind);
      return G("Договор", "file-pen", "nd/ph04.jpg",
          fld({ id: "ct-kind", label: "Вид договор", icon: "file-text", type: "select", value: kind, options: TYPES.map(function (t) { return [t[0], t[1]]; }), wide: true }) +
          fld({ id: "ct-client", label: kind === "rent" ? "Наемател" : kind === "viewing" || kind === "broker-buyer" ? "Клиент" : kind === "power" ? "Упълномощител" : kind === "broker-seller" ? "Възложител (собственик)" : "Купувач", icon: "user", type: "select", value: f.client_id || opts.client_id || "", options: [["", "— избери клиент —"]].concat(cl) }) +
          (needSeller ? fld({ id: "ct-seller", label: kind === "rent" ? "Наемодател" : "Продавач", icon: "user-round", type: "select", value: f.seller_id || "", options: [["", "— от имота (собственик) —"]].concat(cl) }) : "") +
          fld({ id: "ct-prop", label: "Имот", icon: "house", type: "select", value: f.prop_id || opts.prop_id || "", options: [["", "— без имот —"]].concat(pl) }) +
          fld({ id: "ct-date", label: "Дата", icon: "calendar", value: f.date, type: "date" }) + fld({ id: "ct-place", label: "Място", icon: "pin", value: f.place }), { lw: 170 }) +
        G("Условия", "coins", "nd/ph16.jpg", fields(kind, f) + fld({ id: "ct-extra", label: "Допълнителни условия", icon: "file-text", value: f.extra, type: "ta", wide: true }), { lw: 170 }) +
        '<div class="wide ct-acts"><button type="button" class="ct-btn" data-gen>' + U.ic("file-pen") + 'Генерирай договора</button><button type="button" class="ct-btn alt" data-print disabled>' + U.ic("printer") + 'Печат / PDF</button><button type="button" class="ct-btn alt" data-save disabled>' + U.ic("save") + 'Запази в документите на клиента</button></div>' +
        '<div class="wide ct-prev" id="ct-prev"><div class="ndempty">Изберете договор, клиент и имот и натиснете „Генерирай договора“. Данните се взимат от картите им.</div></div>';
    }
    function read() {
      var g = ctx.get; f.client_id = g("ct-client"); f.seller_id = ctx.q("ct-seller") ? g("ct-seller") : ""; f.prop_id = g("ct-prop"); f.date = g("ct-date"); f.place = g("ct-place"); f.extra = g("ct-extra");
      [].forEach.call(ctx.body.querySelectorAll("[id^=ct-]"), function (el) { var k = el.id.slice(3); if (["kind", "client", "seller", "prop", "date", "place", "extra"].indexOf(k) < 0) f[k] = el.value; });
    }
    function pick(id) { return clients.filter(function (c) { return c.id === id; })[0] || null; }
    function personOf(c) { return c ? { name: c.name, egn: c.egn, addr: c.address || c.addr || "", phone: c.phone } : {}; }
    function ownerOf(p) { if (!p) return {}; return { name: p.client || "", egn: p.ownerEgn || "", addr: p.ownerAddr || "", phone: p.ownerPhone || "" }; }
    function gen() {
      read();
      var c = personOf(pick(f.client_id)), p = props.filter(function (x) { return x.id === f.prop_id; })[0] || null, s = f.seller_id ? personOf(pick(f.seller_id)) : ownerOf(p);
      if (pick(f.client_id) && pick(f.client_id).budget) c.budget = pick(f.client_id).budget;
      if (!f.price && p && p.price) f.price = p.price;
      var t = TYPES.filter(function (x) { return x[0] === kind; })[0];
      lastTitle = t[1] + (c.name ? " – " + c.name : "") + (p && p.code ? " – " + p.code : "");
      lastHtml = docHtml(lastTitle, T[kind](f, c, s, p));
      var pv = ctx.q("ct-prev"); pv.innerHTML = '<iframe title="Преглед на договора" sandbox="allow-same-origin"></iframe>';
      var ifr = pv.querySelector("iframe"); ifr.srcdoc = lastHtml;
      ctx.body.querySelector("[data-print]").disabled = false; ctx.body.querySelector("[data-save]").disabled = !f.client_id;
      if (ctx.refit) setTimeout(ctx.refit, 60);
    }
    function print() { var w = window.open("", "_blank"); if (!w) { D.say("Разрешете изскачащите прозорци"); return; } w.document.open(); w.document.write(lastHtml.replace("</body>", "<script>setTimeout(function(){print()},300)<\/script></body>")); w.document.close(); }
    function save() {
      var c = pick(f.client_id); if (!c || !lastHtml) return;
      var name = lastTitle.replace(/[\\/:*?"<>|]+/g, "-") + ".html", file = new File([lastHtml], name, { type: "text/html" });
      var path = "clients/" + c.id + "/contracts/" + Date.now() + "-" + name.replace(/[^\w.\-а-яА-Я ]+/g, "_").slice(-70);
      D.upload(path, file).then(function () { return D.put("documents", { client_id: c.id, client: c.name, name: name, folder: "Договори", path: path, mime: "text/html", size: file.size, at: new Date().toISOString() }); })
        .then(function () { return D.put("activities", { client_id: c.id, client: c.name, icon: "file-pen", text: "Изготвен договор: " + lastTitle, at: new Date().toISOString() }); })
        .then(function () { D.say("Договорът е запазен при документите на " + c.name); }).catch(function (e) { D.say("Грешка: " + ((e && e.message) || e)); });
    }
    U.open({
      inline: opts.inline || null, title: "Договори", icon: "file-pen", photo: "nd/ph04.jpg", html: '<div class="wide ndempty">Зареждане…</div>', noSave: true, cancelText: "Затвори",
      ready: function (x) {
        ctx = x;
        D.ready().then(function () { return Promise.all([D.load("clients"), D.load("properties").catch(function () { return []; })]); }).then(function (r) { clients = r[0]; props = r[1] || []; x.rerender(form()); });
      },
      ready2: function () {
        var b = ctx.body;
        b.addEventListener("change", function (e) { if (e.target.id === "ct-kind") { read(); kind = e.target.value; ctx.rerender(form()); } if (e.target.id === "ct-prop") { var p = props.filter(function (x) { return x.id === e.target.value; })[0]; var pr = ctx.q("ct-price"); if (p && pr && !pr.value) pr.value = p.price || ""; } });
        b.addEventListener("click", function (e) { if (e.target.closest("[data-gen]")) gen(); else if (e.target.closest("[data-print]")) print(); else if (e.target.closest("[data-save]")) save(); });
      }
    });
  }
  var CT_CSS = ".ct-acts{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 18px}.ct-btn{display:inline-flex;align-items:center;gap:10px;height:56px;padding:0 22px;border-radius:18px;border:1.5px solid #edc47a;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;font:700 22px var(--cond);box-shadow:0 0 10px rgba(255,190,120,.5);cursor:pointer}.ct-btn svg.i{font-size:24px}.ct-btn.alt{background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;border-color:#e3b25e}.ct-btn[disabled]{opacity:.5;cursor:default}.ct-prev{margin:0 0 20px;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 0 0 1.5px rgba(227,178,94,.7),0 0 16px rgba(255,226,190,.8)}.ct-prev iframe{display:block;width:100%;height:900px;border:0;background:#fff;zoom:1.45}.ct-prev .ndempty{padding:30px}";

  /* server-side use (Тед): render(kind, fields, client, seller, property) -> {title, html} */
  function render(kind, f, c, s, p) {
    var t = TYPES.filter(function (x) { return x[0] === kind; })[0]; if (!t || !T[kind]) throw new Error("Непознат договор: " + kind);
    var cp = { name: c && c.name || "", egn: c && c.egn || "", addr: c && (c.address || c.addr) || "", phone: c && c.phone || "", budget: c && c.budget };
    var sp = s ? { name: s.name || "", egn: s.egn || "", addr: s.address || s.addr || "", phone: s.phone || "" } : (p ? { name: p.client || "", egn: p.ownerEgn || "", addr: p.ownerAddr || "", phone: p.ownerPhone || "" } : {});
    var title = t[1] + (cp.name ? " – " + cp.name : "") + (p && p.code ? " – " + p.code : "");
    return { title: title, html: docHtml(title, T[kind](f, cp, sp, p)) };
  }
  if (IS_NODE) { module.exports = { render: render, TYPES: TYPES }; return; }
  if (!document.getElementById("ct-css")) { var st = document.createElement("style"); st.id = "ct-css"; st.textContent = CT_CSS; document.head.appendChild(st); }
  window.NDContracts = { open: open, TYPES: TYPES, render: render };
})();
