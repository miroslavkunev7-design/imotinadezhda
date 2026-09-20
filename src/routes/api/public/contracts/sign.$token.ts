// Автоматизация №8 — публична страница за преглед и подпис на документ по линк.
import { createFileRoute } from "@tanstack/react-router";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function page(body: string, title = "Документ за подпис") {
  return new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} — Имоти Надежда</title>
<style>
 body{margin:0;background:#f6f1e7;color:#3d1119;font-family:Georgia,'Times New Roman',serif}
 .wrap{max-width:820px;margin:0 auto;padding:28px 18px 60px}
 .card{background:#fffdf8;border:1px solid rgba(139,26,43,.2);border-radius:16px;padding:28px;box-shadow:0 18px 40px rgba(61,17,25,.12)}
 h1{font-size:22px;color:#8B1A2B;margin:0 0 6px}
 .muted{color:#7a5560;font-size:13px;margin:0 0 18px}
 pre{white-space:pre-wrap;font-family:Georgia,serif;font-size:15px;line-height:1.7;margin:0}
 form{margin-top:24px;border-top:1px solid rgba(139,26,43,.15);padding-top:20px}
 label{display:block;font-size:13px;margin-bottom:6px;color:#5d2430}
 input,textarea{width:100%;box-sizing:border-box;padding:11px 13px;border:1px solid rgba(139,26,43,.3);border-radius:10px;font-size:15px;background:#fff;color:#3d1119}
 button{margin-top:14px;background:#8B1A2B;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-size:15px;cursor:pointer}
 button.ghost{background:transparent;color:#8B1A2B;border:1px solid rgba(139,26,43,.35);margin-left:8px}
 .ok{background:#eef8ef;border:1px solid #b7dcbb;color:#1f5c2a;padding:14px;border-radius:12px}
 .gold{color:#C9A84C}
</style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/contracts/sign/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getContractByToken } = await import("@/lib/contracts.server");
        const doc = await getContractByToken(String(params.token));
        if (!doc)
          return page(
            `<h1>Документът не е намерен</h1><p class="muted">Линкът е невалиден или изтекъл.</p>`,
            "Няма документ",
          );

        if (doc.status === "signed") {
          return page(
            `<h1>${esc(doc.title)}</h1><div class="ok">Документът е подписан на ${new Date(doc.signed_at as string).toLocaleString("bg-BG")}. Благодарим Ви!</div><pre>${esc(doc.content)}</pre>`,
            doc.title as string,
          );
        }
        if (doc.status === "declined") {
          return page(
            `<h1>${esc(doc.title)}</h1><p class="muted">Документът е отказан.</p>`,
            doc.title as string,
          );
        }
        if (doc.expires_at && new Date(doc.expires_at as string).getTime() < Date.now()) {
          return page(
            `<h1>${esc(doc.title)}</h1><p class="muted">Срокът за подписване е изтекъл. Свържете се с нас за нов документ.</p>`,
            doc.title as string,
          );
        }

        return page(
          `<h1>${esc(doc.title)}</h1>
<p class="muted">Документ № <span class="gold">${esc(doc.doc_number)}</span> · Имоти Надежда</p>
<pre>${esc(doc.content)}</pre>
<form method="post">
  <label for="signature">Изписване на пълното име за електронно потвърждение</label>
  <input id="signature" name="signature" required minlength="3" maxlength="160" placeholder="${esc(doc.signer_name ?? "Име и фамилия")}">
  <button type="submit" name="action" value="sign">Подписвам</button>
  <button type="submit" name="action" value="decline" class="ghost">Отказвам</button>
</form>`,
          doc.title as string,
        );
      },
      POST: async ({ request, params }) => {
        const form = await request.formData();
        const action = String(form.get("action") ?? "sign");
        const signature = String(form.get("signature") ?? "").trim();
        const { signByToken, declineByToken } = await import("@/lib/contracts.server");
        try {
          if (action === "decline") {
            await declineByToken(String(params.token), signature || "Без причина");
            return page(
              `<h1>Отказано</h1><p class="muted">Отбелязахме отказа. Ще се свържем с Вас.</p>`,
              "Отказано",
            );
          }
          if (signature.length < 3) {
            return page(
              `<h1>Липсва подпис</h1><p class="muted">Върнете се назад и изпишете пълното си име.</p>`,
              "Липсва подпис",
            );
          }
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          await signByToken(String(params.token), signature, ip);
          return page(
            `<h1>Документът е подписан</h1><div class="ok">Благодарим Ви, ${esc(signature)}. Копие остава в системата на Имоти Надежда.</div>`,
            "Подписано",
          );
        } catch (e) {
          return page(`<h1>Грешка</h1><p class="muted">${esc((e as Error).message)}</p>`, "Грешка");
        }
      },
    },
  },
});
