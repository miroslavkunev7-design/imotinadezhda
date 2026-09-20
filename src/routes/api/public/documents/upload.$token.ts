// Автоматизация №9 — публична страница: клиентът качва искания документ по линк.
import { createFileRoute } from "@tanstack/react-router";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function page(body: string, title = "Качване на документ") {
  return new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} — Имоти Надежда</title>
<style>
 body{margin:0;background:#f6f1e7;color:#3d1119;font-family:Georgia,'Times New Roman',serif}
 .wrap{max-width:680px;margin:0 auto;padding:28px 18px 60px}
 .card{background:#fffdf8;border:1px solid rgba(139,26,43,.2);border-radius:16px;padding:28px;box-shadow:0 18px 40px rgba(61,17,25,.12)}
 h1{font-size:22px;color:#8B1A2B;margin:0 0 6px}
 .muted{color:#7a5560;font-size:13px;margin:0 0 18px}
 label{display:block;font-size:13px;margin:16px 0 6px;color:#5d2430}
 input,textarea{width:100%;box-sizing:border-box;padding:11px 13px;border:1px solid rgba(139,26,43,.3);border-radius:10px;font-size:15px;background:#fff;color:#3d1119}
 button{margin-top:18px;background:#8B1A2B;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-size:15px;cursor:pointer}
 .ok{background:#eef8ef;border:1px solid #b7dcbb;color:#1f5c2a;padding:14px;border-radius:12px}
 .gold{color:#C9A84C}
</style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/documents/upload/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getRequestByToken } = await import("@/lib/documents.server");
        const req = await getRequestByToken(String(params.token));
        if (!req)
          return page(
            `<h1>Линкът не е намерен</h1><p class="muted">Линкът е невалиден или вече е използван.</p>`,
            "Няма заявка",
          );
        if (req.status === "approved")
          return page(
            `<h1>${esc(req.requirement_name)}</h1><div class="ok">Документът вече е приет. Благодарим Ви!</div>`,
          );
        if (req.status === "cancelled")
          return page(
            `<h1>${esc(req.requirement_name)}</h1><p class="muted">Заявката е отменена.</p>`,
          );

        const uploaded = req.status === "uploaded";
        return page(
          `<h1>${esc(req.requirement_name)}</h1>
<p class="muted">Заявка от <span class="gold">Имоти Надежда</span>${req.due_at ? ` · срок до ${new Date(req.due_at).toLocaleDateString("bg-BG")}` : ""}</p>
${req.message ? `<p>${esc(req.message)}</p>` : ""}
${uploaded ? `<div class="ok">Получихме файл. Можете да качите нов, ако предишният е грешен.</div>` : ""}
<form method="post" enctype="multipart/form-data">
  <label for="file">Изберете файл (PDF или снимка)</label>
  <input id="file" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.heic,.docx,image/*">
  <label for="note">Бележка (по избор)</label>
  <textarea id="note" name="note" rows="3" maxlength="500" placeholder="Напр. страница 1 и 2 на документа"></textarea>
  <button type="submit">Качвам документа</button>
</form>`,
          req.requirement_name as string,
        );
      },
      POST: async ({ request, params }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          const note = String(form.get("note") ?? "").trim() || null;
          if (!(file instanceof File) || file.size === 0) {
            return page(
              `<h1>Липсва файл</h1><p class="muted">Върнете се назад и изберете файл.</p>`,
              "Липсва файл",
            );
          }
          const { uploadByToken } = await import("@/lib/documents.server");
          await uploadByToken(
            String(params.token),
            { name: file.name, type: file.type, size: file.size, bytes: await file.arrayBuffer() },
            note,
          );
          return page(
            `<h1>Готово</h1><div class="ok">Документът е получен и предаден за проверка. Благодарим Ви!</div>`,
            "Документът е получен",
          );
        } catch (e) {
          return page(`<h1>Грешка</h1><p class="muted">${esc((e as Error).message)}</p>`, "Грешка");
        }
      },
    },
  },
});
