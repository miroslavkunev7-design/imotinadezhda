import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/inquiries")({
  component: InquiriesAdmin,
});

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  properties: { title: string } | null;
};

function InquiriesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = () => {
    supabase
      .from("inquiries")
      .select("*, properties:property_id(title)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  };
  useEffect(load, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("inquiries").update({ status: status as "new" | "in_progress" | "closed" }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-accent-foreground">Запитвания</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rows.length} общо</p>
      </header>
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl border border-primary/15 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-accent-foreground">{r.name} <span className="ml-2 text-sm text-muted-foreground">{r.email}</span></div>
                {r.phone && <div className="text-sm text-muted-foreground">{r.phone}</div>}
                {r.properties?.title && <div className="mt-1 text-xs text-primary">Имот: {r.properties.title}</div>}
                <div className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("bg-BG")}</div>
              </div>
              <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="rounded border border-input bg-background px-3 py-1 text-sm">
                <option value="new">Ново</option>
                <option value="in_progress">В процес</option>
                <option value="closed">Затворено</option>
              </select>
            </div>
            {r.message && <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>}
          </article>
        ))}
        {!rows.length && <p className="text-center text-muted-foreground">Няма запитвания</p>}
      </div>
    </div>
  );
}
