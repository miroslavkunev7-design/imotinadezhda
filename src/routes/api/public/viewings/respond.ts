// Автоматизация №6 — публичен endpoint: клиентът потвърждава/отказва/пренасрочва оглед или дава оценка.
import { createFileRoute } from "@tanstack/react-router";

const ACTIONS = new Set(["confirm", "cancel", "reschedule", "feedback"]);

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Имоти Надежда</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#8b1a2b;font-family:system-ui,sans-serif;padding:24px}
.card{max-width:520px;background:#fffaf3;border-radius:22px;padding:32px;box-shadow:0 24px 60px rgba(0,0,0,.28);color:#5a1220}
h1{font-size:24px;margin:0 0 12px}p{line-height:1.6;margin:0 0 10px;font-size:15px}
label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}
input,select,textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid rgba(139,26,43,.3);border-radius:12px;font-size:15px;color:#5a1220;background:#fff}
button{margin-top:18px;background:#8b1a2b;color:#f7e3c0;border:0;border-radius:12px;padding:12px 20px;font-size:15px;font-weight:700;cursor:pointer}
a{color:#8b1a2b}small{color:#8a7c7f}</style></head>
<body><div class="card"><h1>${title}</h1>${body}<p style="margin-top:20px"><small>Имоти Надежда · <a href="https://imotinadezhda.bg">imotinadezhda.bg</a></small></p></div></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

const esc = (s: string) =>
  s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );

export const Route = createFileRoute("/api/public/viewings/respond")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const action = url.searchParams.get("action") ?? "";
        if (!token || !ACTIONS.has(action))
          return page(
            "Невалиден линк",
            "<p>Линкът е непълен или изтекъл. Моля, свържете се с нас.</p>",
            400,
          );

        const v = await import("@/lib/viewings.server");
        const viewing = await v.getViewingByToken(token);
        if (!viewing) return page("Невалиден линк", "<p>Не намерихме такъв оглед.</p>", 404);
        const when = v.formatSofia(String(viewing.scheduled_at));
        const prop = (viewing as any).properties?.title ?? "имот";

        if (action === "confirm") {
          if (String(viewing.status) === "cancelled")
            return page(
              "Огледът е отменен",
              "<p>Този оглед вече е отменен. Свържете се с нас за нов час.</p>",
            );
          await v.confirmViewing(String(viewing.id), "клиент през линк");
          return page(
            "Благодарим — потвърдено!",
            `<p>Очакваме Ви за оглед на <strong>${esc(String(prop))}</strong> на <strong>${esc(when)}</strong>.</p><p>Ако нещо се промени, просто ни се обадете.</p>`,
          );
        }

        if (action === "cancel") {
          return page(
            "Отказ на оглед",
            `<form method="post"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="cancel">
<p>Оглед на <strong>${esc(String(prop))}</strong> — ${esc(when)}.</p>
<label>Причина (по желание)</label><input name="reason" maxlength="300" placeholder="Например: зает съм в този час">
<button type="submit">Откажи огледа</button></form>`,
          );
        }

        if (action === "reschedule") {
          const slots = await v.suggestSlots({
            agentId: (viewing as any).agent_id ?? null,
            limit: 12,
          });
          const options = slots
            .map((s) => `<option value="${s.start}">${esc(v.formatSofia(s.start))}</option>`)
            .join("");
          return page(
            "Друг час за оглед",
            `<form method="post"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="reschedule">
<p>Текущ час: <strong>${esc(when)}</strong>. Изберете нов свободен час:</p>
<label>Нов час</label><select name="slot" required>${options || '<option value="">Няма свободни часове</option>'}</select>
<button type="submit">Пренасрочи</button></form>`,
          );
        }

        return page(
          "Обратна връзка за огледа",
          `<form method="post"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="feedback">
<p>Как Ви се стори <strong>${esc(String(prop))}</strong>?</p>
<label>Оценка</label><select name="rating"><option value="5">5 — много ми хареса</option><option value="4">4 — харесва ми</option><option value="3" selected>3 — приемливо</option><option value="2">2 — не съвсем</option><option value="1">1 — не е за мен</option></select>
<label>Коментар</label><textarea name="feedback" rows="4" maxlength="1000" placeholder="Какво търсите различно?"></textarea>
<button type="submit">Изпрати</button></form>`,
        );
      },

      POST: async ({ request }) => {
        const form = await request.formData();
        const token = String(form.get("token") ?? "");
        const action = String(form.get("action") ?? "");
        if (!token || !ACTIONS.has(action))
          return page("Невалидна заявка", "<p>Липсват данни.</p>", 400);

        const v = await import("@/lib/viewings.server");
        const viewing = await v.getViewingByToken(token);
        if (!viewing) return page("Невалиден линк", "<p>Не намерихме такъв оглед.</p>", 404);

        if (action === "cancel") {
          await v.cancelViewing(
            String(viewing.id),
            String(form.get("reason") ?? "").slice(0, 300) || "Отказ от клиента",
            "клиент през линк",
          );
          return page(
            "Огледът е отменен",
            "<p>Отбелязахме отказа. Ще Ви предложим друг час или други подходящи имоти.</p>",
          );
        }

        if (action === "reschedule") {
          const slot = String(form.get("slot") ?? "");
          if (!slot) return page("Липсва час", "<p>Моля, изберете свободен час.</p>", 400);
          const res = await v.rescheduleViewing(String(viewing.id), slot, "клиент през линк");
          if (!res.ok)
            return page(
              "Часът не е свободен",
              `<p>${esc(res.reason ?? "Опитайте отново.")}</p>`,
              409,
            );
          return page(
            "Пренасрочено",
            `<p>Новият час е <strong>${esc(v.formatSofia(slot))}</strong>. Ще получите потвърждение по имейл.</p>`,
          );
        }

        const rating = Number(form.get("rating"));
        await v.saveViewingFeedback(
          String(viewing.id),
          Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null,
          String(form.get("feedback") ?? "").slice(0, 1000) || null,
        );
        return page(
          "Благодарим за обратната връзка!",
          "<p>Записахме мнението Ви — брокерът ще подбере по-точни предложения.</p>",
        );
      },
    },
  },
});
