import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden — admin only");
}

const SOURCES = ["realistimo", "imoti_bg", "olx", "bazar_bg", "home_bg", "alo_bg", "facebook"] as const;

async function fc() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY не е конфигуриран. Свържете Firecrawl в Connectors.");
  // Dynamic import keeps this server-only package out of the client bundle
  // without needing rollup `external` (which breaks SSR module resolution).
  const { default: Firecrawl } = await import("@mendable/firecrawl-js");
  return new Firecrawl({ apiKey: key });
}

const CITY_QUERY: Record<string, string> = {
  burgas: "Бургас",
  varna: "Варна",
  shumen: "Шумен",
  novi_pazar: "Нови пазар",
};

// Heuristic — detect private seller from description text
function detectSellerType(text: string): "private" | "agency" | "unknown" {
  const t = (text || "").toLowerCase();
  if (/(собственик|без посредник|частник|частно лице|owner)/.test(t)) return "private";
  if (/(агенция|brokers|посредник|агенциа|realtor)/.test(t)) return "agency";
  return "unknown";
}

// Detect listings that are NOT real-estate (cars, motors, bikes, parts, services, etc.)
function isNonPropertyListing(text: string, url: string): boolean {
  const t = (text || "").toLowerCase();
  const u = (url || "").toLowerCase();
  // Block URLs that are not property categories
  if (/(youtube\.com|youtu\.be|facebook\.com\/watch|tiktok\.com|instagram\.com|vbox7)/.test(u)) return true;
  if (/\/(avtomobili|automobili|cars?|moto|motori|velosipedi|bike|elektronika|drehi|obuvki|igrachki|jobs?|rabota)\b/.test(u)) return true;
  // Block by keywords in title/body
  if (/\b(автомобил|кола|джип|бмв|мерцедес|ауди|пежо|опел|рено|тойота|мотор|скутер|велосипед|ремарке|джанти|гуми|части за|резервни части)\b/.test(t)) return true;
  // Block listings that are clearly services or rentals of equipment, not estates
  if (/(услуга|почистване|ремонт на коли|автосервиз|кредит без)/.test(t)) return true;
  return false;
}

