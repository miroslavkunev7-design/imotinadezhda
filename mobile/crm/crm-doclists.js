/* Document checklists (glass rows like the bank module "Документи на имота"):
   - client: "Вид кредит" + "Доходи" -> the documents Bulgarian banks really ask for
   - property: base documents + "Специална ситуация" (наследство, съсобственост, ипотека…)
   Every row: status (Прикачен / Липсва), files, eye / download, expand -> files + upload.
   Files go to Storage (nd-files) and nd_documents (client_id or property_code, folder = row key). */
(function () {
  "use strict";
  var D = window.ND, U = window.NDUI;
  if (!D || !U) return;
  var esc = U.esc;
  var SV = {
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    dl: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
    up: '<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.8-1.6 5.2-1.6 6 0M14 10h4M14 13h3"/>',
    doc: '<path d="M14 3H6v18h12V7Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    scale: '<path d="M12 3v18M5 7h14M7 7l-3 7h6Zm10 0-3 7h6ZM8 21h8"/>',
    bank: '<path d="M3 10h18L12 4ZM5 10v8m4-8v8m6-8v8m4-8v8M3 21h18"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 17c3.3 0 6-1.3 6-3"/><ellipse cx="16" cy="15" rx="5" ry="2.5"/>',
    shield: '<path d="M12 3c3 2 5 2 8 2v7c0 4-4 7-8 9-4-2-8-5-8-9V5c3 0 5 0 8-2Z"/><path d="m8 12 3 3 5-5"/>',
    home: '<path d="M3 11 12 4l9 7M5 10v10h14V10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z"/><path d="M9 4v14M15 6v14"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9M17 5l2 2M15 7l2 2"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3Z"/>'
  };
  function sv(n, c) { return '<svg class="' + (c || "dli") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SV[n] || SV.doc) + "</svg>"; }
  var css =
    ".ndl{grid-column:1/-1;font-family:'Roboto Condensed',Arial,sans-serif;zoom:1.6;padding:0 6px}html.desk .ndl{zoom:1.15}html.desk .ndl .ndl-rows2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}" +
    ".ndl-f .dlf{flex:none;width:20px;height:20px;color:#7a0f22}" +
    ".ndl-sel{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 12px}" +
    ".ndl-sel label{display:block;font:700 13px/1.2 'Roboto Condensed',sans-serif;color:#6b0a1c;margin:0 0 4px 4px}" +
    ".ndl-sel .w{position:relative}.ndl-sel select{width:100%;height:46px;appearance:none;-webkit-appearance:none;border-radius:16px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffdfa,#fbefe5);padding:0 34px 0 14px;font:700 15px 'Roboto Condensed',sans-serif;color:#4e0912;box-shadow:0 0 10px rgba(255,214,150,.5)}" +
    ".ndl-sel .w svg{position:absolute;right:12px;top:14px;width:18px;height:18px;color:#7a0f22;pointer-events:none}" +
".ndl-top{flex-wrap:wrap}.ndl-send{background:linear-gradient(150deg,#fff0aa,#f3a518)!important;color:#640319!important}.ndl-add.alt{background:linear-gradient(180deg,#fffcf9,#fbefe5)!important;color:#6b0a1c!important;border-color:#e3b25e!important}" +
    ".ndl-snd{margin:0 0 12px;padding:10px 12px 12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,250,246,.98),rgba(251,236,224,.95));border:1.5px solid #e3b25e;box-shadow:0 0 14px rgba(255,214,150,.6)}" +
    ".ndl-snd label{display:block;font:700 13px 'Roboto Condensed',sans-serif;color:#6b0a1c;margin:8px 0 4px 2px}.ndl-snd select,.ndl-snd input[type=email],.ndl-snd input[type=text]{width:100%;box-sizing:border-box;height:42px;border-radius:14px;border:1.5px solid #e3b25e;background:#fffdfa;padding:0 12px;font:15px 'Roboto Condensed',sans-serif;color:#3a0c12}" +
    ".ndl-snd input[type=email]{margin-top:6px}.ndl-sg{margin:6px 0;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.8);border:1px solid rgba(227,178,94,.5);font:14px 'Roboto Condensed',sans-serif}.ndl-sg b{display:block;color:#7a0f22;margin-bottom:4px}" +
    ".ndl-ck{display:flex!important;align-items:center;gap:8px;font:400 14px 'Roboto Condensed',sans-serif!important;color:#2b1010!important;margin:3px 0!important}.ndl-ck input{accent-color:#7a0f22;width:18px;height:18px}" +
    ".ndl-sa{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ndl-sa .ndl-add{flex:1;justify-content:center}.ndl-note{display:block;margin-top:8px;font:12.5px/1.35 'Roboto Condensed',sans-serif;color:#6b4a40}" +
    ".ndl-top{display:flex;align-items:center;gap:10px;margin:0 0 10px}.ndl-top .sum{flex:1;font:700 14px 'Roboto Condensed',sans-serif;color:#6b0a1c}.ndl-top .sum b{color:#2f7a0d}" +
    ".ndl-bar{height:8px;border-radius:5px;background:rgba(227,178,94,.25);overflow:hidden;margin:0 0 12px}.ndl-bar i{display:block;height:100%;background:linear-gradient(90deg,#83b93b,#2f7a0d);border-radius:5px;transition:width .3s}" +
    ".ndl-add{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;border-radius:14px;border:1.5px solid #edc47a;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;font:700 14px 'Roboto Condensed',sans-serif;box-shadow:0 0 10px rgba(255,190,120,.5);cursor:pointer}.ndl-add svg{width:17px;height:17px}" +
    ".ndl-grp{font:700 15px/1 Georgia,serif;color:#7a0f22;margin:14px 4px 8px;display:flex;align-items:center;gap:8px}.ndl-grp:after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(227,178,94,.8),transparent)}" +
    ".ndl-row{position:relative;isolation:isolate;margin:0 0 8px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#fff7f0,#fbe9da);border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(226,176,120,.55),0 0 12px rgba(255,226,190,.7),0 4px 9px rgba(120,50,20,.18)}" +
    ".ndl-row:before{content:'';position:absolute;top:0;right:0;bottom:0;width:50%;z-index:-1;background:var(--ph) center/cover no-repeat;opacity:.82;filter:saturate(1.05);-webkit-mask-image:linear-gradient(270deg,#000 30%,rgba(0,0,0,.6) 62%,transparent 100%);mask-image:linear-gradient(270deg,#000 30%,rgba(0,0,0,.6) 62%,transparent 100%)}" +
    ".ndl-row{border-bottom-color:#d59c7a!important;box-shadow:0 0 0 1px rgba(226,176,120,.6),0 0 14px rgba(255,226,190,.8),0 4px 8px rgba(173,117,84,.3)!important}" +
    ".ndl-h{min-height:72px}.ndl-h .t{font-size:19px!important;text-shadow:0 0 6px #fff8f0,0 0 2px #fff8f0}.ndl-h .t small{text-shadow:0 0 5px #fff8f0}" +
    ".ndl-st{height:28px!important;padding:0 12px!important;font-size:14px!important;border-radius:14px!important;box-shadow:0 2px 3px rgba(80,30,10,.2)}" +
    ".ndl-h .ac button{width:40px!important;height:40px!important;box-shadow:0 0 10px rgba(255,214,150,.7),0 2px 4px rgba(120,50,20,.25)!important}" +
    ".ndl-h{display:grid;grid-template-columns:34px 1fr auto;gap:4px 10px;align-items:center;padding:10px 10px 10px 12px;cursor:pointer}" +
    ".ndl-h .ic{grid-row:1/3;width:34px;height:34px;color:#9c0016}.ndl-h .ic svg{width:30px;height:30px}" +
    ".ndl-h .t{font:700 16px/1.15 Georgia,serif;color:#690608;min-width:0}.ndl-h .t small{display:block;font:400 12.5px/1.3 'Roboto Condensed',sans-serif;color:#6b4a40;margin-top:2px}" +
    ".ndl-h .ac{grid-row:1/3;grid-column:3;display:flex;gap:6px;align-items:center}" +
    ".ndl-h .ac button{width:36px;height:36px;border-radius:50%;border:1px solid rgba(227,178,94,.8);background:linear-gradient(180deg,#fffdf9,#fbefe5);color:#7a0f22;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:0 0 8px rgba(255,214,150,.55)}.ndl-h .ac button svg{width:18px;height:18px}.ndl-h .ac .cv{border:0;background:none;box-shadow:none}" +
    ".ndl-row.open .ndl-h .ac .cv svg{transform:rotate(180deg)}" +
    ".ndl-pills{grid-column:2;display:flex;gap:6px;flex-wrap:wrap}" +
    ".ndl-st{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 10px;border-radius:12px;font:700 12.5px 'Roboto Condensed',sans-serif}.ndl-st svg{width:14px;height:14px}" +
    ".ndl-st.ok{color:#fff;background:linear-gradient(#83b93b,#3b7c0b 60%,#286900);border:1px solid #bdd386}" +
    ".ndl-st.no{color:#8a4b00;background:linear-gradient(#fff6d6,#ffe39a);border:1px solid #f0c25a}" +
    ".ndl-st.opt{color:#6b4a40;background:linear-gradient(#fffdf9,#f3e6da);border:1px solid #e3cdb5}" +
    ".ndl-st.cnt{color:#6b0a1c;background:linear-gradient(#fffdf9,#fbefe5);border:1px solid rgba(227,178,94,.8)}" +
    ".ndl-b{display:none;padding:0 12px 12px}.ndl-row.open .ndl-b{display:block}" +
    ".ndl-f{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:0 0 6px;border-radius:14px;background:rgba(255,255,255,.85);border:1px solid rgba(227,178,94,.6);font:400 14px 'Roboto Condensed',sans-serif;color:#2b1010}" +
    ".ndl-f span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ndl-f em{font-style:normal;color:#7a5a4a;font-size:12.5px;white-space:nowrap}" +
    ".ndl-f button{width:32px;height:32px;border-radius:50%;border:1px solid rgba(227,178,94,.8);background:#fffaf4;color:#7a0f22;display:grid;place-items:center;padding:0;cursor:pointer}.ndl-f button svg{width:16px;height:16px}.ndl-f button.rm{color:#b0102c}" +
    ".ndl-up{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px;border-radius:14px;border:2px dashed #c8465e;background:rgba(255,248,240,.85);color:#7a0f22;font:700 15px 'Roboto Condensed',sans-serif;cursor:pointer;text-align:center}" +
    ".ndl-up small{font:400 12.5px 'Roboto Condensed',sans-serif;color:#6b4a40}.ndl-up svg{width:24px;height:24px}.ndl-up input{position:absolute;inset:0;opacity:0;cursor:pointer}" +
    ".ndl-up.busy{opacity:.6;pointer-events:none}" +
    ".ndl-x{float:right;font:700 12px 'Roboto Condensed',sans-serif;color:#9a1a33;background:none;border:0;cursor:pointer;margin-top:4px}" +
    "@media(max-width:420px){.ndl-sel{grid-template-columns:1fr}}" +
    /* rows in the look of the bank module's client documents: title line, status + files pills, eye and download, strong blended photo */
    ".ndl-row:before{width:78%;opacity:1;filter:saturate(1.12) contrast(1.04);-webkit-mask-image:linear-gradient(270deg,#000 0%,rgba(0,0,0,.85) 35%,rgba(0,0,0,.35) 68%,transparent 100%);mask-image:linear-gradient(270deg,#000 0%,rgba(0,0,0,.85) 35%,rgba(0,0,0,.35) 68%,transparent 100%)}" +
    ".ndl-row:after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(255,250,245,.94) 0%,rgba(255,250,245,.45) 30%,rgba(255,250,245,0) 50%)}" +
    ".ndl-h{grid-template-columns:34px 1fr auto;grid-template-rows:auto auto;gap:8px 10px;padding:12px 12px 12px 14px;min-height:0}" +
    ".ndl-h .ic{grid-row:1;align-self:center}.ndl-h .ic svg{width:30px;height:30px;stroke-width:2.1}" +
    ".ndl-h .t{grid-column:2/4;grid-row:1;font-size:20px!important;line-height:1.15;text-shadow:0 0 8px #fffaf4,0 0 3px #fffaf4,0 0 1px #fff}" +
    ".ndl-pills{grid-column:2;grid-row:2;align-self:center}" +
    ".ndl-h .ac{grid-column:3;grid-row:2;gap:8px}" +
    ".ndl-h .ac button{width:42px!important;height:42px!important}" +
    ".ndl-h .ac button svg{width:21px;height:21px;stroke-width:2.2}" +
    ".ndl-st{height:30px!important;padding:0 13px!important;font-size:14.5px!important}" +
    ".ndl-hint{display:flex;align-items:flex-start;gap:6px;margin:0 2px 8px;font:400 13.5px/1.35 'Roboto Condensed',sans-serif;color:#5b3a30}.ndl-hint svg{flex:none;width:15px;height:15px;margin-top:2px;color:#9c0016}" +
    "@media (hover:hover){.ndl-row{transition:transform .3s cubic-bezier(.2,.7,.2,1),filter .3s}.ndl-row:hover{transform:translateY(-2px);filter:drop-shadow(0 0 10px rgba(255,205,140,.6))}.ndl-row:hover:before{filter:saturate(1.2) contrast(1.06) brightness(1.03)}}";
  function boot() { if (document.getElementById("ndl-css")) return; var s = document.createElement("style"); s.id = "ndl-css"; s.textContent = css; document.head.appendChild(s); }

  /* ---------------- catalogue of documents (real Bulgarian bank / notary requirements) ---------------- */
  function R(key, title, hint, icon, photo, opt) { return { key: key, title: title, hint: hint, icon: icon || "doc", photo: photo || "nd/ph06.jpg", opt: !!opt }; }
  var CREDIT = [["mortgage", "Ипотечен кредит"], ["consumer", "Потребителски кредит"], ["refi", "Рефинансиране на кредит"]];
  var INCOME = [["bg", "С доходи от България (трудов договор)"], ["abroad", "С доходи от чужбина"], ["firm_bg", "Със собствена фирма в България"], ["firm_abroad", "Със собствена фирма в чужбина"], ["free", "Свободна професия / хонорари"], ["pension", "Пенсионер"]];
  var COMMON = [
    R("id", "Лична карта (на всички кредитоискатели)", "Валиден документ за самоличност; копие лице/гръб", "id", "field-id.webp"),
    R("app", "Искане за кредит", "Формуляр на банката – попълва се в клона/онлайн", "pen", "nd/ph06.jpg"),
    R("related", "Декларация за свързани лица и произход на средства", "Образец на банката", "doc", "nd/ph16.jpg"),
    R("ckr", "Съгласие / справка ЦКР", "Централен кредитен регистър към БНБ – банката я тегли със съгласие", "shield", "field-status.webp"),
    R("marital", "Удостоверение за семейно положение / граждански брак", "От общината; при развод – съдебно решение", "users", "nd/ph13.jpg"),
    R("regime", "Удостоверение за режим на имуществени отношения", "Агенция по вписванията – при брак", "scale", "nd/ph11.jpg", true)
  ];
  var BY_INCOME = {
    bg: [
      R("salary_cert", "Служебна бележка / удостоверение за доход", "По образец на банката, подписана от работодателя; валидна 30 дни", "doc", "field-budget.webp"),
      R("labor", "Трудов договор и анекси", "Копие; мин. 6 м. при работодателя (препоръчително)", "brief", "nd/ph04.jpg"),
      R("nap62", "Справка НАП – трудови договори (чл. 62 КТ)", "Портал на НАП с ПИК/КЕП", "shield", "nd/ph10.jpg"),
      R("nap_ins", "Справка за осигурителен доход (УП-2/УП-3 / НАП)", "За последните 6–12 месеца", "chart", "nd/ph15.jpg"),
      R("bank_st", "Банкови извлечения 6–12 месеца", "По сметката, по която постъпва заплатата", "bank", "field-budget.webp")
    ],
    abroad: [
      R("ab_labor", "Трудов договор от чужбина + превод", "Заверен превод на български", "brief", "nd/ph04.jpg"),
      R("ab_payslips", "Фишове за заплата 6–12 месеца", "Payslips / Lohnabrechnung – с превод", "coins", "field-budget.webp"),
      R("ab_tax", "Данъчна декларация / удостоверение за доход от чужбина", "P60, Steuerbescheid, IRS и др. – за последната година", "doc", "nd/ph16.jpg"),
      R("ab_employer", "Удостоверение от работодателя", "Длъжност, стаж, нетна заплата", "users", "nd/ph13.jpg"),
      R("ab_bank", "Банкови извлечения 6–12 месеца", "Сметката, по която се получава заплатата", "bank", "nd/ph12.jpg"),
      R("ab_apost", "Легализиран превод / апостил", "Документите от чужбина – с апостил и заверен превод", "globe", "nd/ph19.jpg"),
      R("ab_res", "Документ за пребиваване / работна виза", "При работа извън ЕС", "id", "field-id.webp", true)
    ],
    firm_bg: [
      R("f_status", "Удостоверение за актуално състояние / ЕИК", "Търговски регистър – служебно или разпечатка", "brief", "nd/ph10.jpg"),
      R("f_gdd", "ГДД по чл. 50 / чл. 92 ЗКПО", "Годишни данъчни декларации за последните 2 години", "doc", "nd/ph16.jpg"),
      R("f_bs", "Баланс и ОПР за 2 години + текущ период", "Подписани от счетоводителя", "chart", "nd/ph15.jpg"),
      R("f_ledger", "Оборотна ведомост към последния месец", "От счетоводителя", "coins", "field-budget.webp"),
      R("f_vat", "Справки-декларации по ДДС", "Последните 6–12 месеца (ако е регистрирана по ДДС)", "doc", "nd/ph06.jpg", true),
      R("f_nap", "Удостоверение за липса на задължения (чл. 87, ал. 6 ДОПК)", "НАП – за фирмата и собственика", "shield", "field-status.webp"),
      R("f_bank", "Банкови извлечения по фирмената сметка 12 м.", "Оборотите по сметката", "bank", "nd/ph12.jpg"),
      R("f_mgmt", "Договор за управление / дивидентни решения", "Ако доходът е като управител или дивидент", "pen", "nd/ph04.jpg", true)
    ],
    firm_abroad: [
      R("fa_reg", "Регистрационни документи на фирмата", "Certificate of incorporation – с превод и апостил", "globe", "nd/ph19.jpg"),
      R("fa_fin", "Финансови отчети за 2 години", "Annual accounts – с превод", "chart", "nd/ph15.jpg"),
      R("fa_tax", "Данъчни декларации на фирмата и собственика", "За последните 2 години", "doc", "nd/ph16.jpg"),
      R("fa_good", "Удостоверение за добро състояние", "Certificate of good standing – актуално", "shield", "field-status.webp"),
      R("fa_shares", "Документ за собственост на дяловете", "Регистър на съдружниците / акционерите", "users", "nd/ph13.jpg"),
      R("fa_bank", "Банкови извлечения фирма + лични 12 м.", "Доказване на доход и обороти", "bank", "nd/ph12.jpg"),
      R("fa_apost", "Апостил и заверени преводи", "За всички документи от чужбина", "globe", "nd/ph08.jpg")
    ],
    free: [
      R("fr_gdd", "ГДД по чл. 50 ЗДДФЛ за 2 години", "С входящ номер от НАП", "doc", "nd/ph16.jpg"),
      R("fr_contracts", "Граждански договори / фактури за хонорари", "Последните 12 месеца", "pen", "nd/ph04.jpg"),
      R("fr_ins", "Доказателство за платени осигуровки", "Справка от НАП", "shield", "field-status.webp"),
      R("fr_bank", "Банкови извлечения 12 месеца", "Постъпленията по хонорарите", "bank", "nd/ph12.jpg")
    ],
    pension: [
      R("p_noi", "Разпореждане / удостоверение от НОИ за пенсията", "Размер на пенсията – от НОИ", "doc", "nd/ph16.jpg"),
      R("p_bank", "Банкови извлечения 6 месеца", "Сметката, по която се получава пенсията", "bank", "nd/ph12.jpg"),
      R("p_codebtor", "Документи на съдлъжник (ако се изисква)", "При възраст над лимита на банката", "users", "nd/ph13.jpg", true)
    ]
  };
  var BY_CREDIT = {
    mortgage: [
      R("prelim", "Предварителен договор", "Подписан от купувач и продавач", "pen", "nd/ph04.jpg"),
      R("deed", "Нотариален акт на продавача", "Документ за собственост – копие", "scale", "nd/ph11.jpg"),
      R("sketch", "Скица / схема на имота", "АГКК (кадастър) – валидна 6 месеца", "map", "nd/ph03.jpg"),
      R("tax_eval", "Данъчна оценка (чл. 264 ДОПК)", "От общината – валидна до края на годината", "coins", "field-budget.webp"),
      R("burden", "Удостоверение за тежести", "Агенция по вписванията – за последните 10 г.", "shield", "field-status.webp"),
      R("valuation", "Оценка от лицензиран оценител", "Оценител от списъка на банката", "chart", "nd/ph15.jpg"),
      R("ins_prop", "Застраховка на имота", "Пожар, природни бедствия – в полза на банката", "home", "nd/ph09.jpg"),
      R("ins_life", "Застраховка живот", "За размера на кредита – в полза на банката", "shield", "nd/ph14.jpg"),
      R("heirs", "Удостоверение за наследници", "Ако имотът е придобит по наследство", "users", "nd/ph13.jpg", true)
    ],
    consumer: [
      R("purpose", "Документ за целта (по желание)", "Оферта, фактура, договор – ако банката го изиска", "doc", "nd/ph06.jpg", true),
      R("codebtor", "Документи на съдлъжник / поръчител", "При по-голяма сума", "users", "nd/ph13.jpg", true)
    ],
    refi: [
      R("cur_contract", "Договор за текущия кредит + анекси", "От банката, в която е кредитът", "pen", "nd/ph04.jpg"),
      R("schedule", "Погасителен план", "Актуален", "chart", "nd/ph15.jpg"),
      R("balance", "Удостоверение за остатък и редовно обслужване", "От текущата банка – валидно 30 дни", "bank", "nd/ph12.jpg"),
      R("early", "Писмо / условия за предсрочно погасяване", "Такса и срок за предсрочно погасяване", "coins", "field-budget.webp"),
      R("r_deed", "Нотариален акт на ипотекирания имот", "При ипотечен кредит", "scale", "nd/ph11.jpg"),
      R("r_burden", "Удостоверение за тежести", "Агенция по вписванията", "shield", "field-status.webp"),
      R("r_val", "Нова оценка на имота", "Лицензиран оценител от списъка на новата банка", "chart", "nd/ph03.jpg")
    ]
  };
  var PROP_BASE = [
    R("deed", "Нотариален акт", "Документ за собственост – основен", "scale", "nd/ph11.jpg"),
    R("sketch", "Скица / схема (АГКК)", "Кадастър – валидна 6 месеца", "map", "nd/ph03.jpg"),
    R("tax_eval", "Данъчна оценка", "От общината – валидна до края на годината", "coins", "field-budget.webp"),
    R("burden", "Удостоверение за тежести", "Агенция по вписванията – за последните 10 г.", "shield", "field-status.webp"),
    R("energy", "Енергиен сертификат", "Задължителен при продажба / наем на сгради", "chart", "nd/ph09.jpg"),
    R("act16", "Разрешение за ползване / Акт 16", "За ново строителство", "bank", "nd/ph07.jpg"),
    R("plans", "Архитектурни планове", "Одобрени проекти – от общината", "map", "nd/ph19.jpg", true),
    R("contracts", "Договори и анекси", "Предварителен договор, наем, анекси", "pen", "nd/ph04.jpg"),
    R("no_debts", "Удостоверение за липса на задължения", "Местни данъци, ТЕЦ, вода, ток, вход", "coins", "nd/ph12.jpg"),
    R("decl264", "Декларация по чл. 264 ДОПК и за гражданство/семейно положение", "Подписват се при нотариуса", "doc", "nd/ph16.jpg"),
    R("poa", "Пълномощно", "Нотариално заверено – ако продава пълномощник", "pen", "nd/ph14.jpg", true)
  ];
  var SITUATIONS = [["", "Няма"], ["heirs", "Наследство"], ["coown", "Съсобственост"], ["mortgaged", "Ипотекиран имот"], ["seized", "Възбрана"], ["divorce", "Развод"], ["abroad", "Собственик в чужбина (пълномощно)"],
    ["widow", "Починал съпруг"], ["building", "Имот в строеж"], ["agri", "Земеделска земя"], ["minor", "Непълнолетен собственик"], ["company", "Фирма продавач"]];
  var BY_SIT = {
    heirs: [R("s_heirs", "Удостоверение за наследници", "От общината по последен адрес на починалия", "users", "nd/ph13.jpg"), R("s_death", "Препис-извлечение от акт за смърт", "От общината", "doc", "nd/ph16.jpg"),
      R("s_refuse", "Отказ от наследство (ако има)", "Вписан в районния съд", "scale", "nd/ph11.jpg", true), R("s_will", "Завещание (ако има)", "Нотариално или саморъчно – обявено", "pen", "nd/ph04.jpg", true),
      R("s_heir_tax", "Декларация по чл. 32 ЗМДТ (наследствена)", "Подадена в общината", "coins", "field-budget.webp")],
    coown: [R("s_consent", "Съгласие / присъствие на всички съсобственици", "Всички подписват при нотариуса или с пълномощно", "users", "nd/ph13.jpg"), R("s_invite", "Нотариална покана за изкупуване (чл. 33 ЗС)", "Когато се продава идеална част", "pen", "nd/ph04.jpg"), R("s_division", "Договор / решение за делба (ако има)", "Съдебна или доброволна делба", "scale", "nd/ph11.jpg", true)],
    mortgaged: [R("s_bal", "Удостоверение за остатък от банката", "Сума за пълно погасяване към датата на сделката", "bank", "nd/ph12.jpg"), R("s_release", "Съгласие на банката / заличаване на ипотеката", "Писмо от банката + молба за заличаване в АВ", "shield", "field-status.webp"), R("s_loan", "Договор за кредит", "За проверка на условията", "pen", "nd/ph04.jpg", true)],
    seized: [R("s_seize", "Документ за вдигане на възбраната", "От съдебния изпълнител / НАП / съда", "scale", "nd/ph11.jpg"), R("s_paid", "Удостоверение за изплатен дълг", "От взискателя", "coins", "field-budget.webp")],
    divorce: [R("s_court", "Съдебно решение за развод", "С отметка за влязло в сила", "scale", "nd/ph11.jpg"), R("s_agree", "Споразумение за имуществените отношения", "Към бракоразводното решение", "pen", "nd/ph04.jpg"), R("s_ex", "Съгласие на бившия съпруг (ако е съсобственик)", "Нотариална заверка", "users", "nd/ph13.jpg", true)],
    abroad: [R("s_poa_ap", "Пълномощно с апостил", "Заверено в консулство или от нотариус + апостил", "globe", "nd/ph19.jpg"), R("s_poa_tr", "Заверен превод на пълномощното", "Ако е издадено на чужд език", "doc", "nd/ph16.jpg"), R("s_poa_id", "Копие от документ за самоличност на собственика", "За проверка от нотариуса", "id", "field-id.webp")],
    widow: [R("s_heirs2", "Удостоверение за наследници", "За дела на починалия съпруг", "users", "nd/ph13.jpg"), R("s_death2", "Препис-извлечение от акт за смърт", "От общината", "doc", "nd/ph16.jpg"), R("s_marr", "Удостоверение за сключен граждански брак", "За доказване на СИО", "users", "nd/ph14.jpg")],
    building: [R("s_permit", "Разрешение за строеж", "От общината", "bank", "nd/ph07.jpg"), R("s_act14", "Акт 14 / Акт 15", "Етап на строителството", "chart", "nd/ph15.jpg"), R("s_build_c", "Договор със строителя / за учредено право на строеж", "Нотариален акт за право на строеж", "pen", "nd/ph04.jpg"), R("s_bank_g", "Банкова гаранция / ескроу (ако има)", "Защита на купувача", "bank", "nd/ph12.jpg", true)],
    agri: [R("s_restit", "Решение на ОСЗ / скица от ОСЗ", "Общинска служба по земеделие", "map", "nd/ph03.jpg"), R("s_lease", "Договор за аренда (ако има)", "Вписан в АВ", "pen", "nd/ph04.jpg", true), R("s_neigh", "Покана към съседи (право на предпочтително изкупуване)", "При земеделска земя по ЗСПЗЗ", "users", "nd/ph13.jpg", true)],
    minor: [R("s_court130", "Разрешение от районния съд (чл. 130 СК)", "Задължително при сделка с имот на дете", "scale", "nd/ph11.jpg"), R("s_birth", "Удостоверение за раждане", "От общината", "doc", "nd/ph16.jpg"), R("s_parents", "Документи на родителите / настойника", "Лични карти, съгласие", "users", "nd/ph13.jpg")],
    company: [R("s_cstatus", "Удостоверение за актуално състояние", "Търговски регистър", "brief", "nd/ph10.jpg"), R("s_gm", "Решение на ОС / съдружниците за продажба", "Нотариална заверка на подписите", "users", "nd/ph13.jpg"), R("s_cnap", "Удостоверение за липса на задължения на фирмата", "НАП – чл. 87, ал. 6 ДОПК", "shield", "field-status.webp"), R("s_cvat", "Фактура / ДДС режим на сделката", "При регистрация по ДДС", "coins", "field-budget.webp", true)]
  };

  /* ---------------- generic checklist window ---------------- */
  function openList(cfg) {
    boot();
    var docs = [], ctx, sel = cfg.sel.map(function (s) { return s.value || ""; }), custom = (cfg.custom || []).slice(), openKey = null, sendOpen = false, recips = null, sendSel = {};
    function rows() {
      var groups = cfg.rows(sel).concat(custom.length ? [["Добавени графи", custom.map(function (c) { return R(c.key, c.title, "Добавена графа", "folder", "nd/ph20.jpg"); })]] : []);
      return groups;
    }
    function filesOf(key) { return docs.filter(function (d) { return d.folder === key; }); }
    function rowHtml(r) {
      var fs = filesOf(r.key), has = fs.length > 0;
      return '<div class="ndl-row' + (openKey === r.key ? " open" : "") + '" data-k="' + esc(r.key) + '" style="--ph:url(' + U.img(r.photo) + ')"><div class="ndl-h" data-tg>' +
        '<span class="ic">' + sv(r.icon) + '</span><span class="t" title="' + esc(r.hint) + '">' + esc(r.title) + "</span>" +
        '<span class="ac"><button type="button" data-view aria-label="Преглед">' + sv("eye") + '</button><button type="button" class="dl" data-dl aria-label="Изтегли">' + sv("dl") + "</button></span>" +
        '<span class="ndl-pills">' + (has ? '<span class="ndl-st ok">' + sv("check") + "Прикачен</span>" : r.opt ? '<span class="ndl-st opt">' + sv("info") + "При нужда</span>" : '<span class="ndl-st no">' + sv("info") + "Липсва</span>") +
        (has ? '<span class="ndl-st cnt">' + sv("clip") + fs.length + (fs.length === 1 ? " файл" : " файла") + "</span>" : "") + "</span></div>" +
        '<div class="ndl-b">' + (r.hint ? '<p class="ndl-hint">' + sv("info") + esc(r.hint) + "</p>" : "") + fs.map(function (d) {
          return '<div class="ndl-f">' + sv("doc", "dlf") + "<span>" + esc(d.name) + "</span><em>" + U.bgDate(d.at) + " · " + Math.max(1, Math.round((d.size || 0) / 1024)) + ' KB</em><button type="button" data-open="' + esc(d.id) + '" aria-label="Отвори">' + sv("eye") + '</button><button type="button" class="rm" data-rm="' + esc(d.id) + '" aria-label="Изтрий">' + sv("trash") + "</button></div>";
        }).join("") + '<label class="ndl-up">' + sv("up") + "Прикачи файл<small>PDF, снимка, Word · до 20 MB · може няколко</small>" + '<input type="file" multiple data-up accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"></label>' +
        (custom.some(function (c) { return c.key === r.key; }) ? '<button type="button" class="ndl-x" data-delrow>Премахни графата</button>' : "") + "</div></div>";
    }
    function html() {
      var gs = rows(), all = [], req = 0, done = 0;
      gs.forEach(function (g) { g[1].forEach(function (r) { all.push(r); if (!r.opt) { req++; if (filesOf(r.key).length) done++; } }); });
      var other = docs.filter(function (d) { return !all.some(function (r) { return r.key === d.folder; }); });
      return '<div class="ndl">' + '<div class="ndl-sel">' + cfg.sel.map(function (s, i) {
          return '<div><label for="ndl-s' + i + '">' + esc(s.label) + '</label><div class="w"><select id="ndl-s' + i + '" data-si="' + i + '">' + s.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === sel[i] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" + sv("chev") + "</div></div>";
        }).join("") + "</div>" +
        '<div class="ndl-top"><span class="sum">Задължителни: <b>' + done + " / " + req + '</b> прикачени</span><button type="button" class="ndl-add ndl-send" data-send>' + sv("up") + "Изпрати документите</button>" + '<button type="button" class="ndl-add" data-addrow>' + sv("plus") + "Създай нова графа</button></div>" +
        (sendOpen ? sendHtml(gs) : "") +
        '<div class="ndl-bar"><i style="width:' + (req ? Math.round(done / req * 100) : 0) + '%"></i></div>' +
        gs.map(function (g) { return '<div class="ndl-grp">' + esc(g[0]) + '</div><div class="ndl-rows2">' + g[1].map(rowHtml).join("") + "</div>"; }).join("") +
        (other.length ? '<div class="ndl-grp">Други документи</div>' + rowHtml(R("__other", "Други документи", "Качени по-рано или без графа", "folder", "nd/ph20.jpg", true)).replace(/data-k="__other"/, 'data-k="__other" data-other') : "") +
        "</div>";
    }
    /* ---- send the collected documents: to an e-mail from Компании (links valid 7 days) or as real files via the phone's share sheet ---- */
    function titleOf(key, gs) { var t = key === "other" ? "Други документи" : key; gs.forEach(function (g) { g[1].forEach(function (r) { if (r.key === key) t = r.title; }); }); custom.forEach(function (c) { if (c.key === key) t = c.title; }); return t; }
    function sendHtml(gs) {
      var groups = {}; docs.forEach(function (d) { (groups[d.folder] = groups[d.folder] || []).push(d); });
      var opts = (recips || []).map(function (r) { return '<option value="' + esc(r.email) + '">' + esc(r.label) + "</option>"; }).join("");
      return '<div class="ndl-snd"><div class="ndl-grp">Изпрати документите</div>' +
        '<label>До (имейл от Компании или въведете)</label><div class="w"><select data-rcp><option value="">' + (recips ? "— изберете получател —" : "зареждане…") + "</option>" + opts + "</select></div>" +
        '<input type="email" data-rcpx placeholder="или друг имейл, напр. ipoteki@bank.bg">' +
        '<label>Тема</label><input type="text" data-subj value="' + esc("Документи – " + (cfg.who || cfg.title)) + '">' +
        '<label>Документи (' + docs.length + ")</label>" + (docs.length ? Object.keys(groups).map(function (k) {
          return '<div class="ndl-sg"><b>' + esc(titleOf(k, gs)) + "</b>" + groups[k].map(function (d) { var on = sendSel[d.id] !== false; return '<label class="ndl-ck"><input type="checkbox" data-sd="' + esc(d.id) + '"' + (on ? " checked" : "") + "> " + esc(d.name) + "</label>"; }).join("") + "</div>";
        }).join("") : '<div class="ndl-sg">Още няма прикачени документи.</div>') +
        '<div class="ndl-sa"><button type="button" class="ndl-add" data-mail>' + sv("up") + 'Изпрати по имейл</button><button type="button" class="ndl-add alt" data-share>' + sv("clip") + "Изпрати като файлове</button></div>" +
        '<small class="ndl-note">„Изпрати по имейл“ отваря пощата с получателя, темата и линковете, групирани по документи (валидни 7 дни). „Като файлове“ прикачва самите файлове през менюто за споделяне на телефона (Mail, Gmail, Viber…); на компютър ги изтегля като .zip.</small></div>';
    }
    function loadRecips() {
      if (recips) return;
      D.load("companies").then(function (l) {
        var out = []; if (cfg.email) out.push({ email: cfg.email, label: (cfg.who || "Клиент") + " – " + cfg.email });
        l.forEach(function (c) {
          if (c.email) out.push({ email: c.email, label: (c.name || "Компания") + " – " + c.email });
          (c.emps || c.employees || []).forEach(function (e) { if (e.email) out.push({ email: e.email, label: (e.name || "") + (e.role ? " (" + e.role + ")" : "") + ", " + (c.name || "") + " – " + e.email }); });
        });
        recips = out; render();
      }).catch(function () { recips = cfg.email ? [{ email: cfg.email, label: cfg.email }] : []; render(); });
    }
    function chosen() { return docs.filter(function (d) { return sendSel[d.id] !== false; }); }
    function recipient() { var b = ctx.body, x = b.querySelector("[data-rcpx]"), s0 = b.querySelector("[data-rcp]"); return ((x && x.value.trim()) || (s0 && s0.value) || "").trim(); }
    function sendMail() {
      var list = chosen(), to = recipient(), subj = (ctx.body.querySelector("[data-subj]") || {}).value || "Документи";
      if (!list.length) { cfg.say("Изберете поне един документ"); return; }
      if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { cfg.say("Проверете имейла"); return; }
      D.shareUrls(list.map(function (d) { return d.path; })).then(function (m) {
        var gs = rows(), groups = {}, order = [];
        list.forEach(function (d) { if (!groups[d.folder]) { groups[d.folder] = []; order.push(d.folder); } groups[d.folder].push(d); });
        var body = "Здравейте,\n\nИзпращам документите" + (cfg.who ? " на " + cfg.who : "") + ":\n\n" + order.map(function (k) {
          return "▪ " + titleOf(k, gs) + "\n" + groups[k].map(function (d) { return "   " + d.name + ": " + (m[d.path] || "(няма линк)"); }).join("\n");
        }).join("\n\n") + "\n\nЛинковете са валидни 7 дни.\n\nПоздрави,\nНедвижими Имоти Надежда\n0898 977 370";
        try { navigator.clipboard.writeText(body); } catch (e) {}
        location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
        cfg.say("Пощата се отваря – текстът е копиран и в клипборда");
        if (cfg.onSend) cfg.onSend(to, list.length, "имейл");
      }).catch(function (e) { cfg.say("Грешка: " + ((e && e.message) || e)); });
    }
    function sendFiles(btn) {
      var list = chosen(); if (!list.length) { cfg.say("Изберете поне един документ"); return; }
      btn.disabled = true; var old = btn.innerHTML; btn.textContent = "Подготвям файловете…";
      var gs = rows();
      D.shareUrls(list.map(function (d) { return d.path; }), 3600).then(function (m) {
        return Promise.all(list.map(function (d) { return fetch(m[d.path]).then(function (r) { return r.blob(); }).then(function (b) { return new File([b], (titleOf(d.folder, gs) + " – " + d.name).replace(/[\\/:*?"<>|]+/g, "_"), { type: d.mime || b.type || "application/octet-stream" }); }); }));
      }).then(function (files) {
        var subj = (ctx.body.querySelector("[data-subj]") || {}).value || "Документи";
        if (navigator.canShare && navigator.canShare({ files: files })) return navigator.share({ files: files, title: subj, text: subj + " – Недвижими Имоти Надежда" }).then(function () { if (cfg.onSend) cfg.onSend(recipient(), files.length, "файлове"); });
        return (window.JSZip ? Promise.resolve() : new Promise(function (ok, bad) { var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); }))
          .then(function () { var z = new window.JSZip(); files.forEach(function (f) { z.file(f.name, f); }); return z.generateAsync({ type: "blob" }); })
          .then(function (blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = subj.replace(/[\\/:*?"<>|]+/g, "_") + ".zip"; document.body.appendChild(a); a.click(); a.remove(); cfg.say("Изтеглен .zip – прикачете го в имейла"); if (cfg.onSend) cfg.onSend(recipient(), files.length, "zip"); });
      }).catch(function (e) { if (!(e && e.name === "AbortError")) cfg.say("Не успях да подготвя файловете: " + ((e && e.message) || e)); })
        .then(function () { btn.disabled = false; btn.innerHTML = old; });
    }
    function render() { var y = ctx.body.parentNode ? ctx.body.scrollTop : 0; ctx.rerender(html()); }
    function fileList(key) { return key === "__other" ? docs.filter(function (d) { var all = []; rows().forEach(function (g) { g[1].forEach(function (r) { all.push(r.key); }); }); return all.indexOf(d.folder) < 0; }) : filesOf(key); }
    function openDoc(d) { var w = window.open("", "_blank"); D.fileUrl(d.path).then(function (u) { if (w) w.location = u; else location.href = u; }); }
    function upload(key, title, files) {
      var box = ctx.body.querySelector('[data-k="' + key + '"] .ndl-up'); if (box) box.classList.add("busy");
      return files.reduce(function (p, file) {
        return p.then(function () {
          if (file.size > 20 * 1024 * 1024) { cfg.say("„" + file.name + "“ е над 20 MB"); return; }
          var path = cfg.base + Date.now() + "-" + key + "-" + file.name.replace(/[^\w.\-]+/g, "_").slice(-70);
          return D.upload(path, file).then(function () {
            var rec = Object.assign({ name: file.name, folder: key, folderTitle: title, path: path, mime: file.type, size: file.size, at: new Date().toISOString() }, cfg.link);
            return D.put("documents", rec).then(function (s) { docs.push(s); });
          });
        });
      }, Promise.resolve()).then(function () { openKey = key; cfg.say("Документът е прикачен"); if (cfg.onUpload) cfg.onUpload(title, files.length); render(); })
        .catch(function (e) { cfg.say("Грешка при качване: " + ((e && e.message) || e)); if (box) box.classList.remove("busy"); });
    }
    function bind() {
      var b = ctx.body;
      [].forEach.call(b.querySelectorAll("[data-si]"), function (s) {
        s.onchange = function () { sel[+s.getAttribute("data-si")] = s.value; openKey = null; cfg.saveSel(sel.slice(), custom.slice()); render(); };
      });
      [].forEach.call(b.querySelectorAll("[data-up]"), function (inp) {
        inp.onchange = function () { var row = inp.closest("[data-k]"), key = row.getAttribute("data-k"); var t = row.querySelector(".t").firstChild.nodeValue; if (inp.files.length) upload(key === "__other" ? "other" : key, t, [].slice.call(inp.files)); };
      });
      b.onclick = function (e) {
        var row = e.target.closest("[data-k]"), key = row && row.getAttribute("data-k");
        if (e.target.closest("[data-send]")) { sendOpen = !sendOpen; if (sendOpen) loadRecips(); render(); return; }
        if (e.target.closest("[data-mail]")) { sendMail(); return; }
        var shb = e.target.closest("[data-share]"); if (shb) { sendFiles(shb); return; }
        var ck = e.target.closest("[data-sd]"); if (ck) { sendSel[ck.getAttribute("data-sd")] = ck.checked; return; }
        if (e.target.closest(".ndl-snd")) return;
        if (e.target.closest("[data-addrow]")) {
          var t = (window.prompt("Име на новата графа (напр. „Пълномощно от съпруга“):") || "").trim(); if (!t) return;
          var k = "c_" + Date.now().toString(36); custom.push({ key: k, title: t }); openKey = k; cfg.saveSel(sel.slice(), custom.slice()); render(); return;
        }
        if (!row) return;
        var op = e.target.closest("[data-open]"), rm = e.target.closest("[data-rm]");
        if (op) { openDoc(docs.filter(function (d) { return d.id === op.getAttribute("data-open"); })[0]); return; }
        if (rm) {
          if (!rm.dataset.ok) { rm.dataset.ok = 1; rm.style.boxShadow = "0 0 0 3px #c81a3a"; cfg.say("Натиснете отново за изтриване"); setTimeout(function () { delete rm.dataset.ok; rm.style.boxShadow = ""; }, 2500); return; }
          var dd = docs.filter(function (d) { return d.id === rm.getAttribute("data-rm"); })[0];
          D.removeFile(dd.path).catch(function () {}).then(function () { return D.del("documents", dd.id); }).then(function () { docs = docs.filter(function (x) { return x.id !== dd.id; }); openKey = key; cfg.say("Документът е изтрит"); render(); });
          return;
        }
        if (e.target.closest("[data-delrow]")) { custom = custom.filter(function (c) { return c.key !== key; }); cfg.saveSel(sel.slice(), custom.slice()); render(); return; }
        if (e.target.closest("[data-view]") || e.target.closest("[data-dl]")) { var fl = fileList(key); if (fl.length) { fl.forEach(openDoc); } else { openKey = key; render(); cfg.say("Няма прикачен файл – прикачете"); } return; }
        if (e.target.closest("[data-tg]") && !e.target.closest(".ndl-up")) { openKey = openKey === key ? null : key; render(); }
      };
    }
    U.open({
      title: cfg.title, icon: "file-text", photo: cfg.photo || "nd/ph06.jpg", html: '<div class="wide ndempty">Зареждане…</div>', noSave: true, cancelText: "Затвори",
      ready: function (x) { ctx = x; cfg.load().then(function (l) { docs = l; render(); }).catch(function () { docs = []; render(); }); },
      ready2: bind
    });
  }

  /* ---------------- public API ---------------- */
  function client(c, h) {
    openList({
      title: "Документи – " + (c.name || "клиент"), photo: "nd/ph06.jpg", base: "clients/" + c.id + "/docs/", link: { client_id: c.id, client: c.name },
      sel: [{ label: "Вид кредит", options: CREDIT, value: c.credit || "mortgage" }, { label: "Доходи", options: INCOME, value: c.creditIncome || "bg" }],
      custom: c.docRows || [],
      rows: function (s) {
        var cr = (CREDIT.filter(function (x) { return x[0] === s[0]; })[0] || CREDIT[0])[1], inc = (INCOME.filter(function (x) { return x[0] === s[1]; })[0] || INCOME[0])[1];
        var common = s[0] === "consumer" ? COMMON.filter(function (r) { return ["id", "app", "related", "ckr"].indexOf(r.key) >= 0; }) : COMMON;
        var income = BY_INCOME[s[1]] || [];
        if (s[0] === "consumer") income = income.slice(0, 3);
        return [["Лични документи", common], ["Доходи – " + inc.replace(/^С /, ""), income], [cr, BY_CREDIT[s[0]] || []]];
      },
      load: function () { return D.load("documents", { client_id: c.id }); },
      saveSel: function (s, custom) { c.credit = s[0]; c.creditIncome = s[1]; c.docRows = custom; return h.save({ credit: s[0], creditIncome: s[1], docRows: custom }).catch(function () {}); },
      onUpload: h.onUpload, say: h.say || D.say, who: c.name, email: c.email,
      onSend: function (to, n, how) { D.put("activities", { client_id: c.id, client: c.name, icon: "mail", text: "Изпратени документи (" + n + ", " + how + ")" + (to ? " до " + to : ""), at: new Date().toISOString() }).catch(function () {}); }
    });
  }
  function property(p, h) {
    var code = p.code || p.id;
    openList({
      title: "Документи на имота – " + (p.code || p.title || ""), who: "имот " + (p.code || "") + (p.title ? " – " + p.title : ""), photo: "nd/ph11.jpg", base: "properties/" + code + "/docs/", link: { property_code: code, property: p.title || "" },
      sel: [{ label: "Специална ситуация", options: SITUATIONS, value: p.docSituation || "" }, { label: "Сделка", options: [["sale", "Продажба"], ["rent", "Наем"]], value: p.deal === "rent" ? "rent" : "sale" }],
      custom: p.docRows || [],
      rows: function (s) {
        var base = s[1] === "rent" ? PROP_BASE.filter(function (r) { return ["deed", "sketch", "energy", "contracts", "no_debts", "poa"].indexOf(r.key) >= 0; }) : PROP_BASE;
        var out = [["Основни документи", base]];
        if (s[0] && BY_SIT[s[0]]) out.push(["Специална ситуация – " + (SITUATIONS.filter(function (x) { return x[0] === s[0]; })[0] || ["", ""])[1], BY_SIT[s[0]]]);
        return out;
      },
      load: function () { return D.load("documents").then(function (l) { return l.filter(function (d) { return d.property_code === code; }); }); },
      saveSel: function (s, custom) { p.docSituation = s[0]; p.docRows = custom; return h.save({ docSituation: s[0], docRows: custom }).catch(function () {}); },
      onUpload: h.onUpload, say: h.say || D.say
    });
  }
  window.NDDocs = { client: client, property: property, CREDIT: CREDIT, INCOME: INCOME, SITUATIONS: SITUATIONS };
})();
