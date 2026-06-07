/**
 * Slug & link integrity tests.
 *
 * Гарантира, че всеки квартал, който е линкнат от началната страница
 * (или от Шумен home page), съществува в базата с точно същия slug.
 * Това предотвратява грешки от тип „Кварталът не е намерен".
 *
 * Изпълнение: bunx vitest run src/lib/slug-validation.test.ts
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  "https://zcrzxgzyptqibsajoece.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjcnp4Z3p5cHRxaWJzYWpvZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDgwMjMsImV4cCI6MjA5NTgyNDAyM30.jHsY0umR0xZi0AKT9nNWAB34hRh84VrgjkIt52CuLo8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Slugs от site-а (Шумен) — трябва да съвпадат 1:1 със slug в quarters
const SHUMEN_LINKED_SLUGS = [
  "tsentar",
  "trakiya",
  "boyan-balgaranov-1",
  "boyan-balgaranov-2",
  "bolnitsata",
  "herson",
  "pazara",
  "dobrudzhanski",
  "pozharnata",
  "voenno-uchilishte",
];

describe("Slug integrity: site ↔ database", () => {
  it("всички градове са с уникални slug-ове", async () => {
    const { data, error } = await supabase.from("cities").select("slug");
    expect(error).toBeNull();
    const slugs = (data ?? []).map((c: any) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("всички квартали са с уникални slug-ове в рамките на града", async () => {
    const { data, error } = await supabase
      .from("quarters")
      .select("slug, city_id");
    expect(error).toBeNull();
    const seen = new Set<string>();
    for (const q of data ?? []) {
      const key = `${(q as any).city_id}:${(q as any).slug}`;
      expect(seen.has(key), `Дублиран slug в града: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("slug-овете не съдържат невалидни символи", async () => {
    const { data } = await supabase.from("quarters").select("slug");
    const re = /^[a-z0-9-]+$/;
    for (const q of data ?? []) {
      expect((q as any).slug, `Невалиден slug: ${(q as any).slug}`).toMatch(re);
    }
  });

  it("всички квартали, линкнати от Шумен home page, съществуват в базата", async () => {
    const { data: shumen } = await supabase
      .from("cities")
      .select("id")
      .eq("slug", "shumen")
      .single();
    expect(shumen, "Градът Шумен трябва да съществува").toBeTruthy();

    const { data: quarters } = await supabase
      .from("quarters")
      .select("slug")
      .eq("city_id", (shumen as any).id);

    const dbSlugs = new Set((quarters ?? []).map((q: any) => q.slug));
    const missing = SHUMEN_LINKED_SLUGS.filter((s) => !dbSlugs.has(s));
    expect(
      missing,
      `Липсват квартали в базата: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("всеки публикуван квартал има публикуван град-родител", async () => {
    const { data } = await supabase
      .from("quarters")
      .select("slug, is_published, cities:city_id(slug, is_published)")
      .eq("is_published", true);
    const orphans = (data ?? []).filter(
      (q: any) => !q.cities || q.cities.is_published === false,
    );
    expect(
      orphans.map((o: any) => o.slug),
      "Публикувани квартали без публикуван град",
    ).toEqual([]);
  });
});
