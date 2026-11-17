// Sending a prepared e-mail. The only path: native confirmation in MAIN, then exactly
// POST /api/tools {tool:"email.send", input:{confirm:true}} - the same call the website makes after "да".
// The server sends the employee's LATEST saved draft, so the dialog says so.

const clip = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

function recipient(to) {
  if (to && typeof to === "object") {
    const email = clip(to.email, 160);
    const name = clip(to.name, 120);
    return name && email ? `${name} <${email}>` : email || name;
  }
  return clip(to, 200);
}

function attachmentLine(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return "Прикачени файлове: няма";
  const names = list.slice(0, 8).map((a) => clip(a && typeof a === "object" ? a.name : a, 80)).filter(Boolean);
  const more = list.length > names.length ? ` и още ${list.length - names.length}` : "";
  return `Прикачени файлове (${list.length}): ${names.join(", ")}${more}`;
}

export function createEmail({ tools, confirm }) {
  let sending = false; // blocks a double click while the dialog or the request is open

  async function confirmSend(args) {
    const a = args && typeof args === "object" ? args : {};
    const to = recipient(a.to);
    if (!to) return { ok: false, error: "Липсва получател на имейла." };
    if (sending) return { ok: false, error: "Имейлът вече се изпраща – изчакайте." };
    sending = true;
    try {
      const detail = [
        `До: ${to}`,
        `Тема: „${clip(a.subject, 200) || "(без тема)"}“`,
        attachmentLine(a.attachments),
        "",
        "Ще бъде изпратена последната подготвена чернова, запазена на сървъра на Тед. " +
          "Ако междувременно е подготвен по-нов имейл (в тази програма, в друг чат, в сайта или на телефона), ще бъде изпратен той, а не показаният тук.",
      ].join("\n");
      const yes = await confirm("Изпращане на имейл", detail, { okLabel: "Изпрати", cancelLabel: "Отказ" });
      if (!yes) return { ok: false, canceled: true }; // no network call at all

      const r = await tools.call("email.send", { confirm: true });
      if (r.ok) return { ok: true, result: r.result };
      // maybeExecuted: the request left this computer and its outcome is unknown - the e-mail may have been sent.
      const error = !r.maybeExecuted
        ? /^Имейлът не е изпратен/.test(r.error || "") ? r.error : `Имейлът не е изпратен: ${r.error || "грешка"}`
        : r.code === "http"
          ? `Не е ясно дали имейлът е изпратен: сървърът върна грешка (HTTP ${r.status || "5xx"}), а писмото може вече да е тръгнало. Отговор на сървъра: ${r.error || "няма"}. Проверете изпратените си писма, преди да опитате отново.`
          : "Не е ясно дали имейлът е изпратен (връзката прекъсна, преди сървърът да отговори). Проверете, преди да опитате отново.";
      return { ok: false, error, code: r.code, maybeExecuted: !!r.maybeExecuted };
    } finally {
      sending = false;
    }
  }

  return { confirmSend };
}
