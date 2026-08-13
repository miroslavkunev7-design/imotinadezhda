import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { safeAdmin } from "@/integrations/supabase/safe-admin";
import { siteUrl } from "@/lib/site-config";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/search", changefreq: "daily", priority: "0.8" },
  { path: "/buy", changefreq: "daily", priority: "0.9" },
  { path: "/sell", changefreq: "monthly", priority: "0.7" },
  { path: "/contacts", changefreq: "monthly", priority: "0.7" },
  { path: "/cities/shumen", changefreq: "daily", priority: "0.9" },
  { path: "/cities/varna", changefreq: "daily", priority: "0.9" },
  { path: "/cities/burgas", changefreq: "daily", priority: "0.9" },
  { path: "/cities/nov-pazar", changefreq: "daily", priority: "0.9" },
];

function buildSitemapXml(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${siteUrl(e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        try {
          const { data: cities } = await safeAdmin
            .from("cities")
            .select("slug, updated_at")
            .eq("is_published", true);
          for (const c of cities ?? []) {
            entries.push({
              path: `/cities/${c.slug}`,
              lastmod: (c as any).updated_at ?? undefined,
              changefreq: "weekly",
              priority: "0.8",
            });
          }

          const { data: quarters } = await safeAdmin
            .from("quarters")
            .select("slug, updated_at, cities:city_id(slug, is_published)")
            .eq("is_published", true);
          for (const q of quarters ?? []) {
            const citySlug = (q as any).cities?.slug;
            if (!citySlug || (q as any).cities?.is_published === false) continue;
            entries.push({
              path: `/cities/${citySlug}/districts/${q.slug}`,
              lastmod: (q as any).updated_at ?? undefined,
              changefreq: "weekly",
              priority: "0.7",
            });
          }

          const { data: properties } = await safeAdmin
            .from("properties")
            .select("id, updated_at")
            .eq("is_published", true);
          for (const p of properties ?? []) {
            entries.push({
              path: `/properties/${p.id}`,
              lastmod: (p as any).updated_at ?? undefined,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch (error) {
          console.error("[sitemap] DB lookup failed, returning static entries:", error);
        }

        const seen = new Set<string>();
        const unique = entries.filter((e) => {
          if (seen.has(e.path)) return false;
          seen.add(e.path);
          return true;
        });

        return new Response(buildSitemapXml(unique), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
