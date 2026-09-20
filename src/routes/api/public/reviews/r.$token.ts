// Автоматизация №14 — публична страница за оценка (звезди + отзив) с токен.
import { createFileRoute } from "@tanstack/react-router";

const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Оценете „Имоти Надежда“</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#fffaf2; font-family: system-ui,-apple-system,"Segoe UI",sans-serif; color:#3a2b2e; }
  .wrap { max-width:640px; margin:0 auto; padding:28px 18px 60px; }
  .card { background:#fdf7ec; border:1px solid #e6d3ae; border-radius:18px; padding:24px; }
  .brand { background:#8b1a2b; color:#fffaf2; border-radius:14px; padding:16px 20px; margin-bottom:22px; }
  .brand small { letter-spacing:2px; font-size:11px; display:block; }
  .brand strong { font-size:22px; }
  h1 { font-size:22px; color:#8b1a2b; margin:0 0 8px; }
  p { line-height:1.6; margin:0 0 14px; }
  .stars { display:flex; gap:8px; justify-content:center; margin:18px 0; }
  .stars button { font-size:38px; line-height:1; background:none; border:none; cursor:pointer; color:#dcc8a0; padding:0; }
  .stars button.on { color:#c9a84c; }
  textarea { width:100%; min-height:110px; border:1px solid #e6d3ae; border-radius:12px; padding:12px; font:inherit; color:#3a2b2e; background:#fffaf2; }
  .btn { display:inline-block; background:#8b1a2b; color:#fffaf2; border:none; padding:12px 26px; border-radius:999px; font-weight:600; font-size:15px; cursor:pointer; text-decoration:none; }
  .muted { color:#7a6a5c; font-size:13px; }
  .hidden { display:none; }
</style></head>
<body><div class="wrap"><div class="brand"><small>НЕДВИЖИМИ ИМОТИ</small><strong>НАДЕЖДА</strong></div><div class="card">${body}</div>
<p class="muted" style="text-align:center;margin-top:18px">„Имоти Надежда“ · imotinadezhda.bg</p></div></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );

function ratingForm(name: string, token: string, preset: number | null) {
  return `<h1>Здравейте, ${name}!</h1>
<p>Благодарим Ви за доверието към „Имоти Надежда“. Как бихте оценили работата ни?</p>
<form method="post" action="/api/public/reviews/r/${token}">
  <input type="hidden" name="rating" id="rating" value="${preset ?? ""}"/>
  <div class="stars" id="stars">
    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-v="${n}" class="${preset && n <= preset ? "on" : ""}">★</button>`).join("")}
  </div>
  <div id="fbox" class="${preset ? "" : "hidden"}">
    <p class="muted" id="fhint">Разкажете ни накратко за Вашето преживяване (по желание).</p>
    <textarea name="feedback" placeholder="Вашият коментар..."></textarea>
  </div>
  <div style="text-align:center;margin-top:18px"><button class="btn" type="submit">Изпрати оценка</button></div>
</form>
<script>
  var stars = document.querySelectorAll('#stars button');
  stars.forEach(function (b) {
    b.addEventListener('click', function () {
      var v = Number(b.getAttribute('data-v'));
      document.getElementById('rating').value = String(v);
      stars.forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-v')) <= v); });
      document.getElementById('fbox').classList.remove('hidden');
      document.getElementById('fhint').textContent = v >= 4
        ? 'Благодарим! Може да добавите няколко думи, които да публикуваме.'
        : 'Съжаляваме! Моля, споделете какво можем да подобрим — ще се свържем с Вас.';
    });
  });
</script>`;
}

export const Route = createFileRoute("/api/public/reviews/r/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { registerClick } = await import("@/lib/reviews.server");
        const req = await registerClick(params.token);
        if (!req)
          return html(
            `<h1>Линкът е невалиден</h1><p>Моля, свържете се с нас на imotinadezhda.bg.</p>`,
            404,
          );
        const url = new URL(request.url);
        const presetRaw = Number(url.searchParams.get("rating") ?? 0);
        const preset = presetRaw >= 1 && presetRaw <= 5 ? presetRaw : null;
        return html(ratingForm(req.contact_name ?? "клиент", params.token, preset));
      },
      POST: async ({ params, request }) => {
        const form = await request.formData();
        const rating = Number(form.get("rating") ?? 0);
        const feedback = String(form.get("feedback") ?? "");
        if (!(rating >= 1 && rating <= 5)) {
          return html(
            `<h1>Липсва оценка</h1><p>Моля, изберете от 1 до 5 звезди.</p><p><a class="btn" href="/api/public/reviews/r/${params.token}">Назад</a></p>`,
            400,
          );
        }
        try {
          const { submitRating } = await import("@/lib/reviews.server");
          const res = await submitRating({ token: params.token, rating, feedback });
          if (res.redirect && res.review_url) {
            return html(
              `<h1>Благодарим за ${res.rating}/5!</h1><p>Ще ни помогнете много, ако споделите оценката си и в ${res.platform_name}.</p>
<p style="text-align:center"><a class="btn" href="${res.review_url}" rel="noopener">Публикувай в ${res.platform_name}</a></p>`,
            );
          }
          return html(
            `<h1>Благодарим за обратната връзка!</h1><p>Записахме Вашата оценка ${res.rating}/5. Наш брокер ще се свърже с Вас, за да разрешим случая.</p>`,
          );
        } catch (e) {
          return html(`<h1>Възникна грешка</h1><p>${(e as Error).message}</p>`, 400);
        }
      },
    },
  },
});