// Detect that the listing IS a property (apartment/house/land/office/etc.)
function looksLikeProperty(text: string, url: string): boolean {
  const t = (text || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (/(апартамент|едностаен|двустаен|тристаен|четиристаен|многостаен|къща|вила|парцел|урегулиран|офис|магазин|етаж от къща|студио|мезонет|таванско|имот)/.test(t)) return true;
  if (/\/(apartament|imoti|nedvizhimi|imot|kashta|parcel|ofis|magazin)/.test(u)) return true;
  return false;
}

// Parse number from text like "85 000 EUR" → 85000
function parseNumber(text?: string | null): number | null {
  if (!text) return null;
  const m = String(text).replace(/[^\d]/g, "");
  return m ? Number(m) : null;
}

// Domains / keywords commonly used by competing agencies — skip listings that show their watermark/logo.
const AGENCY_KEYWORDS = [
  "logo", "watermark", "brand", "stamp",
  "address.bg", "luximmo", "bulgarianproperties", "imotiplus", "yavlena", "mirela",
  "imoti.net", "stoyanov", "homeland", "imoplus", "novahome", "primahome", "remax",
  "era-bulgaria", "imotibg", "domsi", "newestate", "arcobaleno", "imoti24",
  "suprimmo", "imoteka", "agencia", "agenciq",
];

function extractImages(html: string, baseUrl: string): { urls: string[]; agencyLogo: { detected: boolean; reason: string | null } } {
  if (!html) return { urls: [], agencyLogo: { detected: false, reason: null } };
  const urls = new Set<string>();
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let agencyHit: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let u = m[1];
    if (u.startsWith("//")) u = "https:" + u;
    else if (u.startsWith("/")) {
      try { u = new URL(u, baseUrl).toString(); } catch { continue; }
    }
    if (!/^https?:\/\//.test(u)) continue;
    if (/\.(svg|gif)$/i.test(u)) continue;
    const lower = u.toLowerCase();
    const hit = AGENCY_KEYWORDS.find((kw) => lower.includes(kw));
    if (hit) { if (!agencyHit) agencyHit = hit; continue; }
    if (/(icon|sprite|avatar|placeholder)/i.test(u)) continue;
    urls.add(u);
    if (urls.size >= 12) break;
  }
  // Also scan raw HTML for explicit "лого на агенция" mentions
  if (!agencyHit && /(агенция|агенциа|brokerage|estate agency)/i.test(html) && /<img[^>]+(logo|watermark)/i.test(html)) {
    agencyHit = "agency-html-mention";
  }
  return { urls: Array.from(urls), agencyLogo: { detected: !!agencyHit, reason: agencyHit } };
}


type ScrapeResult = {
  source: typeof SOURCES[number];
  source_url: string;
  title?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  area_sqm?: number | null;
  rooms?: number | null;
  phone?: string;
  images?: string[];
  city_slug?: string;
  seller_type: "private" | "agency" | "unknown";
  agency_logo_detected?: boolean;
  agency_logo_reason?: string | null;
};

function buildResult(
  source: typeof SOURCES[number],
  item: any,
  citySlug: string,
): ScrapeResult | null {
  const url = item.url ?? item.link;
  if (!url) return null;
  const md: string = (item.markdown ?? item.description ?? "") as string;
  const html: string = (item.html ?? item.rawHtml ?? "") as string;
  const combined = md + "\n" + html;
  const phone = combined.match(/(\+?359[\s\d-]{7,}|0[\s\d-]{8,})/)?.[1]?.replace(/\s+/g, "");
  const { urls: imgUrls, agencyLogo } = extractImages(html, url);
  return {
    source,
    source_url: url,
    title: item.title ?? `Имот от ${source}`,
    description: typeof md === "string" ? md.slice(0, 1500) : undefined,
    price: parseNumber(combined.match(/(\d[\d\s]{3,})\s*(EUR|евро|лв|BGN)/i)?.[1]),
    currency: /BGN|лв/i.test(combined) ? "BGN" : "EUR",
    area_sqm: parseNumber(combined.match(/(\d{2,4})\s*(?:m2|m²|кв\.?м)/i)?.[1]),
    phone,
    images: imgUrls,
    city_slug: citySlug,
    seller_type: detectSellerType(combined + " " + (item.title ?? "")),
    agency_logo_detected: agencyLogo.detected,
    agency_logo_reason: agencyLogo.reason,
  };
}


async function searchAndBuild(
  client: Awaited<ReturnType<typeof fc>>,
  source: typeof SOURCES[number],
  query: string,
  domainFilter: RegExp | null,
  citySlug: string,
  limit = 6,
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  try {
    const res: any = await client.search(query, {
      limit,
      tbs: "qdr:d", // Google: само резултати от последните 24 часа
      scrapeOptions: { formats: ["markdown", "html"] },
    });
    const items = res?.web ?? res?.data ?? [];
    for (const item of items) {
      const url = item.url ?? item.link;
      if (!url) continue;
      if (domainFilter && !domainFilter.test(url)) continue;
      const r = buildResult(source, item, citySlug);
      if (r) results.push(r);
    }
  } catch (e) {
    console.error(`${source} scrape error:`, e);
  }
  return results;
}


export const runScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sources: z.array(z.enum(SOURCES)).default([...SOURCES]),
        cities: z.array(z.string()).default(["burgas", "varna", "shumen", "novi_pazar"]),
        privateOnly: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const client = fc();
    const allResults: ScrapeResult[] = [];

    const SOURCE_MAP: Record<string, { domain: string; rx: RegExp }> = {
      realistimo: { domain: "realistimo.com", rx: /realistimo\.com/i },
      imoti_bg: { domain: "imoti.bg", rx: /imoti\.bg/i },
      olx: { domain: "olx.bg", rx: /olx\.bg/i },
      bazar_bg: { domain: "bazar.bg", rx: /bazar\.bg/i },
      home_bg: { domain: "home.bg", rx: /home\.bg/i },
      alo_bg: { domain: "alo.bg", rx: /alo\.bg/i },
    };

    for (const citySlug of data.cities) {
      const cityName = CITY_QUERY[citySlug];
      if (!cityName) continue;
      for (const source of data.sources) {
        if (source === "facebook") continue; // requires login
        const cfg = SOURCE_MAP[source];
        if (!cfg) continue;
        const query = `site:${cfg.domain} ${cityName} апартамент продажба собственик`;
        const batch = await searchAndBuild(client, source, query, cfg.rx, citySlug, source === "realistimo" || source === "imoti_bg" ? 8 : 5);
        allResults.push(...batch);
      }
    }


    // Filter: agency-logo, non-property (cars/youtube/etc.), property-only, private-only
    const filtered = allResults.filter((r) => {
      if (r.agency_logo_detected) return false;
      const text = `${r.title ?? ""} ${r.description ?? ""}`;
      if (isNonPropertyListing(text, r.source_url)) return false;
      if (!looksLikeProperty(text, r.source_url)) return false;
      if (data.privateOnly) return r.seller_type === "private" || r.seller_type === "unknown";
      return true;
    });
    const skippedAgencyLogo = allResults.filter((r) => r.agency_logo_detected).length;

    // Resolve city_id mapping
    const { data: cities } = await supabaseAdmin.from("cities").select("id, slug");
    const cityMap = new Map((cities ?? []).map((c) => [c.slug, c.id]));

    let inserted = 0;
    let skipped = 0;
    for (const r of filtered) {
      const cityId = r.city_slug ? cityMap.get(r.city_slug) : null;
      const { error } = await supabaseAdmin
        .from("extracted_listings")
        .upsert(
          {
            source: r.source,
            source_url: r.source_url,
            city_id: cityId ?? null,
            title: r.title ?? null,
            description: r.description ?? null,
            price: r.price ?? null,
            currency: r.currency ?? "EUR",
            area_sqm: r.area_sqm ?? null,
            phone: r.phone ?? null,
            images: r.images ?? [],
            seller_type: r.seller_type,
            agency_logo_detected: false,
            status: "pending",
          },
          { onConflict: "source,source_url", ignoreDuplicates: true },
        );
      if (error) skipped++; else inserted++;
    }

    return {
      ok: true,
      total_found: allResults.length,
      after_private_filter: filtered.length,
      skipped_agency_logo: skippedAgencyLogo,

      inserted,
      skipped,
    };
  });

