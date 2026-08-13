import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MessageSquare, Star, MapPin, CheckCircle, Mail, Download, Layers, Crown, AlertTriangle, Clock } from "lucide-react";
import { DocScanner } from "@/components/admin/doc-scanner";
import { DeskCalendar } from "@/components/admin/desk-calendar";

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
  const [overdue, setOverdue] = useState<Array<{ id: string; title: string; due_at: string | null }>>([]);
  const [dueToday, setDueToday] = useState<number>(0);
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

    const nowIso = new Date().toISOString();
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    supabase
      .from("broker_tasks")
      .select("id, title, due_at")
      .eq("is_completed", false)
      .lt("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(6)
      .then(({ data }) => setOverdue((data ?? []) as never));
    supabase
      .from("broker_tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .gte("due_at", nowIso)
      .lte("due_at", endOfDay.toISOString())
      .then(({ count }) => setDueToday(count ?? 0));
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
    <div className="flex min-w-0 flex-col gap-6 pr-1">
      <div className="min-w-0 w-full">
        <DeskCalendar />
      </div>
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
              <c.icon className="h-5 w-5 text-[#8B1A2B]" />
            </div>
            <div className="mt-3 font-display text-5xl font-bold text-black tabular-nums tracking-tight">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>

      {(overdue.length > 0 || dueToday > 0) && (
        <section className="rounded-2xl border border-[#8B1A2B]/30 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg text-[#8B1A2B]">
              <AlertTriangle className="h-5 w-5" /> Задачи, изискващи внимание
            </h2>
            <Link to="/admin/tasks" className="text-xs font-semibold text-[#8B1A2B] hover:underline">
              Виж всички →
            </Link>
          </div>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {overdue.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                <AlertTriangle className="h-3 w-3" /> {overdue.length} просрочени
              </span>
            )}
            {dueToday > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                <Clock className="h-3 w-3" /> {dueToday} за днес
              </span>
            )}
          </div>
          {overdue.length > 0 && (
            <ul className="space-y-1.5">
              {overdue.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-[#C9A84C]/30 bg-[#fbf6ea] px-3 py-2 text-sm">
                  <span className="truncate text-[#2b1418]">{t.title}</span>
                  <span className="ml-2 flex-none text-xs text-red-600">
                    {t.due_at ? new Date(t.due_at).toLocaleDateString("bg-BG", { day: "2-digit", month: "short" }) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <DocScanner />
    </div>
  );
}
