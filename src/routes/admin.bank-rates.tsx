import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, RefreshCw } from "lucide-react";
import {
  listBankBranches,
  upsertBankBranchRate,
  getCityLocalTax,
  upsertCityLocalTax,
  listBankRateFetchLog,
  refreshBankRatesNow,
  type BankBranchRow,
  type CityLocalTax,
  type BankRateFetchLogRow,
} from "@/lib/bank-rates.functions";

export const Route = createFileRoute("/admin/bank-rates")({
  component: BankRatesPage,
  head: () => ({
    meta: [
      { title: "Лихви по банки — Имоти Надежда CRM" },
      {
        name: "description",
        content: "Въвеждане и обновяване на лихвите по банкови клонове за Шумен, Варна и Бургас.",
      },
      { property: "og:title", content: "Лихви по банки — Имоти Надежда CRM" },
      {
        property: "og:description",
        content: "Актуалните лихви по банкови клонове в CRM на Имоти Надежда.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CITIES = [
  { slug: "shumen", name: "Шумен" },
  { slug: "varna", name: "Варна" },
  { slug: "burgas", name: "Бургас" },
];

const WINE = "#7a1226";

type Draft = { rate_bg: string; rate_foreign: string; valid_from: string };

function BankRatesPage() {
  const load = useServerFn(listBankBranches);
  const save = useServerFn(upsertBankBranchRate);
  const loadTax = useServerFn(getCityLocalTax);
  const saveTaxFn = useServerFn(upsertCityLocalTax);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [city, setCity] = useState("shumen");
  const [rows, setRows] = useState<BankBranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingBank, setSavingBank] = useState<string | null>(null);
  const [localTax, setLocalTax] = useState<CityLocalTax | null>(null);
  const [taxDraft, setTaxDraft] = useState("");
  const [savingTax, setSavingTax] = useState(false);
  const loadLog = useServerFn(listBankRateFetchLog);
  const refreshNow = useServerFn(refreshBankRatesNow);
  const [log, setLog] = useState<BankRateFetchLogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadLog()
      .then((l) => alive && setLog(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadLog]);

  const runRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshNow();
      toast.success(
        `Обновени банки за ${res.day}: ${res.updated}` +
          (res.failed.length ? ` · без резултат: ${res.failed.join(", ")}` : ""),
      );
      const [fresh, freshLog] = await Promise.all([load({ data: { city_slug: city } }), loadLog()]);
      setRows(fresh);
      setLog(freshLog);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при обновяване");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([
      load({ data: { city_slug: city } }),
      loadTax({ data: { city_slug: city } }),
    ])
      .then(([data, tax]) => {
        if (!alive) return;
        setRows(data);
        const d: Record<string, Draft> = {};
        for (const r of data) {
          d[r.bank] = {
            rate_bg: r.rate_bg !== null ? r.rate_bg.toFixed(2) : "",
            rate_foreign: r.rate_foreign !== null ? r.rate_foreign.toFixed(2) : "",
            valid_from: r.valid_from ?? today,
          };
        }
        setDrafts(d);
        setLocalTax(tax ?? null);
        setTaxDraft(tax ? tax.local_tax_rate.toFixed(2) : "");
      })
      .catch((e: any) => toast.error(e?.message ?? "Грешка при зареждане"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [city, load, loadTax, today]);

  const saveTax = async () => {
    const v = Number(String(taxDraft).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 3) {
      toast.error("Ставката е между 0.1 и 3.00 по закон — напр. 3.00");
      return;
    }
    setSavingTax(true);
    try {
      await saveTaxFn({ data: { city_slug: city, local_tax_rate: v } });
      const fresh = await loadTax({ data: { city_slug: city } });
      setLocalTax(fresh ?? null);
      toast.success("Ставката на местния данък е записана.");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setSavingTax(false);
    }
  };

  const update = (bank: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({
      ...d,
      [bank]: { ...(d[bank] ?? { rate_bg: "", rate_foreign: "", valid_from: today }), ...patch },
    }));

  const submit = async (row: BankBranchRow) => {
    const d = drafts[row.bank];
    const bg = Number(String(d?.rate_bg ?? "").replace(",", "."));
    const fg = Number(String(d?.rate_foreign ?? "").replace(",", "."));
    if (!Number.isFinite(bg) || !Number.isFinite(fg) || bg <= 0 || fg <= 0) {
      toast.error("Въведи и двете лихви като число, напр. 2.35");
      return;
    }
    setSavingBank(row.bank);
    try {
      await save({
        data: {
          bank: row.bank,
          city_slug: city,
          rate_bg: bg,
          rate_foreign: fg,
          valid_from: d?.valid_from || today,
          source: "branch_offer",
          updated_by_name: "Оферта от клона",
        },
      });
      const fresh = await load({ data: { city_slug: city } });
      setRows(fresh);
      toast.success(`Лихвата за ${row.bank} е записана.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setSavingBank(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf6e3] px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl" style={{ color: WINE }}>
          Лихви по банки
        </h1>
        <p className="mt-1 text-sm text-[#7a1226]/75">
          Лихвата на клона се показва в картата на клиента за деня. Без въведена лихва картата пише
          „няма въведена лихва“ — примерни стойности не се показват.
        </p>

        <div className="mt-4 flex gap-2">
          {CITIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCity(c.slug)}
              aria-pressed={city === c.slug}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                city === c.slug
                  ? "bg-[#7a1226] text-amber-50"
                  : "border border-[#7a1226]/25 bg-white/70 text-[#7a1226] hover:bg-[#7a1226]/10"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#7a1226]/20 bg-white/80 px-4 py-3 text-sm text-[#3b2a12] shadow-sm">
          <span className="font-semibold text-[#7a1226]">
            Местен данък при прехвърляне ({CITIES.find((c) => c.slug === city)?.name}):
          </span>
          <input
            value={taxDraft}
            onChange={(e) => setTaxDraft(e.target.value)}
            inputMode="decimal"
            className="w-20 rounded-md border border-[#7a1226]/25 bg-white px-2 py-1"
          />
          <span>%</span>
          <button
            type="button"
            onClick={saveTax}
            disabled={savingTax}
            className="flex items-center gap-1.5 rounded-full bg-[#7a1226] px-3 py-1.5 text-[12px] font-bold text-amber-50 disabled:opacity-60"
          >
            {savingTax ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Запази ставката
          </button>
          <span className="text-[11px] text-[#7a1226]/70">
            {localTax?.note ?? "По наредба на общината — с тази ставка се смята нотариусът."}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-[#7a1226]/20 bg-white/80 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[#7a1226]">Автоматично обновяване</span>
            <span className="text-[12px] text-[#3b2a12]">
              Всяка сутрин в 06:00 системата чете страниците на банките и записва лихвата за деня
              (България и чужбина). Ръчно въведена оферта от клон за същия ден не се презаписва.
            </span>
            <button
              type="button"
              onClick={runRefresh}
              disabled={refreshing}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#7a1226] px-3 py-1.5 text-[12px] font-bold text-amber-50 disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Обнови сега
            </button>
          </div>
          {log.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-[12px]">
              {log.map((l, i) => (
                <li key={`${l.bank}-${l.fetched_at}-${i}`} className="flex flex-wrap gap-2">
                  <span className={l.ok ? "text-emerald-700" : "text-rose-700"}>
                    {l.ok ? "✓" : "✕"}
                  </span>
                  <span className="font-semibold text-[#7a1226]">{l.bank}</span>
                  <span className="text-[#3b2a12]">
                    {new Date(l.fetched_at).toLocaleString("bg-BG")}
                  </span>
                  {l.rate_bg !== null && (
                    <span className="text-[#3b2a12]">
                      BG {l.rate_bg.toFixed(2)}%
                      {l.rate_foreign !== null ? ` · чужбина ${l.rate_foreign.toFixed(2)}%` : ""}
                    </span>
                  )}
                  <span className="text-[#7a1226]/70">
                    {l.cities_updated} града
                    {l.skipped_manual ? ` · ${l.skipped_manual} с ръчна оферта` : ""}
                  </span>
                  {l.error && <span className="text-rose-700">{l.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#7a1226]/20 bg-white/80 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#7a1226]">
              <Loader2 className="h-4 w-4 animate-spin" /> Зареждам…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#7a1226]">
              Няма клонове за този град.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f7e9b8] text-left text-[12px] uppercase tracking-wide text-[#7a1226]">
                  <th className="px-3 py-2">Банка / клон</th>
                  <th className="px-3 py-2">Лихва — доход България</th>
                  <th className="px-3 py-2">Лихва — доход чужбина</th>
                  <th className="px-3 py-2">Валидна от</th>
                  <th className="px-3 py-2">Източник</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = drafts[r.bank] ?? { rate_bg: "", rate_foreign: "", valid_from: today };
                  return (
                    <tr key={r.bank} className="border-t border-[#7a1226]/10 text-[#3b2a12]">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[#7a1226]">{r.bank}</div>
                        <div className="text-[11px] opacity-70">{r.branch_label ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={d.rate_bg}
                          onChange={(e) => update(r.bank, { rate_bg: e.target.value })}
                          placeholder="напр. 2.35"
                          className="w-28 rounded border border-[#7a1226]/25 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={d.rate_foreign}
                          onChange={(e) => update(r.bank, { rate_foreign: e.target.value })}
                          placeholder="напр. 2.95"
                          className="w-28 rounded border border-[#7a1226]/25 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={d.valid_from}
                          onChange={(e) => update(r.bank, { valid_from: e.target.value })}
                          className="rounded border border-[#7a1226]/25 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {r.source === "announced"
                          ? "обявена от банката"
                          : r.source
                            ? "оферта от клона"
                            : "—"}
                        {r.updated_by_name ? (
                          <div className="opacity-60">{r.updated_by_name}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={savingBank === r.bank}
                          onClick={() => void submit(r)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#7a1226] px-3 py-1.5 text-[12px] font-semibold text-amber-50 disabled:opacity-60"
                        >
                          {savingBank === r.bank ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Запази
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
