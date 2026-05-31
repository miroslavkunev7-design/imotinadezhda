import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MessageSquare, Star, MapPin, CheckCircle, Mail } from "lucide-react";

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
    ]).then(([a, b, c, d, e, f]) => {
      setStats({
        total_properties: a.count ?? 0,
        published_properties: b.count ?? 0,
        featured_properties: c.count ?? 0,
        total_inquiries: d.count ?? 0,
        new_inquiries: e.count ?? 0,
        total_cities: f.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: "Общо имоти", value: stats?.total_properties, icon: Building2 },
    { label: "Публикувани", value: stats?.published_properties, icon: CheckCircle },
    { label: "Препоръчани", value: stats?.featured_properties, icon: Star },
    { label: "Градове", value: stats?.total_cities, icon: MapPin },
    { label: "Общо запитвания", value: stats?.total_inquiries, icon: Mail },
    { label: "Нови запитвания", value: stats?.new_inquiries, icon: MessageSquare },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl text-accent-foreground">Табло</h1>
        <p className="mt-1 text-sm text-muted-foreground">Преглед на ключови метрики.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-primary/15 bg-card p-6 shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 font-display text-4xl text-accent-foreground">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
