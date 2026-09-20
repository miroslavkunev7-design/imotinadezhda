import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  ChevronLeft,
  Eye,
  FolderOpen,
  ListTodo,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  addClientDocument,
  deleteClientDocument,
  getClientDocuments,
  updateClientDeal,
} from "@/lib/crm.functions";
import { getLiveRate, monthlyPayment, type IncomeOrigin } from "@/lib/mortgage-rates";
import {
  listBankBranches,
  setBankBranchImage,
  getCityLocalTax,
  type BankBranchRow,
  type CityLocalTax,
} from "@/lib/bank-rates.functions";

import { BGN_PER_EUR, calcNotaryFees, money } from "@/lib/mortgage-calc";
import { MORTGAGE_DOC_REQS } from "@/lib/mortgage-docs";
import { MortgageDocsModal } from "@/components/admin/mortgage-docs-modal";

/** Банките в града — картите от референцията, с фирмения им цвят. */
const BANKS: { name: string; color: string; dark?: boolean }[] = [
  { name: "Банка ДСК", color: "#0b3d2e" },
  { name: "ОББ", color: "#0b4fa0" },
  { name: "УниКредит Булбанк", color: "#c11007" },
  { name: "Fibank", color: "#16356e" },
  { name: "Пощенска банка", color: "#f4c500", dark: true },
  { name: "Алианц Банк", color: "#003781" },
  { name: "ЦКБ", color: "#0e7a6d" },
  { name: "TBI Bank", color: "#e07b2a" },
  { name: "Инвестбанк", color: "#1f5fbf" },
];

/** Типични бланки, които банката иска като образци. */
const TYPICAL_TEMPLATES = [
  "Заявление за ипотечен кредит",
  "Декларация за семейно и имотно състояние",
  "Съгласие за ЦКР и GDPR",
  "Декларация ЗМИП",
];

const CONTACT_ROLES = ["кредитен консултант", "клон мениджър", "оценител", "нотариус", "друго"];

type BankContact = { name: string; role: string; phone: string; email: string };
type BankForm = {
  price: string;
  amount: string;
  years: string;
  income: string;
  employer: string;
  property: string;
  note: string;
};

const EMPTY_FORM: BankForm = {
  price: "",
  amount: "",
  years: "25",
  income: "",
  employer: "",
  property: "",
  note: "",
};

function templateType(label: string) {
  return `bank_template:${label}`;
}

/** дд.мм.гггг от ISO дата. */
function fmtDay(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("bg-BG");
}

/**
 * Бързият път „Банка“ от картата на клиента:
 * 1) списък с банките в града (лихвата за деня),
 * 2) страница на избраната банка — табло с калкулатор и листчета,
 *    графи за ипотечен кредит, папка с образци и хора в банката.
 */
