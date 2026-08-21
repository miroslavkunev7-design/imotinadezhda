import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Play, Square, RefreshCw, Users, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listBotDesk,
  setBotRunning,
  tickValentin,
  assignBotClients,
  analyzeAssignedClients,
  draftWhatsApp,
} from "@/lib/bot-brokers.functions";

export const Route = createFileRoute("/admin/bots")({
  component: BotBrokersPage,
});

type Desk = Awaited<ReturnType<typeof listBotDesk>>;

function BotBrokersPage() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const d = await listBotDesk();
      setDesk(d);
      const assigned = (d.assignments as Array<{ bot_id: string; client_id: string }>)
        .filter((a) => a.bot_id === "senior")
        .map((a) => a.client_id);
      setPicked(assigned.slice(0, 4));
    } catch (e: any) {
      toast.error(e?.message ?? "Не мога да заредя бот-брокерите");
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const valentin = desk?.agents?.find((a: { id: string }) => a.id === "valentin");
    if (!valentin?.is_running) return;
    const t = window.setInterval(() => {
      void tickValentin().then(load).catch((e) => {
        toast.message(e?.message ?? "Валентин спря");
        void load();
      });
    }, 180_000);
    return () => window.clearInterval(t);
  }, [desk?.agents]);

  const valentin = desk?.agents?.find((a: { id: string }) => a.id === "valentin");
  const senior = desk?.agents?.find((a: { id: string }) => a.id === "senior");
  const findings = (desk?.findings ?? []).filter((f: { bot_id: string }) => f.bot_id === "valentin");
  const seniorAssign = (desk?.assignments ?? []).filter((a: { bot_id: string }) => a.bot_id === "senior");

  const toggle = async (id: "valentin" | "senior", running: boolean) => {
    setBusy(id);
    try {
      await setBotRunning({ data: { id, running } });
      toast.success(running ? "Смяната започна." : "Спрян.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не стана");
    } finally {
      setBusy(null);
    }
  };

  const saveClients = async () => {
    if (!picked.length) { toast.error("Избери поне един клиент"); return; }
    setBusy("assign");
    try {
      await assignBotClients({ data: { bot_id: "senior", client_ids: picked.slice(0, 4) } });
      toast.success("Клиентите са прикачени.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не стана");
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    setBusy("analyze");
    try {
      const res = await analyzeAssignedClients({ data: { bot_id: "senior" } });
      const next: Record<string, string> = {};
      for (const a of res.analyses) next[a.client_id] = a.wa ?? a.text;
      setDrafts(next);
      toast.success("Анализът е готов.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Анализът се провали");
    } finally {
      setBusy(null);
    }
  };

  const sendWa = async (clientId: string) => {
    const body = drafts[clientId];
    if (!body) { toast.error("Няма чернова"); return; }
    setBusy(`wa-${clientId}`);
    try {
      const res = await draftWhatsApp({ data: { client_id: clientId, body } });
      if (res.sent) toast.success("Изпратено през WhatsApp Business API.");
      else if (res.waUrl) {
        window.open(res.waUrl, "_blank", "noopener");
        toast.success("Отворена е WhatsApp чернова. API ключ още няма — пращаш ръчно.");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "WhatsApp не тръгна");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl text-amber-100">
          <Bot className="h-7 w-7 text-amber-300" /> Бот-брокери
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-amber-100/70">
          Валентин обикаля порталите в смяна 08:30–17:30. Старшият брокер чете досието, предлага имоти и пише за оглед.
          От огледа нататък поемате вие. WhatsApp е през официалния Business API; докато ключовете ги няма — отваря се чернова.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-amber-400/25 bg-[rgba(20,4,8,0.55)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-amber-100">Валентин</h2>
              <p className="mt-1 text-xs text-amber-100/65">{valentin?.skill}</p>
              <p className="mt-2 text-xs text-amber-200/80">Смяна {valentin?.shift_start?.slice(0, 5) ?? "08:30"} – {valentin?.shift_end?.slice(0, 5) ?? "17:30"} (София)</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${valentin?.is_running ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-amber-100/70"}`}>
              {valentin?.is_running ? "В смяна" : "Спрян"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => toggle("valentin", true)} className="gold-cta-button">
              {busy === "valentin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Започни работа
            </Button>
            <Button disabled={!!busy} variant="outline" onClick={() => toggle("valentin", false)}>
              <Square className="h-4 w-4" /> Спри
            </Button>
            <Button disabled={!!busy || !valentin?.is_running} variant="outline" onClick={() => { setBusy("tick"); tickValentin().then(load).catch((e) => toast.error(e.message)).finally(() => setBusy(null)); }}>
              <RefreshCw className="h-4 w-4" /> Обиколи сега
            </Button>
            <Link to="/admin/extracted" className="inline-flex items-center gap-1 text-xs text-amber-200 underline-offset-2 hover:underline">
              Извлечени имоти <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-4 max-h-72 space-y-2 overflow-auto text-sm">
            {findings.length === 0 && <li className="text-amber-100/50">Още няма находки от днешната обиколка.</li>}
            {findings.map((f: { id: string; title: string; summary?: string; source_url?: string }) => (
              <li key={f.id} className="rounded-xl border border-amber-400/15 bg-black/20 px-3 py-2">
                <div className="font-medium text-amber-50">{f.title}</div>
                {f.summary && <p className="text-xs text-amber-100/60">{f.summary}</p>}
                {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer" className="text-xs text-amber-300">Източник</a>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-amber-400/25 bg-[rgba(20,4,8,0.55)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-amber-100">Старши брокер</h2>
              <p className="mt-1 text-xs text-amber-100/65">{senior?.skill}</p>
            </div>
            <Users className="h-5 w-5 text-amber-300" />
          </div>
          <p className="mt-3 text-xs text-amber-100/70">Прикачи до 4 клиента (обикновено 2). Ботът чете бележките и предлага варианти.</p>
          <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-amber-400/15 p-2">
            {(desk?.clients ?? []).map((c: { id: string; full_name: string; phone?: string }) => (
              <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-amber-50 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={picked.includes(c.id)}
                  onChange={() => setPicked((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id].slice(0, 4))}
                />
                <span className="flex-1 truncate">{c.full_name}</span>
                <span className="text-[11px] text-amber-100/50">{c.phone}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={saveClients} variant="outline">Запази прикачените</Button>
            <Button disabled={!!busy} onClick={analyze} className="gold-cta-button">
              {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Анализирай и предложи
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {seniorAssign.map((a: any) => {
              const c = a.clients;
              return (
                <div key={a.id} className="rounded-xl border border-amber-400/15 bg-black/20 p-3">
                  <div className="font-medium text-amber-50">{c?.full_name ?? "Клиент"}</div>
                  {a.last_analysis && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-amber-100/80">{a.last_analysis}</pre>}
                  <textarea
                    className="mt-2 w-full rounded-lg border border-amber-400/20 bg-black/30 p-2 text-xs text-amber-50"
                    rows={3}
                    placeholder="Чернова за WhatsApp"
                    value={drafts[a.client_id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.client_id]: e.target.value }))}
                  />
                  <Button size="sm" className="mt-2" disabled={!!busy} onClick={() => sendWa(a.client_id)}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
