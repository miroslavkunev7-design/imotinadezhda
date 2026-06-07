import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Mail, Users, Send, Copy, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/marketing")({ component: MarketingAdmin });

type Audience = "clients" | "inquiries" | "mortgage";

function MarketingAdmin() {
  const [audience, setAudience] = useState<Audience>("clients");
  const [recipients, setRecipients] = useState<{ email: string; name: string }[]>([]);
  const [subject, setSubject] = useState("Имоти Надежда — новини");
  const [body, setBody] = useState("Здравейте,\n\n");
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadAudience = async (a: Audience) => {
    let q;
    if (a === "clients") q = supabase.from("clients").select("full_name,email").not("email", "is", null);
    else if (a === "inquiries") q = supabase.from("inquiries").select("name,email").not("email", "is", null);
    else q = supabase.from("mortgage_applications").select("full_name,email").not("email", "is", null);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const seen = new Set<string>();
    const list: { email: string; name: string }[] = [];
    for (const row of (data ?? []) as any[]) {
      const email = (row.email as string)?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      list.push({ email, name: row.full_name || row.name || "" });
    }
    setRecipients(list);
  };

  useEffect(() => { loadAudience(audience); }, [audience]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(50);
      setEmailLog(data ?? []);
      setLoading(false);
    })();
  }, []);

  const mailtoUrl = useMemo(() => {
    const bcc = recipients.map(r => r.email).slice(0, 50).join(",");
    return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [recipients, subject, body]);

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(recipients.map(r => r.email).join(", "));
      setCopied(true);
      toast.success(`${recipients.length} имейла копирани`);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Грешка при копиране"); }
  };

  const stats = useMemo(() => {
    const sent = emailLog.filter(e => e.status === "sent").length;
    const failed = emailLog.filter(e => e.status === "failed" || e.status === "bounced").length;
    return { sent, failed, total: emailLog.length };
  }, [emailLog]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-amber-100">Маркетинг</h1>
        <p className="text-sm text-amber-100/60">Бюлетини, кампании и история на изпратени имейли.</p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Изпратени" value={String(stats.sent)} />
        <Stat icon={<Mail className="h-5 w-5" />} label="Общо в лога" value={String(stats.total)} />
        <Stat icon={<Megaphone className="h-5 w-5" />} label="Грешки/Bounce" value={String(stats.failed)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-amber-100"><Send className="h-4 w-4" /> Композирай бюлетин</h2>

          <div className="mb-3">
            <div className="mb-1 text-xs text-amber-100/70">Аудитория</div>
            <div className="flex gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-0.5 text-xs">
              {([
                { v: "clients" as const, l: "Клиенти" },
                { v: "inquiries" as const, l: "Запитвания" },
                { v: "mortgage" as const, l: "Ипотечни" },
              ]).map(o => (
                <button key={o.v} onClick={() => setAudience(o.v)}
                  className={`flex-1 rounded-md px-3 py-1.5 transition ${audience === o.v ? "bg-amber-500/25 text-amber-100" : "text-amber-100/60 hover:text-amber-100"}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-100/60">
              <Users className="h-3.5 w-3.5" /> {recipients.length} получателя с имейл
            </div>
          </div>

          <label className="mb-2 block">
            <span className="text-xs text-amber-100/70">Тема</span>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-400" />
          </label>
          <label className="mb-3 block">
            <span className="text-xs text-amber-100/70">Съдържание</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className="mt-1 w-full rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-400" />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button asChild disabled={recipients.length === 0}>
              <a href={mailtoUrl}><Send className="h-4 w-4" /> Отвори в имейл клиент</a>
            </Button>
            <Button variant="outline" onClick={copyEmails} disabled={recipients.length === 0}>
              <Copy className="h-4 w-4" /> {copied ? "Копирани!" : "Копирай имейлите"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-amber-100/50">
            Mailto работи с до ~50 BCC адреса. За по-големи кампании използвай копираните имейли в имейл инструмент.
          </p>
        </section>

        <section className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
          <h2 className="mb-3 font-display text-lg text-amber-100">История на имейли</h2>
          {loading ? (
            <div className="py-6 text-center text-sm text-amber-100/55">Зареждане...</div>
          ) : emailLog.length === 0 ? (
            <div className="py-6 text-center text-sm text-amber-100/55">Все още няма изпратени имейли.</div>
          ) : (
            <ul className="divide-y divide-amber-500/15">
              {emailLog.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-amber-100">{e.recipient_email}</div>
                    <div className="text-[11px] text-amber-100/55">{e.template_name} · {new Date(e.created_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                    e.status === "sent" ? "bg-emerald-500/20 text-emerald-200" :
                    e.status === "failed" || e.status === "bounced" ? "bg-rose-500/20 text-rose-200" :
                    "bg-amber-500/20 text-amber-200"
                  }`}>{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-amber-300">{icon}<span className="text-xs uppercase text-amber-100/70">{label}</span></div>
      <div className="mt-2 font-display text-2xl text-amber-100">{value}</div>
    </div>
  );
}
