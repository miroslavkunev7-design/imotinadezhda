import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SOURCES = ["realistimo", "imoti_bg", "olx", "bazar_bg", "home_bg", "alo_bg", "facebook"] as const;

function fc() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY не е конфигуриран. Свържете Firecrawl в Connectors.");
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

// Parse number from text like "85 000 EUR" → 85000
function parseNumber(text?: string | null): number | null {
  if (!text) return null;
  const m = String(text).replace(/[^\d]/g, "");
  return m ? Number(m) : null;
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
};

async function scrapeRealistimo(client: Firecrawl, citySlug: string): Promise<ScrapeResult[]> {
  const cityName = CITY_QUERY[citySlug];
  if (!cityName) return [];
  // Use search to find listings in the city, with content scraping
  const results: ScrapeResult[] = [];
  try {
    const res: any = await client.search(`site:realistimo.com продажба апартамент ${cityName} собственик`, {
      limit: 8,
      scrapeOptions: { formats: ["markdown"] },
    });
    const items = res?.web ?? res?.data ?? [];
    for (const item of items) {
      const url = item.url ?? item.link;
      if (!url || !/realistimo\.com/.test(url)) continue;
      const md = item.markdown ?? item.description ?? "";
      const sellerType = detectSellerType(md + " " + (item.title ?? ""));
      results.push({
        source: "realistimo",
        source_url: url,
        title: item.title ?? "Имот от Realistimo",
        description: typeof md === "string" ? md.slice(0, 800) : undefined,
        price: parseNumber(md.match(/(\d[\d\s]{3,})\s*(EUR|евро|лв|BGN)/i)?.[1]),
        currency: /BGN|лв/i.test(md) ? "BGN" : "EUR",
        area_sqm: parseNumber(md.match(/(\d{2,4})\s*(?:m2|m²|кв\.?м)/i)?.[1]),
        phone: md.match(/(\+?359[\s\d-]{7,}|0[\s\d-]{8,})/)?.[1]?.replace(/\s+/g, "") ?? undefined,
        images: [],
        city_slug: citySlug,
        seller_type: sellerType,
      });
    }
  } catch (e) {
    console.error("Realistimo scrape error:", e);
  }
  return results;
}

async function scrapeImotiBg(client: Firecrawl, citySlug: string): Promise<ScrapeResult[]> {
  const cityName = CITY_QUERY[citySlug];
  if (!cityName) return [];
  const results: ScrapeResult[] = [];
  try {
    const res: any = await client.search(`site:imoti.bg продажба апартамент ${cityName} собственик`, {
      limit: 8,
      scrapeOptions: { formats: ["markdown"] },
    });
    const items = res?.web ?? res?.data ?? [];
    for (const item of items) {
      const url = item.url ?? item.link;
      if (!url || !/imoti\.bg/.test(url)) continue;
      const md = item.markdown ?? "";
      results.push({
        source: "imoti_bg",
        source_url: url,
        title: item.title ?? "Имот от Imoti.bg",
        description: typeof md === "string" ? md.slice(0, 800) : undefined,
        price: parseNumber(md.match(/(\d[\d\s]{3,})\s*(EUR|евро|лв|BGN)/i)?.[1]),
        currency: /BGN|лв/i.test(md) ? "BGN" : "EUR",
        area_sqm: parseNumber(md.match(/(\d{2,4})\s*(?:m2|m²|кв\.?м)/i)?.[1]),
        phone: md.match(/(\+?359[\s\d-]{7,}|0[\s\d-]{8,})/)?.[1]?.replace(/\s+/g, "") ?? undefined,
        images: [],
        city_slug: citySlug,
        seller_type: detectSellerType(md + " " + (item.title ?? "")),
      });
    }
  } catch (e) {
    console.error("Imoti.bg scrape error:", e);
  }
  return results;
}

async function scrapeGeneric(
  client: Firecrawl,
  source: typeof SOURCES[number],
  domainQuery: string,
  citySlug: string,
): Promise<ScrapeResult[]> {
  const cityName = CITY_QUERY[citySlug];
  if (!cityName) return [];
  const results: ScrapeResult[] = [];
  try {
    const res: any = await client.search(`site:${domainQuery} ${cityName} апартамент продажба`, {
      limit: 5,
      scrapeOptions: { formats: ["markdown"] },
    });
    const items = res?.web ?? res?.data ?? [];
    for (const item of items) {
      const url = item.url ?? item.link;
      if (!url) continue;
      const md = item.markdown ?? "";
      results.push({
        source,
        source_url: url,
        title: item.title ?? `Имот от ${domainQuery}`,
        description: typeof md === "string" ? md.slice(0, 800) : undefined,
        price: parseNumber(md.match(/(\d[\d\s]{3,})\s*(EUR|евро|лв|BGN)/i)?.[1]),
        currency: /BGN|лв/i.test(md) ? "BGN" : "EUR",
        area_sqm: parseNumber(md.match(/(\d{2,4})\s*(?:m2|m²|кв\.?м)/i)?.[1]),
        phone: md.match(/(\+?359[\s\d-]{7,}|0[\s\d-]{8,})/)?.[1]?.replace(/\s+/g, "") ?? undefined,
        images: [],
        city_slug: citySlug,
        seller_type: detectSellerType(md + " " + (item.title ?? "")),
      });
    }
  } catch (e) {
    console.error(`${source} scrape error:`, e);
  }
  return results;
}

export const runScrape = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sources: z.array(z.enum(SOURCES)).default([...SOURCES]),
        cities: z.array(z.string()).default(["burgas", "varna", "shumen", "novi_pazar"]),
        privateOnly: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const client = fc();
    const allResults: ScrapeResult[] = [];

    for (const citySlug of data.cities) {
      for (const source of data.sources) {
        let batch: ScrapeResult[] = [];
        if (source === "realistimo") batch = await scrapeRealistimo(client, citySlug);
        else if (source === "imoti_bg") batch = await scrapeImotiBg(client, citySlug);
        else if (source === "olx") batch = await scrapeGeneric(client, "olx", "olx.bg", citySlug);
        else if (source === "bazar_bg") batch = await scrapeGeneric(client, "bazar_bg", "bazar.bg", citySlug);
        else if (source === "home_bg") batch = await scrapeGeneric(client, "home_bg", "home.bg", citySlug);
        else if (source === "alo_bg") batch = await scrapeGeneric(client, "alo_bg", "alo.bg", citySlug);
        else if (source === "facebook") {
          // Facebook groups require login — skip for now, add as TODO
          batch = [];
        }
        allResults.push(...batch);
      }
    }

    // Filter private-only if requested
    const filtered = data.privateOnly
      ? allResults.filter((r) => r.seller_type === "private" || r.seller_type === "unknown")
      : allResults;

    // Resolve city_id mapping
    const { data: cities } = await supabaseAdmin.from("cities").select("id, slug");
    const cityMap = new Map((cities ?? []).map((c) => [c.slug, c.id]));

    // Upsert into extracted_listings
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
            status: "pending",
          },
          { onConflict: "source,source_url", ignoreDuplicates: true },
        );
      if (error) {
        skipped++;
      } else {
        inserted++;
      }
    }

    return {
      ok: true,
      total_found: allResults.length,
      after_private_filter: filtered.length,
      inserted,
      skipped,
    };
  });

export const listExtracted = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ status: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
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
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("extracted_listings").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishExtracted = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
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
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("extracted_listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
