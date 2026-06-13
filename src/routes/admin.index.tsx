import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MessageSquare, Star, MapPin, CheckCircle, Mail, Download, Layers, Crown } from "lucide-react";
import { DocScanner } from "@/components/admin/doc-scanner";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type Stats = {
  total_properties: number;
  published_properties: number;
  featured_properties: number;
  total_inquiries: number;
  new_inquiries: number;
  total_cities: number;
  total_quarters: number;
  pending_extracted: number;
  total_owners: number;
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }),
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("is_featured", true),
      supabase.from("inquiries").select("id", { count: "exact", head: true }),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("cities").select("id", { count: "exact", head: true }),
      supabase.from("quarters").select("id", { count: "exact", head: true }),
      supabase.from("extracted_listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("owners").select("id", { count: "exact", head: true }),
    ]).then(([a, b, c, d, e, f, g, h, i]) => {
      setStats({
        total_properties: a.count ?? 0,
        published_properties: b.count ?? 0,
        featured_properties: c.count ?? 0,
        total_inquiries: d.count ?? 0,
        new_inquiries: e.count ?? 0,
        total_cities: f.count ?? 0,
        total_quarters: g.count ?? 0,
        pending_extracted: h.count ?? 0,
        total_owners: i.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: "Общо имоти", value: stats?.total_properties, icon: Building2, accent: "from-amber-500/30 to-amber-300/20" },
    { label: "Публикувани", value: stats?.published_properties, icon: CheckCircle, accent: "from-emerald-500/30 to-emerald-300/20" },
    { label: "Препоръчани", value: stats?.featured_properties, icon: Star, accent: "from-yellow-500/30 to-amber-300/20" },
    { label: "Собственици", value: stats?.total_owners, icon: Crown, accent: "from-rose-500/30 to-amber-300/20" },
    { label: "Градове", value: stats?.total_cities, icon: MapPin, accent: "from-blue-500/30 to-cyan-300/20" },
    { label: "Квартали", value: stats?.total_quarters, icon: Layers, accent: "from-purple-500/30 to-fuchsia-300/20" },
    { label: "Извлечени (чакащи)", value: stats?.pending_extracted, icon: Download, accent: "from-orange-500/30 to-amber-300/20" },
    { label: "Общо запитвания", value: stats?.total_inquiries, icon: Mail, accent: "from-pink-500/30 to-rose-300/20" },
    { label: "Нови запитвания", value: stats?.new_inquiries, icon: MessageSquare, accent: "from-red-500/30 to-orange-300/20" },
  ];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <header>
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[#8B1A2B] font-semibold">Преглед</p>
        <h1 className="mt-1 font-display text-3xl text-[#8B1A2B] md:text-4xl">Дашборд</h1>
        <p className="mt-1 text-sm text-[#2b1418]/70">Ключови метрики на агенцията.</p>
      </header>
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#C9A84C]/40 bg-[#fbf6ea] p-5 shadow-[0_18px_45px_-20px_rgba(139,26,43,0.25)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-[10.5px] uppercase tracking-[0.22em] text-[#8B1A2B]">{c.label}</span>
              <c.icon className="h-5 w-5 text-[#C9A84C]" />
            </div>
            <div className="mt-3 font-display text-4xl text-[#8B1A2B]">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>

      <DocScanner />
    </div>
  );
}
