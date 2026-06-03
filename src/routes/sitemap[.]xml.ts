import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://imotinadezhda.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/search", changefreq: "weekly", priority: "0.5" },
        ];

        try {
          const { data: cities } = await supabaseAdmin
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

          const { data: quarters } = await supabaseAdmin
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

          const { data: properties } = await supabaseAdmin
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
        } catch {
          // Fall back to static entries on DB error
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
