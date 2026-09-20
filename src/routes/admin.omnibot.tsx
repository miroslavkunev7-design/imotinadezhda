import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  BarChart3,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  BookOpen,
  Home,
} from "lucide-react";
import {
  botAnalyticsFn,
  getBotSettingsFn,
  listBotChannels,
  listBotConversations,
  listBotEvents,
  listBotKnowledge,
  listBotMessages,
  replyAsAgentFn,
  saveBotSettingsFn,
  setBotConversationStatusFn,
  suggestBotPropertiesFn,
  summarizeBotConversationFn,
  updateBotChannelFn,
  upsertBotKnowledgeFn,
} from "@/lib/omnibot.functions";

export const Route = createFileRoute("/admin/omnibot")({ component: OmniBotAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");

const CHANNEL_LABEL: Record<string, string> = {
  web: "Сайт",
  viber: "Viber",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
};
const STATUS_LABEL: Record<string, string> = {
  open: "отворен",
  bot: "AI бот",
  handoff: "при брокер",
  closed: "затворен",
};
const STATUS_CLASS: Record<string, string> = {
  open: "bg-sky-100 text-sky-900",
  bot: "bg-emerald-100 text-emerald-900",
  handoff: "bg-amber-100 text-amber-900",
  closed: "bg-stone-200 text-stone-800",
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
      <div className="text-2xl font-bold text-[#8b1a2b]">{value}</div>
      <div className="text-sm font-medium text-[#3a2b2e]">{label}</div>
      {hint ? <div className="mt-1 text-xs text-[#7a6a5c]">{hint}</div> : null}
    </div>
  );
}

function OmniBotAdmin() {
  const [tab, setTab] = useState<"inbox" | "channels" | "knowledge" | "analytics" | "log">("inbox");
  const [conversations, setConversations] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [showCfg, setShowCfg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [suggested, setSuggested] = useState<any[]>([]);

  const [kQuestion, setKQuestion] = useState("");
  const [kAnswer, setKAnswer] = useState("");
  const [kKeywords, setKKeywords] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [cv, ch, kb, ev, an, st] = await Promise.all([
        listBotConversations({ data: {} }),
        listBotChannels(),
        listBotKnowledge(),
        listBotEvents(),
        botAnalyticsFn(),
        getBotSettingsFn(),
      ]);
      setConversations(cv as any[]);
      setChannels(ch as any[]);
      setKnowledge(kb as any[]);
      setEvents(ev as any[]);
      setAnalytics(an);
      setSettings(st);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setSuggested([]);
    try {
      const rows = await listBotMessages({ data: { conversationId: id } });
      setThread(rows as any[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      if (activeId) await openConversation(activeId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channelFilter && c.channel_code !== channelFilter) return false;
      if (!q) return true;
      return [
        c.display_name,
        c.contact_phone,
        c.contact_email,
        c.external_user_id,
        c.intent,
        c.status,
      ].some((v: any) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [conversations, query, channelFilter]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#8b1a2b] text-[#f6e7c1]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#8b1a2b]">AI Асистент 24/7</h1>
            <p className="text-sm text-[#5b4a44]">
              Сайт, Viber, WhatsApp и Messenger в единна инбокс кутия.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
          <button
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8b1a2b] px-3 py-2 text-sm font-semibold text-[#f6e7c1] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Обнови
          </button>
        </div>
      </header>

      {showCfg && settings ? (
        <section className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-4">
          {[
            ["enabled", "Ботът е активен"],
            ["ai_enabled", "AI отговори"],
            ["capture_lead", "Създавай лийдове"],
            ["summary_enabled", "AI резюмета"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-medium text-[#3a2b2e]">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <label className="text-sm font-medium text-[#3a2b2e]">
            Прехвърляне след N съобщения
            <input
              type="number"
              value={settings.handoff_after_messages ?? 12}
              onChange={(e) =>
                setSettings({ ...settings, handoff_after_messages: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
            />
          </label>
          <div className="md:col-span-4">
            <button
              onClick={() =>
                act(() => saveBotSettingsFn({ data: settings }), "Настройките са запазени")
              }
              className="rounded-lg bg-[#8b1a2b] px-4 py-2 text-sm font-semibold text-[#f6e7c1]"
            >
              Запази
            </button>
          </div>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {[
          ["inbox", "Инбокс", Send],
          ["channels", "Канали", Bot],
          ["knowledge", "База знания", BookOpen],
          ["analytics", "Анализи", BarChart3],
          ["log", "Журнал", Sparkles],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === key
                ? "bg-[#8b1a2b] text-[#f6e7c1]"
                : "border border-[#e6d3ae] bg-[#fdf7ec] text-[#8b1a2b]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "inbox" ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b1a2b]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Търси контакт…"
                  className="w-full rounded-lg border border-[#e6d3ae] bg-white py-2 pl-9 pr-3 text-sm text-[#3a2b2e]"
                />
              </div>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
              >
                <option value="">Всички канали</option>
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void openConversation(c.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    activeId === c.id
                      ? "border-[#8b1a2b] bg-[#fdf7ec]"
                      : "border-[#e6d3ae] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#8b1a2b]">
                      {c.display_name ?? c.external_user_id ?? "Анонимен"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[c.status] ?? ""}`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#5b4a44]">
                    <span>
                      {CHANNEL_LABEL[c.channel_code] ?? c.channel_code} · {c.messages_count ?? 0}{" "}
                      съобщ.
                    </span>
                    <span>{dt(c.last_message_at)}</span>
                  </div>
                </button>
              ))}
              {!filtered.length ? (
                <p className="rounded-xl border border-[#e6d3ae] bg-white p-6 text-center text-sm text-[#7a6a5c]">
                  Няма разговори.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            {!active ? (
              <p className="p-6 text-center text-sm text-[#7a6a5c]">
                Изберете разговор от списъка.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0e2c8] pb-3">
                  <div>
                    <div className="font-bold text-[#8b1a2b]">
                      {active.display_name ?? active.external_user_id}
                    </div>
                    <div className="text-xs text-[#5b4a44]">
                      {CHANNEL_LABEL[active.channel_code] ?? active.channel_code} · намерение:{" "}
                      {active.intent ?? "—"} ·{" "}
                      {active.contact_phone ?? active.contact_email ?? "без контакт"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        act(
                          () => summarizeBotConversationFn({ data: { conversationId: active.id } }),
                          "Готово резюме",
                        )
                      }
                      className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-1.5 text-xs font-semibold text-[#8b1a2b]"
                    >
                      AI резюме
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res: any = await suggestBotPropertiesFn({
                            data: { conversationId: active.id },
                          });
                          setSuggested(res?.results ?? []);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                      className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-1.5 text-xs font-semibold text-[#8b1a2b]"
                    >
                      Предложи имоти
                    </button>
                    <select
                      value={active.status}
                      onChange={(e) =>
                        act(
                          () =>
                            setBotConversationStatusFn({
                              data: { conversationId: active.id, status: e.target.value as any },
                            }),
                          "Статусът е обновен",
                        )
                      }
                      className="rounded-lg border border-[#e6d3ae] bg-white px-2 py-1.5 text-xs text-[#3a2b2e]"
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {active.ai_summary ? (
                  <p className="rounded-lg bg-[#fdf7ec] p-3 text-sm text-[#3a2b2e]">
                    <strong className="text-[#8b1a2b]">Резюме:</strong> {active.ai_summary}
                  </p>
                ) : null}

                <div className="max-h-[46vh] space-y-2 overflow-auto">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl p-3 text-sm ${
                        m.direction === "in"
                          ? "bg-[#f4efe6] text-[#3a2b2e]"
                          : "ml-auto bg-[#8b1a2b] text-[#f6e7c1]"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div
                        className={`mt-1 text-[10px] ${m.direction === "in" ? "text-[#7a6a5c]" : "text-[#e9cf9a]"}`}
                      >
                        {dt(m.created_at)} · {m.role}
                        {m.ai_used ? " · AI" : ""}
                        {m.error ? ` · грешка: ${m.error}` : ""}
                      </div>
                    </div>
                  ))}
                  {!thread.length ? (
                    <p className="text-sm text-[#7a6a5c]">Няма съобщения.</p>
                  ) : null}
                </div>

                {suggested.length ? (
                  <div className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#8b1a2b]">
                      <Home className="h-4 w-4" /> Подходящи имоти
                    </div>
                    <ul className="space-y-1 text-xs text-[#3a2b2e]">
                      {suggested.map((p: any) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span>
                            {p.title} — {p.price} {p.city ? `· ${p.city}` : ""}
                          </span>
                          <button
                            onClick={() =>
                              setReply(
                                (r) => `${r}${r ? "\n" : ""}${p.title} — ${p.price}: ${p.url}`,
                              )
                            }
                            className="rounded bg-[#8b1a2b] px-2 py-1 font-semibold text-[#f6e7c1]"
                          >
                            Добави
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Отговор от брокер…"
                    className="flex-1 rounded-lg border border-[#e6d3ae] bg-white p-3 text-sm text-[#3a2b2e]"
                  />
                  <button
                    disabled={busy || !reply.trim()}
                    onClick={() =>
                      act(async () => {
                        await replyAsAgentFn({
                          data: { conversationId: active.id, text: reply.trim() },
                        });
                        setReply("");
                      }, "Изпратено")
                    }
                    className="inline-flex items-center gap-2 self-end rounded-lg bg-[#8b1a2b] px-4 py-2 text-sm font-semibold text-[#f6e7c1] disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" /> Изпрати
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "channels" ? (
        <section className="grid gap-3 md:grid-cols-2">
          {channels.map((c) => (
            <div key={c.id} className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#8b1a2b]">{c.name}</h3>
                <span className="rounded-full bg-[#fdf7ec] px-2 py-0.5 text-xs font-semibold text-[#8b1a2b]">
                  {c.code}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#3a2b2e]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) =>
                      act(
                        () =>
                          updateBotChannelFn({
                            data: { id: c.id, patch: { is_active: e.target.checked } },
                          }),
                        "Обновено",
                      )
                    }
                  />
                  Активен
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.auto_reply}
                    onChange={(e) =>
                      act(
                        () =>
                          updateBotChannelFn({
                            data: { id: c.id, patch: { auto_reply: e.target.checked } },
                          }),
                        "Обновено",
                      )
                    }
                  />
                  Авто отговор
                </label>
              </div>
              <p className="mt-3 text-xs text-[#5b4a44]">
                <strong>Поздрав:</strong> {c.greeting ?? "—"}
              </p>
              <p className="mt-2 text-xs text-[#7a6a5c]">
                Webhook: <code>/api/public/hooks/{c.code === "web" ? "…" : c.code}</code>
              </p>
              <p className="mt-1 text-xs text-[#7a6a5c]">
                Прехвърляне при: {(c.handoff_keywords ?? []).join(", ") || "—"}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "knowledge" ? (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-3">
            <input
              value={kQuestion}
              onChange={(e) => setKQuestion(e.target.value)}
              placeholder="Въпрос"
              className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm text-[#3a2b2e]"
            />
            <input
              value={kKeywords}
              onChange={(e) => setKKeywords(e.target.value)}
              placeholder="Ключови думи (със запетая)"
              className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm text-[#3a2b2e]"
            />
            <button
              disabled={busy || !kQuestion.trim() || !kAnswer.trim()}
              onClick={() =>
                act(async () => {
                  await upsertBotKnowledgeFn({
                    data: {
                      question: kQuestion.trim(),
                      answer: kAnswer.trim(),
                      keywords: kKeywords
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  });
                  setKQuestion("");
                  setKAnswer("");
                  setKKeywords("");
                }, "Добавено в базата знания")
              }
              className="rounded-lg bg-[#8b1a2b] px-4 py-2 text-sm font-semibold text-[#f6e7c1] disabled:opacity-60"
            >
              Добави
            </button>
            <textarea
              value={kAnswer}
              onChange={(e) => setKAnswer(e.target.value)}
              rows={3}
              placeholder="Отговор"
              className="md:col-span-3 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm text-[#3a2b2e]"
            />
          </div>
          <div className="overflow-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Въпрос</th>
                  <th className="p-3">Отговор</th>
                  <th className="p-3">Ключови думи</th>
                  <th className="p-3">Активен</th>
                </tr>
              </thead>
              <tbody>
                {knowledge.map((k) => (
                  <tr key={k.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                    <td className="p-3 font-medium">{k.question}</td>
                    <td className="p-3 max-w-md text-xs">{k.answer}</td>
                    <td className="p-3 text-xs">{(k.keywords ?? []).join(", ")}</td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={k.is_active}
                        onChange={(e) =>
                          act(
                            () =>
                              upsertBotKnowledgeFn({
                                data: {
                                  id: k.id,
                                  question: k.question,
                                  answer: k.answer,
                                  keywords: k.keywords ?? [],
                                  is_active: e.target.checked,
                                },
                              }),
                            "Обновено",
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
                {!knowledge.length ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#7a6a5c]">
                      Няма записи.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Kpi label="Разговори" value={analytics.total_conversations} />
            <Kpi
              label="Съобщения"
              value={analytics.total_messages}
              hint={`средно ${analytics.avg_messages_per_conversation} / разговор`}
            />
            <Kpi label="Прехвърлени към брокер" value={analytics.handoffs} />
            <Kpi label="Създадени лийдове" value={analytics.leads_created} />
            <Kpi label="AI дял в отговорите" value={`${analytics.ai_reply_share}%`} />
            <Kpi label="Доставени съобщения" value={`${analytics.delivery_rate}%`} />
            <Kpi label="Средно време за отговор" value={`${analytics.avg_latency_ms} ms`} />
            <Kpi label="Оценка от клиенти" value={analytics.avg_satisfaction ?? "—"} hint="1–5" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-2 font-bold text-[#8b1a2b]">По канали</h3>
              <ul className="space-y-1 text-sm text-[#3a2b2e]">
                {Object.entries(analytics.by_channel ?? {}).map(([k, v]: any) => (
                  <li key={k} className="flex justify-between">
                    <span>{CHANNEL_LABEL[k] ?? k}</span>
                    <span className="text-xs">
                      {v.conversations} разг. · {v.messages} съобщ. · {v.handoffs} прехв. ·{" "}
                      {v.leads} лийда
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-2 font-bold text-[#8b1a2b]">Намерения</h3>
              <ul className="space-y-1 text-sm text-[#3a2b2e]">
                {Object.entries(analytics.intents ?? {}).map(([k, v]: any) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-xs">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                <th className="p-3">Дата</th>
                <th className="p-3">Тип</th>
                <th className="p-3">Канал</th>
                <th className="p-3">Съобщение</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                  <td className="p-3 text-xs">{dt(ev.created_at)}</td>
                  <td className="p-3 font-medium">{ev.event_type}</td>
                  <td className="p-3">
                    {CHANNEL_LABEL[ev.channel_code] ?? ev.channel_code ?? "—"}
                  </td>
                  <td className="p-3 max-w-lg text-xs text-[#5b4a44]">{ev.message ?? "—"}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#7a6a5c]">
                    Няма записи.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
