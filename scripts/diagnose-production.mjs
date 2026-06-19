/**
 * Production smoke test — HTTP status + basic body checks.
 * Usage: node scripts/diagnose-production.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "https://imotinadezhda.bg";

const PUBLIC_PAGES = [
  "/",
  "/about",
  "/search",
  "/search?status=sale",
  "/search?status=rent",
  "/login",
  "/cities/shumen",
  "/cities/varna",
  "/cities/burgas",
  "/cities/nov-pazar",
  "/cities/shumen/around",
  "/cities/burgas/districts/lazur-burgas-bg",
  "/cities/varna/districts/briz-varna-bg",
  "/cities/shumen/districts/tsentar-shumen-bg",
  "/robots.txt",
  "/manifest.webmanifest",
  "/sitemap.xml",
  "/sw.js",
];

const MEDIA = [
  "/media/assets-v1/297ee429-0020-4355-8097-81c58a132732/home-hero-4k.mp4",
  "/media/assets-v1/7ce07196-c19d-48e1-bb40-d19f1f5c24a0/shumen-hero.mp4",
  "/media/assets-v1/b9b5fd44-8a3c-4346-a7d6-5c82c25bc946/varna-hero-4k.mp4",
  "/media/assets-v1/068b26b3-7934-475b-8748-c9b6ecd75694/burgas-hero.mp4",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/",
  "/admin/properties",
  "/admin/clients",
  "/admin/inquiries",
  "/admin/tasks",
  "/admin/calendar",
  "/admin/chat",
  "/admin/marketing",
  "/admin/matches",
  "/admin/contracts",
  "/admin/finance",
  "/admin/brokers",
  "/admin/owners",
  "/admin/contacts",
  "/admin/cities",
  "/admin/quarters",
  "/admin/documents",
  "/admin/extracted",
  "/admin/database",
  "/admin/audit",
  "/admin/ai",
  "/admin/dns",
  "/admin/profile",
  "/admin/rules",
  "/admin/settings",
  "/admin/settings/theme",
  "/admin/settings/images",
  "/admin/settings/page-editor",
  "/admin/settings/page-builder",
  "/admin/debug/quarters",
];

async function fetchCheck(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow", ...opts });
    const text = opts.method === "HEAD" ? "" : await res.text().catch(() => "");
    const fail =
      res.status >= 500 ||
      (opts.expectStatus && res.status !== opts.expectStatus) ||
      (opts.mustInclude && !text.includes(opts.mustInclude)) ||
      (opts.mustNotInclude && text.includes(opts.mustNotInclude));
    return { path, status: res.status, ok: !fail, detail: fail ? opts.failReason ?? "check failed" : "ok" };
  } catch (e) {
    return { path, status: 0, ok: false, detail: String(e.message ?? e) };
  }
}

async function main() {
  const results = [];

  // Dynamic property URLs from sitemap
  const sm = await fetch(`${BASE}/sitemap.xml`);
  const smText = await sm.text();
  const props = [...smText.matchAll(/<loc>([^<]*\/properties\/[^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(BASE, ""),
  );

  for (const p of PUBLIC_PAGES) {
    results.push(
      await fetchCheck(p, {
        mustNotInclude: "This page didn't load",
        failReason: "error boundary",
      }),
    );
  }

  for (const p of props.slice(0, 4)) {
    results.push(await fetchCheck(p, { mustNotInclude: "This page didn't load", failReason: "error boundary" }));
  }

  for (const p of MEDIA) {
    results.push(await fetchCheck(p, { method: "HEAD", failReason: "media missing" }));
  }

  for (const p of ADMIN_PAGES) {
    results.push(
      await fetchCheck(p, {
        mustNotInclude: "This page didn't load",
        failReason: "admin shell error",
      }),
    );
  }

  // APIs
  results.push(
    await fetchCheck("/api/public/hooks/task-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      expectStatus: 200,
      failReason: "task-reminders failed",
    }),
  );

  results.push(
    await fetchCheck("/api/public/customer-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_token: "diag-token-12345678",
        message: "ping",
      }),
      failReason: "customer-chat failed",
    }),
  );

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(JSON.stringify({ base: BASE, total: results.length, passed: passed.length, failed: failed.length, failedItems: failed }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main();
