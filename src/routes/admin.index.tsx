import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MessageSquare, Star, MapPin, CheckCircle, Mail, Download, Layers } from "lucide-react";

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
    ]).then(([a, b, c, d, e, f, g, h]) => {
      setStats({
        total_properties: a.count ?? 0,
        published_properties: b.count ?? 0,
        featured_properties: c.count ?? 0,
        total_inquiries: d.count ?? 0,
        new_inquiries: e.count ?? 0,
        total_cities: f.count ?? 0,
        total_quarters: g.count ?? 0,
        pending_extracted: h.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: "Общо имоти", value: stats?.total_properties, icon: Building2, accent: "from-amber-500/30 to-amber-300/20" },
    { label: "Публикувани", value: stats?.published_properties, icon: CheckCircle, accent: "from-emerald-500/30 to-emerald-300/20" },
    { label: "Препоръчани", value: stats?.featured_properties, icon: Star, accent: "from-yellow-500/30 to-amber-300/20" },
    { label: "Градове", value: stats?.total_cities, icon: MapPin, accent: "from-blue-500/30 to-cyan-300/20" },
    { label: "Квартали", value: stats?.total_quarters, icon: Layers, accent: "from-purple-500/30 to-fuchsia-300/20" },
    { label: "Извлечени (чакащи)", value: stats?.pending_extracted, icon: Download, accent: "from-orange-500/30 to-amber-300/20" },
    { label: "Общо запитвания", value: stats?.total_inquiries, icon: Mail, accent: "from-pink-500/30 to-rose-300/20" },
    { label: "Нови запитвания", value: stats?.new_inquiries, icon: MessageSquare, accent: "from-red-500/30 to-orange-300/20" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl text-amber-100">Дашборд</h1>
        <p className="mt-1 text-sm text-amber-100/60">Преглед на ключови метрики на агенцията.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br ${c.accent} p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-amber-100/75">{c.label}</span>
              <c.icon className="h-5 w-5 text-amber-200" />
            </div>
            <div className="mt-3 font-display text-4xl text-amber-50">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
