// Shared internet helpers for Тед Асистент and the collector (not an endpoint: files starting with "_" are not served).
const UA = "Mozilla/5.0 (compatible; ImotiNadezhdaBot/1.0; +https://imotinadezhda.bg)";

function key() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY; }

/* Google Search through Gemini grounding: answer + sources */
async function webSearch(query) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key()), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Потърси в интернет и отговори кратко и точно на български, с конкретни данни (цени, дати, имена, телефони, адреси, линкове), ако ги има: " + String(query).slice(0, 500) }] }],
      tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } })
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  const c = (j.candidates || [])[0] || {};
  const text = ((c.content || {}).parts || []).map((p) => p.text || "").join("").trim();
  const chunks = ((c.groundingMetadata || {}).groundingChunks || []).map((g) => g.web).filter(Boolean).slice(0, 8).map((w) => ({ title: w.title, url: w.uri }));
  return { answer: text, sources: chunks };
}

async function robotsAllows(u) {
  try {
    const url = new URL(u);
    const r = await fetch(url.origin + "/robots.txt", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return true;
    const txt = await r.text(); let applies = false, dis = [];
    for (const line of txt.split(/\r?\n/)) {
      const l = line.replace(/#.*/, "").trim(); if (!l) continue;
      const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") applies = v === "*" || /imotinadezhda/i.test(v);
      else if (applies && k === "disallow" && v) dis.push(v);
    }
    return !dis.some((d) => d === "/" || url.pathname.startsWith(d.replace(/\*.*$/, "")));
  } catch (e) { return true; }
}

/* read a public web page as text (+ images and links) */
async function readPage(u, maxChars) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Само http/https адреси");
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)instagram\.com$/i.test(url.hostname)) {
    return { blocked: true, reason: "Facebook/Instagram изискват вход в профил – страницата не може да се прочете автоматично. Копирайте текста на поста или направете снимка на екрана и я прикачете.", url: u };
  }
  if (!(await robotsAllows(u))) return { blocked: true, reason: "Сайтът забранява автоматично четене на тази страница (robots.txt).", url: u };
  const r = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "bg,en;q=0.8", Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { blocked: true, reason: "Страницата върна грешка " + r.status, url: u };
  const buf = Buffer.from(await r.arrayBuffer());
  let html = buf.toString("utf8");
  if (/charset=windows-1251/i.test(r.headers.get("content-type") || "") || /<meta[^>]+charset=["']?windows-1251/i.test(html.slice(0, 3000))) html = new TextDecoder("windows-1251").decode(buf);
  const base = r.url || u;
  const abs = (x) => { try { return new URL(x.replace(/&amp;/g, "&"), base).href; } catch (e) { return null; } };
  const title = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "").replace(/\s+/g, " ").trim();
  const imgs = [...new Set([...html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)].map((m) => abs(m[1])).filter((x) => x && /\.(jpe?g|png|webp)(\?|$)/i.test(x) && !/logo|icon|sprite|avatar|banner|pixel/i.test(x)))].slice(0, 60);
  const links = [...new Set([...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map((m) => abs(m[1])).filter(Boolean))].slice(0, 300);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|p|div|li|tr|h\d|section|article)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, maxChars || 40000);
  return { url: base, title, text, images: imgs, links };
}

module.exports = { webSearch, readPage, key, UA };