export function BankFlowModal({
  client,
  onClose,
  onPicked,
  onAddTask,
}: {
  client: any;
  onClose: () => void;
  onPicked?: (bank: string) => void;
  onAddTask?: (text: string) => void;
}) {
  const city: string = client?.cities?.name ?? "Шумен";
  const citySlug: string = client?.cities?.slug ?? "shumen";
  const [bank, setBank] = useState<string | null>(client?.mortgage_data?.bank ?? null);
  const [tab, setTab] = useState<"board" | "form" | "templates">("board");
  const [docsOpen, setDocsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [branches, setBranches] = useState<BankBranchRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [localTax, setLocalTax] = useState<CityLocalTax | null>(null);

  const origin: IncomeOrigin = (client?.mortgage_data?.income_origin ?? "bg") as IncomeOrigin;

  useEffect(() => {
    let alive = true;
    setLoadingBranches(true);
    void (async () => {
      try {
        const [rows, tax] = await Promise.all([
          listBankBranches({ data: { city_slug: citySlug } }),
          getCityLocalTax({ data: { city_slug: citySlug } }),
        ]);
        if (!alive) return;
        setBranches(rows ?? []);
        setLocalTax(tax ?? null);
      } catch (e: any) {
        if (alive) toast.error(e?.message ?? "Грешка при зареждане на клоновете");
      } finally {
        if (alive) setLoadingBranches(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [citySlug]);

  const branchOf = (name: string) => branches.find((b) => b.bank === name) ?? null;

  const openBank = async (name: string) => {
    setBank(name);
    setTab("board");
    if (client?.mortgage_data?.bank === name) return;
    setBusy(true);
    try {
      const row = branchOf(name);
      const rate = row ? (origin === "foreign" ? row.rate_foreign : row.rate_bg) : null;
      await updateClientDeal({
        data: {
          id: client.id,
          mortgage_data: {
            ...(client.mortgage_data ?? {}),
            bank: name,
            income_origin: origin,
            rate_date: new Date().toISOString().slice(0, 10),
            rate: client?.mortgage_data?.rate_manual
              ? client.mortgage_data.rate
              : rate !== null
                ? rate.toFixed(2)
                : null,
            rate_valid_from: row?.valid_from ?? null,
          },
        },
      });
      toast.success(`Запазена банка: ${name}`);
      onPicked?.(name);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setBusy(false);
    }
  };

  const addTask = (text: string) => {
    onAddTask?.(text);
    toast.success("Добавено към задачите на клиента.");
  };

  return (
    <div
      className="fixed inset-0 z-[86] flex items-center justify-center bg-[#8B1A2B]/55 p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Банки"
        className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-amber-500/40 bg-[#fdf6dc] shadow-2xl"
      >
        {!bank ? (
          <BankGrid
            city={city}
            client={client}
            origin={origin}
            busy={busy}
            branches={branches}
            loading={loadingBranches}
            onPick={openBank}
            onAddTask={() => addTask(`Ипотека за ${client.full_name} — избор на банка (${city})`)}
            onClose={onClose}
          />
        ) : (
          <BankDetail
            key={bank}
            bank={bank}
            city={city}
            client={client}
            origin={origin}
            branch={branchOf(bank)}
            localTax={localTax}
            tab={tab}
            setTab={setTab}
            onBack={() => setBank(null)}
            onAddTask={() => addTask(`Ипотека за ${client.full_name} — ${bank}: документи и графи`)}
            onOpenDocs={() => setDocsOpen(true)}
            onClose={onClose}
          />
        )}
      </div>

      {docsOpen && bank && (
        <MortgageDocsModal
          client={{ ...client, mortgage_data: { ...(client.mortgage_data ?? {}), bank } }}
          onClose={() => setDocsOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- списък */

function BankGrid({
  city,
  client,
  origin,
  busy,
  branches,
  loading,
  onPick,
  onAddTask,
  onClose,
}: {
  city: string;
  client: any;
  origin: IncomeOrigin;
  busy: boolean;
  branches: BankBranchRow[];
  loading: boolean;
  onPick: (bank: string) => void;
  onAddTask: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BankBranchRow[]>(branches);
  useEffect(() => setRows(branches), [branches]);

  const uploadImage = async (row: BankBranchRow, file: File) => {
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `bank-logos/${row.city_slug}/${row.bank.replace(/[^\p{L}\p{N}]+/gu, "-")}-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("property-images")
        .upload(path, file, { upsert: true });
      if (up.error) throw new Error(up.error.message);
      const url = supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;
      await setBankBranchImage({
        data: { bank: row.bank, city_slug: row.city_slug, image_url: url },
      });
      setRows((rs) => rs.map((r) => (r.bank === row.bank ? { ...r, image_url: url } : r)));
      toast.success(`Снимката за ${row.bank} е качена.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    }
  };

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-700/20 bg-[#f7e9b8] px-4 py-3">
        <div>
          <div className="font-display text-xl text-[#7a1226]">Банки в {city}</div>
          <div className="text-[11px] text-[#7a1226]/70">
            Ипотека за {client.full_name} · лихвата е тази, въведена за клона в {city}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddTask}
            className="flex items-center gap-1.5 rounded-full border border-[#7a1226]/30 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-[#7a1226] hover:bg-[#7a1226]/10"
          >
            <ListTodo className="h-3.5 w-3.5" /> Добавяне към задача
          </button>
          <button type="button" onClick={onClose} aria-label="Затвори" className="text-[#7a1226]">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#7a1226]">
            <Loader2 className="h-4 w-4 animate-spin" /> Зареждам клоновете в {city}…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-[#7a1226]/20 bg-white/70 px-4 py-6 text-center text-sm text-[#7a1226]">
            Няма въведени клонове за {city}. Добави ги от „Лихви по банки“.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((b) => {
              const rate = origin === "foreign" ? b.rate_foreign : b.rate_bg;
              const color = b.color ?? "#7a1226";
              const dark = color.toLowerCase() === "#f4c500";
              return (
                <div
                  key={b.bank}
                  className="group overflow-hidden rounded-lg border border-[#7a1226]/20 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-center gap-2 bg-[#2b2f38] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-50">
                    <Building2 className="h-3.5 w-3.5 flex-none opacity-80" />
                    <span className="truncate">{b.bank}</span>
                    <label className="ml-auto flex-none cursor-pointer font-normal normal-case text-amber-50/70 hover:text-amber-50">
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void uploadImage(b, f);
                        }}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(b.bank)}
                    style={{ backgroundColor: color, color: dark ? "#3d2f00" : "#ffffff" }}
                    className="w-full px-4 py-3 text-center disabled:opacity-60"
                  >
                    {b.image_url && (
                      <img
                        src={b.image_url}
                        alt={b.bank}
                        className="mx-auto mb-2 h-14 w-full object-contain"
                        loading="lazy"
                      />
                    )}
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                      Клон {city}
                    </div>
                    <div className="font-display text-lg leading-tight">{b.bank}</div>
                    <div className="mt-1 text-[11px] opacity-85">
                      {b.branch_label ?? `${city} — клон ${b.bank}`}
                    </div>
                    <div className="mt-1 text-[11px] font-bold italic opacity-90">
                      {rate !== null
                        ? `лихва ${rate.toFixed(2)}% · към ${fmtDay(b.valid_from)}`
                        : "няма въведена лихва"}
                    </div>
                    {b.source && rate !== null && (
                      <div className="text-[10px] opacity-75">
                        {b.source === "announced" ? "обявена от банката" : "оферта от клона"}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- детайл */

function BankDetail({
  bank,
  city,
  client,
  origin,
  branch,
  localTax,
  tab,
  setTab,
  onBack,
  onAddTask,
  onOpenDocs,
  onClose,
}: {
  bank: string;
  city: string;
  client: any;
  origin: IncomeOrigin;
  branch: BankBranchRow | null;
  localTax: CityLocalTax | null;
  tab: "board" | "form" | "templates";
  setTab: (t: "board" | "form" | "templates") => void;
  onBack: () => void;
  onAddTask: () => void;
  onOpenDocs: () => void;
  onClose: () => void;
}) {
  const color = branch?.color ?? BANKS.find((b) => b.name === bank)?.color ?? "#7a1226";

  return (
    <>
      <div className="shrink-0 border-b border-amber-700/20 bg-[#f7e9b8] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-full border border-[#7a1226]/30 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-[#7a1226] hover:bg-[#7a1226]/10"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Банките
            </button>
            <button
              type="button"
              onClick={onAddTask}
              className="flex items-center gap-1.5 rounded-full border border-[#7a1226]/30 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-[#7a1226] hover:bg-[#7a1226]/10"
            >
              <ListTodo className="h-3.5 w-3.5" /> Към задача
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" className="text-[#7a1226]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="mt-2 rounded-md px-4 py-2.5 text-center"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-80">
            Клон {city}
          </div>
          <div className="font-display text-xl leading-tight">{bank}</div>
          <div className="text-[11px] opacity-85">
            {city} — клон {bank}
          </div>
        </div>
        <div className="mt-2 rounded-md border border-[#7a1226]/15 bg-white/60 px-3 py-1.5 text-[11px] text-[#7a1226]/80">
          Щом качиш личната карта на {client.full_name}, системата я чете, проверява ЕГН-то и
          записва резултата за {bank}. Без карта проверката не тръгва.
        </div>
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["board", "Табло"],
              ["form", "Графи за ипотечен кредит"],
              ["templates", "Папка с образци"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                tab === key
                  ? "bg-[#7a1226] text-amber-50"
                  : "border border-[#7a1226]/25 bg-white/70 text-[#7a1226] hover:bg-[#7a1226]/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {tab === "board" && (
          <BoardTab
            bank={bank}
            client={client}
            origin={origin}
            branch={branch}
            city={city}
            localTax={localTax}
            onOpenDocs={onOpenDocs}
          />
        )}

        {tab === "form" && <FormTab bank={bank} client={client} />}
        {tab === "templates" && <TemplatesTab bank={bank} client={client} />}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- табло */

function BoardTab({
  bank,
  client,
  origin,
  branch,
  city,
  localTax,
  onOpenDocs,
}: {
  bank: string;
  client: any;
  origin: IncomeOrigin;
  branch: BankBranchRow | null;
  city: string;
  localTax: CityLocalTax | null;
  onOpenDocs: () => void;
}) {
  const md = client?.mortgage_data ?? {};
  const today = useMemo(() => new Date(), []);
  const fallbackBg = getLiveRate(bank, "bg", today);
  const fallbackForeign = getLiveRate(bank, "foreign", today);
  const liveBg = {
    rate: branch?.rate_bg ?? fallbackBg.rate,
    validFrom: branch?.valid_from ?? fallbackBg.validFrom,
  };
  const liveForeign = {
    rate: branch?.rate_foreign ?? fallbackForeign.rate,
    validFrom: branch?.valid_from ?? fallbackForeign.validFrom,
  };
  const live = origin === "foreign" ? liveForeign : liveBg;

  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [years, setYears] = useState("25");
  const [payment, setPayment] = useState<number | null>(null);
  const [notary, setNotary] = useState<ReturnType<typeof calcNotaryFees> | null>(null);

  const calcPayment = () => {
    const a = Number(amount);
    const y = Number(years);
    if (!a || !y) return toast.error("Въведи сума и срок.");
    setPayment(monthlyPayment(a, live.rate, y));
  };

  const calcNotary = () => {
    const p = Number(price);
    if (!p) return toast.error("Въведи цена на имота.");
    setNotary(
      calcNotaryFees({
        price: p,
        loanAmount: Number(amount) || undefined,
        currency: "EUR",
        withMortgage: Number(amount) > 0,
        localTaxRate: localTax?.local_tax_rate,
      }),
    );
  };

  return (
    <div className="space-y-3">
      <div className="font-display text-base text-[#7a1226]">Табло — калкулатор и листчета</div>
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Кредитен калкулатор */}
        <div className="rounded-lg border border-[#7a1226]/20 bg-white/70 p-3">
          <div className="text-sm font-bold text-[#3d0a15]">Кредитен калкулатор</div>
          <p className="mt-0.5 text-[11px] text-[#7a1226]/70">
            Смята се по избраната лихва на {bank}: {live.rate.toFixed(2)}%.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#7a1226] px-2.5 py-1 text-[10px] font-semibold text-amber-50">
              Пълна отг. {liveBg.rate.toFixed(2)}%
            </span>
            <span className="rounded-full border border-[#7a1226]/30 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#7a1226]">
              Доходи от чужбина {liveForeign.rate.toFixed(2)}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <label className="space-y-0.5">
              <span className="font-semibold text-[#7a1226]/80">Сума (EUR)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-[#7a1226]/25 bg-white px-2 py-1.5"
              />
            </label>
            <label className="space-y-0.5">
              <span className="font-semibold text-[#7a1226]/80">Срок: {years || "—"} г.</span>
              <input
                value={years}
                onChange={(e) => setYears(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-md border border-[#7a1226]/25 bg-white px-2 py-1.5"
              />
            </label>
            <label className="space-y-0.5">
              <span className="font-semibold text-[#7a1226]/80">Цена имот (EUR)</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-[#7a1226]/25 bg-white px-2 py-1.5"
              />
            </label>
            <div className="space-y-0.5">
              <span className="font-semibold text-[#7a1226]/80">Лихва</span>
              <div className="rounded-md border border-[#7a1226]/15 bg-[#f7e9b8] px-2 py-1.5 font-bold">
                {live.rate.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={calcPayment}
              className="flex-1 rounded-full bg-[#7a1226] px-3 py-2 text-[11px] font-bold text-amber-50"
            >
              Изчисли вноска
            </button>
            <button
              type="button"
              onClick={calcNotary}
              className="flex-1 rounded-full border border-[#7a1226]/30 bg-white px-3 py-2 text-[11px] font-bold text-[#7a1226]"
            >
              Изчисли нотариус
            </button>
          </div>
          {payment !== null && (
            <div className="mt-2 rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-[#14532d]">
              Месечна вноска: {money(payment, "EUR")} при {live.rate.toFixed(2)}% за {years} г.
            </div>
          )}
          {notary && (
            <div className="mt-2 space-y-1 rounded-md border border-[#7a1226]/20 bg-[#fdf6dc] px-3 py-2 text-[11px] text-[#3d0a15]">
              {notary.lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="font-semibold">{money(l.amount, "EUR")}</span>
                </div>
              ))}
              <div className="flex justify-between gap-2 border-t border-[#7a1226]/15 pt-1 font-bold">
                <span>Общо</span>
                <span>{money(notary.total, "EUR")}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-[#7a1226]/15 pt-1">
                <span>Общо в лева</span>
                <span className="font-semibold">{money(notary.total * BGN_PER_EUR, "BGN")}</span>
              </div>
              <p className="pt-1 text-[10px] leading-snug text-[#7a1226]/70">
                Местен данък {city}:{" "}
                {localTax ? `${localTax.local_tax_rate.toFixed(2)}%` : "по подразбиране"}
                {localTax?.note ? ` · ${localTax.note}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Листче за деня */}
        <div className="relative -rotate-1 rounded-sm border border-amber-700/25 bg-[#f7ecc0] p-3 pt-5 shadow-md">
          <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-black/20 bg-red-700 shadow" />
          <div className="handwriting text-base font-bold text-[#3d0a15]">
            Днес — {today.toLocaleDateString("bg-BG")}
          </div>
          <div className="handwriting mt-1 text-sm text-[#3d0a15]/90">
            EUR → BGN: 1 = {BGN_PER_EUR.toFixed(5)}
          </div>
          <div className="mt-2 border-t border-[#3d0a15]/15 pt-2">
            <div className="handwriting text-sm font-bold text-[#3d0a15]">Лихва {bank} днес:</div>
            <div className="font-display text-3xl text-[#7a1226]">{liveBg.rate.toFixed(2)}%</div>
            <p className="mt-1 text-[10px] leading-snug text-[#7a1226]/70">
              взета автоматично днес · валидна от{" "}
              {new Date(liveBg.validFrom).toLocaleDateString("bg-BG")} · доходи от България
            </p>
          </div>
          <div className="mt-2 border-t border-[#3d0a15]/15 pt-2">
            <div className="handwriting text-sm font-bold text-[#3d0a15]">Доходи от чужбина:</div>
            <div className="font-display text-3xl text-[#7a1226]">
              {liveForeign.rate.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Документи за ипотека */}
        <div className="relative rotate-1 rounded-sm border border-amber-700/25 bg-[#f3e3b0] p-3 pt-5 shadow-md">
          <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-black/20 bg-red-700 shadow" />
          <div className="handwriting text-base font-bold text-[#3d0a15]">
            Документи за ипотека — {bank}
          </div>
          <div className="handwriting mt-1 text-sm font-bold text-[#3d0a15]/80">
            Доходи от България
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#3d0a15]/90">
            {MORTGAGE_DOC_REQS.map((r) => (
              <li key={r.id}>{r.label}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onOpenDocs}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-[#7a1226] px-3 py-2 text-[11px] font-bold text-amber-50"
          >
            <Paperclip className="h-3.5 w-3.5" /> Качи документите на {client.full_name}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- графи */

function FormTab({ bank, client }: { bank: string; client: any }) {
  const saved: BankForm = (client?.mortgage_data?.bank_forms?.[bank] as BankForm) ?? EMPTY_FORM;
  const [form, setForm] = useState<BankForm>({ ...EMPTY_FORM, ...saved });
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof BankForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const md = client.mortgage_data ?? {};
      await updateClientDeal({
        data: {
          id: client.id,
          mortgage_data: { ...md, bank_forms: { ...(md.bank_forms ?? {}), [bank]: form } },
        },
      });
      toast.success(`Графата за ${bank} е запазена при ${client.full_name}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-md border border-[#7a1226]/25 bg-white px-3 py-2 text-sm text-[#3d0a15] placeholder:text-[#7a1226]/40 focus:outline-none";

  return (
    <div className="space-y-3">
      <div>
        <div className="font-display text-base text-[#7a1226]">Графи за ипотечен кредит</div>
        <p className="text-[11px] text-[#7a1226]/70">Пазят се при клиента за {bank}.</p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">
            Цена на имота / сделката (EUR)
          </span>
          <input value={form.price} onChange={set("price")} inputMode="decimal" className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">Желана сума (EUR)</span>
          <input
            value={form.amount}
            onChange={set("amount")}
            inputMode="decimal"
            className={field}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">Срок (години)</span>
          <input value={form.years} onChange={set("years")} inputMode="numeric" className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">Месечен доход (EUR)</span>
          <input
            value={form.income}
            onChange={set("income")}
            inputMode="decimal"
            className={field}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">Работодател</span>
          <input value={form.employer} onChange={set("employer")} className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-[#3d0a15]">Имот / адрес</span>
          <input value={form.property} onChange={set("property")} className={field} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#3d0a15]">Бележка към банката</span>
        <textarea
          value={form.note}
          onChange={set("note")}
          rows={3}
          className={`${field} resize-none`}
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-[#7a1226] px-5 py-2.5 text-xs font-bold text-amber-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
        Запази графата
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- образци */

function TemplatesTab({ bank, client }: { bank: string; client: any }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<BankContact[]>(
    (client?.mortgage_data?.bank_contacts?.[bank] as BankContact[]) ?? [],
  );
  const [draft, setDraft] = useState<BankContact>({
    name: "",
    role: CONTACT_ROLES[0],
    phone: "",
    email: "",
  });

  const reload = useCallback(async () => {
    const rows = await getClientDocuments({ data: { client_id: client.id } });
    setDocs((rows ?? []).filter((d: any) => String(d.document_type).startsWith("bank_template:")));
  }, [client.id]);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (e: any) {
        toast.error(e?.message ?? "Грешка при зареждане");
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const docFor = (name: string) => docs.find((d) => d.document_type === templateType(name));

  const upload = async (file: File, name: string) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${templateType(name).replace(/:/g, "_")}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) return toast.error(upErr.message);
      const { data: signed } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({
        data: {
          client_id: client.id,
          document_type: templateType(name),
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
        },
      });
      await reload();
      toast.success(`Качен образец: ${name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setBusy(false);
      setLabel("");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Да изтрия ли образеца?")) return;
    try {
      await deleteClientDocument({ data: { id } });
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    }
  };

  const saveContacts = async (next: BankContact[]) => {
    const md = client.mortgage_data ?? {};
    await updateClientDeal({
      data: {
        id: client.id,
        mortgage_data: { ...md, bank_contacts: { ...(md.bank_contacts ?? {}), [bank]: next } },
      },
    });
    setContacts(next);
  };

  const addContact = async () => {
    if (!draft.name.trim()) return toast.error("Въведи име.");
    try {
      await saveContacts([...contacts, { ...draft, name: draft.name.trim() }]);
      setDraft({ name: "", role: CONTACT_ROLES[0], phone: "", email: "" });
      toast.success("Контактът е добавен.");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    }
  };

  const field =
    "w-full rounded-md border border-[#7a1226]/25 bg-white px-3 py-2 text-sm text-[#3d0a15] placeholder:text-[#7a1226]/40 focus:outline-none";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 font-display text-base text-[#7a1226]">
          <FolderOpen className="h-4 w-4" /> Папка с образци
        </div>
        <p className="mt-0.5 text-[11px] text-[#7a1226]/70">
          Ако банката е качила бланки — сложи ги тук с ясно име. Типични за {bank}:
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#7a1226]/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Зареждане…
        </div>
      ) : (
        <div className="space-y-1.5">
          {TYPICAL_TEMPLATES.map((t) => {
            const doc = docFor(t);
            return (
              <div
                key={t}
                className="flex items-center justify-between gap-2 rounded-md border border-[#7a1226]/15 bg-white/70 px-3 py-2"
              >
                <span className="text-sm text-[#3d0a15]">{t}</span>
                {doc ? (
                  <span className="flex items-center gap-1">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-emerald-600 p-1.5 text-white"
                      title="Виж файла"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(doc.id)}
                      className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                      title="Изтрий"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span className="text-[11px] italic text-[#7a1226]/50">няма качен файл</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Надпис на образеца, напр. Заявление за жилищен кредит"
          className={field}
        />
        <button
          type="button"
          disabled={busy || !label.trim()}
          onClick={() => fileInput.current?.click()}
          className="flex flex-none items-center gap-1.5 rounded-full bg-[#7a1226] px-4 py-2 text-[11px] font-bold text-amber-50 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Качи
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && label.trim()) void upload(f, label.trim());
            e.target.value = "";
          }}
        />
      </div>

      {/* Хора в банката */}
      <div className="rounded-lg border border-[#7a1226]/15 bg-white/60 p-3">
        <div className="text-sm font-bold text-[#3d0a15]">Хора в банката</div>
        {contacts.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md border border-[#7a1226]/15 bg-white px-3 py-2 text-[12px]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#3d0a15]">
                    {c.name} <span className="font-normal text-[#7a1226]/60">· {c.role}</span>
                  </div>
                  <div className="truncate text-[11px] text-[#7a1226]/70">
                    {c.phone || "—"} {c.email ? `· ${c.email}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void saveContacts(contacts.filter((_, j) => j !== i))}
                  className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                  title="Изтрий контакта"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Име"
            className={field}
          />
          <select
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
            className={field}
          >
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            placeholder="Телефон"
            className={field}
          />
          <input
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="Имейл (напр. ...@abv.bg)"
            className={field}
          />
        </div>
        <button
          type="button"
          onClick={addContact}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#7a1226]/25 bg-white px-3 py-2 text-[11px] font-bold text-[#7a1226] hover:bg-[#7a1226]/10"
        >
          <UserPlus className="h-3.5 w-3.5" /> Добави контакт
        </button>
      </div>
    </div>
  );
}