export const listExtracted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("extracted_listings")
      .select("*, cities:city_id(name, slug), quarters:quarter_id(name, slug)")
      .order("scraped_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") {
      q = q.eq("status", data.status as any);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateExtracted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            title: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            price: z.number().optional().nullable(),
            currency: z.string().optional().nullable(),
            area_sqm: z.number().optional().nullable(),
            rooms: z.number().int().optional().nullable(),
            bedrooms: z.number().int().optional().nullable(),
            phone: z.string().optional().nullable(),
            quarter_id: z.string().uuid().optional().nullable(),
            city_id: z.string().uuid().optional().nullable(),
            status: z.enum(["pending", "approved", "rejected", "published"]).optional(),
            notes: z.string().optional().nullable(),
          })
          .partial(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("extracted_listings").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishExtracted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error: e1 } = await supabaseAdmin
      .from("extracted_listings")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1 || !row) throw new Error(e1?.message ?? "Не е намерен");
    if (!row.city_id) throw new Error("Първо изберете град за обявата.");

    const cover = Array.isArray(row.images) && row.images.length > 0 ? String(row.images[0]) : null;
    const { data: created, error: e2 } = await supabaseAdmin
      .from("properties")
      .insert({
        city_id: row.city_id,
        quarter_id: row.quarter_id ?? null,
        title: row.title ?? "Имот",
        description: row.description ?? null,
        price: row.price ?? 0,
        currency: row.currency ?? "EUR",
        area_sqm: row.area_sqm ?? null,
        bedrooms: row.bedrooms ?? null,
        cover_image_url: cover,
        is_published: false,
        is_featured: false,
        status: "sale",
        property_type: (row.property_type as any) ?? "apartment",
      })
      .select("id")
      .single();
    if (e2 || !created) throw new Error(e2?.message ?? "Грешка при създаване");

    // Add gallery images
    if (Array.isArray(row.images) && row.images.length > 0) {
      const imgRows = row.images.slice(0, 20).map((url, idx) => ({
        property_id: created.id,
        url: String(url),
        is_cover: idx === 0,
        display_order: idx,
      }));
      await supabaseAdmin.from("property_images").insert(imgRows);
    }

    await supabaseAdmin
      .from("extracted_listings")
      .update({ status: "published", published_property_id: created.id })
      .eq("id", data.id);

    return { ok: true, property_id: created.id };
  });

export const deleteExtracted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("extracted_listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
