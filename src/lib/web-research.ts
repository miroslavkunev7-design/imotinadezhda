export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function duckDuckGoSearch(
  query: string,
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ImotiNadezhda-Research/1.0)",
      "Accept-Language": "bg,en;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("Search failed: " + res.status);
  const html = await res.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const blockRe =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && results.length < 6) {
    let url = m[1];
    const uddg = url.match(/uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    results.push({ title: stripHtml(m[2]), url, snippet: stripHtml(m[3]) });
  }
  return results;
}

export async function fetchUrlContent(url: string): Promise<{ url: string; title: string; text: string } | { error: string }> {
  if (!/^https?:\/\//i.test(url)) return { error: "Невалиден URL" };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ImotiNadezhda-Research/1.0)",
        "Accept-Language": "bg,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { error: "HTTP " + res.status };
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) {
      return { error: "Неподдържан тип съдържание: " + ct };
    }
    const html = await res.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return { url, title: titleM ? stripHtml(titleM[1]) : "", text: stripHtml(html).slice(0, 6000) };
  } catch (e: any) {
    return { error: "Грешка при изтегляне: " + (e?.message ?? String(e)) };
  }
}
