import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calculator,
  ChevronLeft,
  Eye,
  FolderOpen,
  IdCard,
  ListTodo,
  Loader2,
  Paperclip,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

import { MortgageDocsModal } from "@/components/admin/mortgage-docs-modal";
import {
  addClientDocument,
  deleteClientDocument,
  getClientDocuments,
  updateClientDeal,
} from "@/lib/crm.functions";
import { BANKS_CATALOG, bankMeta, type CreditBlockData } from "@/lib/banks-catalog";
import { BGN_PER_EUR, calcNotaryFees, money } from "@/lib/mortgage-calc";
import { MORTGAGE_DOC_REQS } from "@/lib/mortgage-docs";
import { getLiveRate, monthlyPayment, type IncomeOrigin } from "@/lib/mortgage-rates";
import {
  getCityLocalTax,
  listBankBranches,
  setBankBranchImage,
  type BankBranchRow,
  type CityLocalTax,
} from "@/lib/bank-rates.functions";
import { supabase } from "@/integrations/supabase/client";

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
  egon: string;
  ownFunds: string;
  note: string;
};

const EMPTY_FORM: BankForm = {
  price: "",
  amount: "",
  years: "25",
  income: "",
  employer: "",
  property: "",
  egon: "",
  ownFunds: "",
  note: "",
};

function templateType(label: string) {
  return `bank_template:${label}`;
}

function fmtDay(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("bg-BG");
}

/**
 * Банка от картата на клиента:
 * 1) мрежа с всички банки
 * 2) цветна карта според банката (ЦКР + графи + листчета)
 * 3) „Запази кредитен блок“ → блокът седи в картата на клиента
 */
export function BankFlowModal({
  client,
  onClose,
  onPicked,
  onSavedCreditBlock,
  onAddTask,
}: {
  client: any;
  onClose: () => void;
  onPicked?: (bank: string) => void;
  onSavedCreditBlock?: (block: CreditBlockData) => void;
  onAddTask?: (text: string) => void;
}) {
  const city: string = client?.cities?.name ?? "Шумен";
  const citySlug: string = client?.cities?.slug ?? "shumen";
  const [bank, setBank] = useState<string | null>(null);
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

  const openBank = (name: string) => {
    setBank(name);
    setTab("board");
  };

  const addTask = (text: string) => {
    onAddTask?.(text);
    toast.success("Добавено към задачите на клиента.");
  };

  const saveCreditBlock = async (block: CreditBlockData, form?: BankForm) => {
    setBusy(true);
    try {
      const md = client.mortgage_data ?? {};
      await updateClientDeal({
        data: {
          id: client.id,
          mortgage_data: {
            ...md,
            bank: block.bank,
            income_origin: origin,
            rate: block.rate.toFixed(2),
            rate_date: new Date().toISOString().slice(0, 10),
            term_years: block.years,
            credit_block: { ...block, savedAt: new Date().toISOString() },
            ...(form
              ? { bank_forms: { ...(md.bank_forms ?? {}), [block.bank]: form } }
              : {}),
          },
        },
      });
      onPicked?.(block.bank);
      onSavedCreditBlock?.({ ...block, savedAt: new Date().toISOString() });
      toast.success(`Кредитният блок за ${block.bank} е запазен.`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setBusy(false);
    }
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
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#f7f2e8] shadow-2xl"
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
            busy={busy}
            onBack={() => setBank(null)}
            onAddTask={() => addTask(`Ипотека за ${client.full_name} — ${bank}: документи и графи`)}
            onOpenDocs={() => setDocsOpen(true)}
            onClose={onClose}
            onSaveCreditBlock={saveCreditBlock}
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

  const cards = useMemo(() => {
    const today = new Date();
    return BANKS_CATALOG.map((meta) => {
      const row = rows.find((r) => r.bank === meta.name);
      const live = getLiveRate(meta.name, origin, today);
      const rate =
        origin === "foreign"
          ? (row?.rate_foreign ?? live.rate)
          : (row?.rate_bg ?? live.rate);
      return {
        meta,
        row: row ?? null,
        rate,
        validFrom: row?.valid_from ?? live.validFrom,
        image_url: row?.image_url ?? null,
        branch_label: row?.branch_label ?? `${city} — клон ${meta.short ?? meta.name}`,
      };
    });
  }, [rows, origin, city]);

  const uploadImage = async (row: BankBranchRow, file: File) => {
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `bank-logos/${row.city_slug}/${row.bank.replace(/[^\p{L}\p{N}]+/gu, "-")}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("property-images").upload(path, file, { upsert: true });
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
            Ипотека за {client.full_name} · избери банка → отваря се цветната карта
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
            <Loader2 className="h-4 w-4 animate-spin" /> Зареждам лихвите в {city}…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => {
              const color = c.row?.color ?? c.meta.color;
              const dark = c.meta.dark || color.toLowerCase() === "#f4c500";
              return (
                <div
                  key={c.meta.name}
                  className="group overflow-hidden rounded-xl border border-[#7a1226]/15 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-center gap-2 bg-[#2b2f38] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-50">
                    <Building2 className="h-3.5 w-3.5 flex-none opacity-80" />
                    <span className="truncate">{c.meta.name}</span>
                    {c.row ? (
                      <label className="ml-auto flex-none cursor-pointer font-normal normal-case text-amber-50/70 hover:text-amber-50">
                        <Upload className="h-3.5 w-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f && c.row) void uploadImage(c.row, f);
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(c.meta.name)}
                    style={{ backgroundColor: color, color: dark ? "#3d2f00" : "#ffffff" }}
                    className="w-full px-4 py-3 text-center disabled:opacity-60"
                  >
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.meta.name}
                        className="mx-auto mb-2 h-14 w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mx-auto mb-2 flex h-14 w-full items-center justify-center text-2xl font-black opacity-90">
                        {c.meta.short ?? c.meta.name.slice(0, 3)}
                      </div>
                    )}
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                      Клон {city}
                    </div>
                    <div className="font-display text-lg leading-tight">{c.meta.name}</div>
                    <div className="mt-1 text-[11px] opacity-85">{c.branch_label}</div>
                    <div className="mt-1 text-[12px] font-bold italic opacity-95">
                      лихва {c.rate.toFixed(2)}%
                      {c.validFrom ? ` · към ${fmtDay(c.validFrom)}` : ""}
                    </div>
                    <span className="mt-2 inline-flex rounded-full bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                      Избери банка →
                    </span>
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
  busy,
  onBack,
  onAddTask,
  onOpenDocs,
  onClose,
  onSaveCreditBlock,
}: {
  bank: string;
  city: string;
  client: any;
  origin: IncomeOrigin;
  branch: BankBranchRow | null;
  localTax: CityLocalTax | null;
  tab: "board" | "form" | "templates";
  setTab: (t: "board" | "form" | "templates") => void;
  busy: boolean;
  onBack: () => void;
  onAddTask: () => void;
  onOpenDocs: () => void;
  onClose: () => void;
  onSaveCreditBlock: (block: CreditBlockData, form?: BankForm) => Promise<void>;
}) {
  const meta = bankMeta(bank);
  const color = branch?.color ?? meta.color;
  const fg = meta.dark ? "#3d2f00" : "#ffffff";

  return (
    <>
      <div className="relative shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 75% 30%, rgba(255,255,255,0.35), transparent 50%), linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35))",
          }}
        />
        <div className="relative px-4 pb-3 pt-3" style={{ color: fg }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#3d0a15]"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Банките
              </button>
              <button
                type="button"
                onClick={onAddTask}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-semibold backdrop-blur"
              >
                <ListTodo className="h-3.5 w-3.5" /> Към задача
              </button>
            </div>
            <button type="button" onClick={onClose} aria-label="Затвори" className="opacity-90">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <div className="font-display text-2xl font-black uppercase tracking-wide">{bank}</div>
              {meta.slogan ? <div className="text-sm opacity-90">{meta.slogan}</div> : null}
            </div>
            <div
              className="justify-self-center rounded-xl px-4 py-2 text-center shadow-lg"
              style={{ backgroundColor: color, color: fg, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                Клон {city}
              </div>
              <div className="text-sm font-bold">{bank}</div>
              <div className="text-[11px] opacity-85">
                {branch?.branch_label ?? `${city} — клон / център`}
              </div>
            </div>
            <div className="text-right text-sm font-semibold opacity-90">
              {meta.motto ?? ""}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
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
                  tab === key ? "bg-white text-[#3d0a15]" : "bg-white/20 text-inherit hover:bg-white/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {tab === "board" && (
          <BoardTab
            bank={bank}
            color={color}
            client={client}
            origin={origin}
            branch={branch}
            city={city}
            localTax={localTax}
            busy={busy}
            onOpenDocs={onOpenDocs}
            onSaveCreditBlock={onSaveCreditBlock}
          />
        )}
        {tab === "form" && <FormTab bank={bank} color={color} client={client} />}
        {tab === "templates" && <TemplatesTab bank={bank} client={client} />}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- табло */

function BoardTab({
  bank,
  color,
  client,
  origin,
  branch,
  city,
  localTax,
  busy,
  onOpenDocs,
  onSaveCreditBlock,
}: {
  bank: string;
  color: string;
  client: any;
  origin: IncomeOrigin;
  branch: BankBranchRow | null;
  city: string;
  localTax: CityLocalTax | null;
  busy: boolean;
  onOpenDocs: () => void;
  onSaveCreditBlock: (block: CreditBlockData, form?: BankForm) => Promise<void>;
}) {
  const meta = bankMeta(bank);
  const md = client?.mortgage_data ?? {};
  const savedForm: BankForm = { ...EMPTY_FORM, ...(md.bank_forms?.[bank] as BankForm) };
  const savedBlock = md.credit_block as CreditBlockData | undefined;
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

  const [form, setForm] = useState<BankForm>({
    ...savedForm,
    price: savedForm.price || (savedBlock ? String(savedBlock.amount + savedBlock.downPayment) : ""),
    amount: savedForm.amount || (savedBlock ? String(savedBlock.amount) : ""),
    years: savedForm.years || (savedBlock ? String(savedBlock.years) : "25"),
    ownFunds: savedForm.ownFunds || (savedBlock ? String(savedBlock.downPayment) : ""),
  });
  const [payment, setPayment] = useState<number | null>(savedBlock?.payment ?? null);
  const [notary, setNotary] = useState<ReturnType<typeof calcNotaryFees> | null>(null);

  const set =
    (key: keyof BankForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const calcPayment = () => {
    const a = Number(form.amount);
    const y = Number(form.years);
    if (!a || !y) return toast.error("Въведи сума и срок.");
    setPayment(monthlyPayment(a, live.rate, y));
  };

  const calcNotary = () => {
    const p = Number(form.price);
    if (!p) return toast.error("Въведи цена на имота.");
    setNotary(
      calcNotaryFees({
        price: p,
        loanAmount: Number(form.amount) || undefined,
        currency: "EUR",
        withMortgage: Number(form.amount) > 0,
        localTaxRate: localTax?.local_tax_rate,
      }),
    );
  };

  const saveBlock = async () => {
    const amount = Number(form.amount);
    const years = Number(form.years) || 25;
    const downPayment = Number(form.ownFunds) || Math.max(0, Number(form.price) - amount);
    if (!amount) return toast.error("Въведи желана сума на кредита.");
    const pay = payment ?? monthlyPayment(amount, live.rate, years);
    await onSaveCreditBlock(
      {
        bank,
        amount,
        downPayment,
        years,
        rate: live.rate,
        payment: pay,
      },
      form,
    );
  };

  const field =
    "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-[#3d0a15] placeholder:text-zinc-400 focus:outline-none focus:ring-2";
  const labelCls = "text-[11px] font-bold";
  const labelStyle = { color: "#7a1226" };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}22`, color }}
              >
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="font-display text-base text-[#3d0a15]">Проверка на ЦКР</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenDocs}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                <IdCard className="h-3.5 w-3.5" /> Прикачи лична карта
              </button>
              <button
                type="button"
                onClick={onOpenDocs}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[11px] font-bold"
                style={{ borderColor: color, color }}
              >
                Проверка на ЦКР
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-zinc-500">
              Щом качиш личната карта на {client.full_name}, системата я чете, проверява ЕГН-то и
              записва резултата за {bank}. Без карта проверката не тръгва.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}22`, color }}
              >
                <Calculator className="h-4 w-4" />
              </span>
              <div className="font-display text-base text-[#3d0a15]">Графи за ипотечен кредит</div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Цена на имота / сделката (EUR)
                </span>
                <input value={form.price} onChange={set("price")} inputMode="decimal" className={field} style={{ ["--tw-ring-color" as string]: color }} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Желана сума (EUR)
                </span>
                <input value={form.amount} onChange={set("amount")} inputMode="decimal" className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Срок (години)
                </span>
                <input value={form.years} onChange={set("years")} inputMode="numeric" className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Месечен доход (EUR)
                </span>
                <input value={form.income} onChange={set("income")} inputMode="decimal" className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Работодател
                </span>
                <input value={form.employer} onChange={set("employer")} className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  ЕГН
                </span>
                <input value={form.egon} onChange={set("egon")} className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Имот / адрес
                </span>
                <input value={form.property} onChange={set("property")} className={field} />
              </label>
              <label className="space-y-1">
                <span className={labelCls} style={labelStyle}>
                  Собствени средства (EUR)
                </span>
                <input value={form.ownFunds} onChange={set("ownFunds")} inputMode="decimal" className={field} />
              </label>
            </div>
            <label className="mt-2.5 block space-y-1">
              <span className={labelCls} style={labelStyle}>
                Бележка към банката
              </span>
              <textarea value={form.note} onChange={set("note")} rows={3} className={`${field} resize-none`} />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={calcPayment}
                className="rounded-full px-4 py-2 text-[11px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                Изчисли вноска
              </button>
              <button
                type="button"
                onClick={calcNotary}
                className="rounded-full border bg-white px-4 py-2 text-[11px] font-bold"
                style={{ borderColor: color, color }}
              >
                Изчисли нотариус
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveBlock()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#7a1226] px-4 py-2 text-[11px] font-bold text-amber-50 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Запази кредитен блок
              </button>
            </div>

            {payment !== null ? (
              <div
                className="mt-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{ borderColor: `${color}55`, backgroundColor: `${color}12`, color }}
              >
                Месечна вноска: {money(payment, "EUR")} при {live.rate.toFixed(2)}% за {form.years} г.
              </div>
            ) : null}
            {notary ? (
              <div className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-[#fdf6dc] px-3 py-2 text-[11px] text-[#3d0a15]">
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
                <div className="flex justify-between gap-2">
                  <span>Общо в лева</span>
                  <span className="font-semibold">{money(notary.total * BGN_PER_EUR, "BGN")}</span>
                </div>
                <p className="pt-1 text-[10px] text-[#7a1226]/70">
                  Местен данък {city}:{" "}
                  {localTax ? `${localTax.local_tax_rate.toFixed(2)}%` : "по подразбиране"}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
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
              <div className="font-display text-3xl" style={{ color }}>
                {liveBg.rate.toFixed(2)}%
              </div>
              <p className="mt-1 text-[10px] leading-snug text-[#7a1226]/70">
                валидна от {new Date(liveBg.validFrom).toLocaleDateString("bg-BG")} · доходи от
                България
              </p>
            </div>
            <div className="mt-2 border-t border-[#3d0a15]/15 pt-2">
              <div className="handwriting text-sm font-bold text-[#3d0a15]">Доходи от чужбина:</div>
              <div className="font-display text-3xl" style={{ color }}>
                {liveForeign.rate.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="relative rotate-1 rounded-sm border border-amber-700/25 bg-[#f3e3b0] p-3 pt-5 shadow-md">
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-black/20 bg-red-700 shadow" />
            <div className="handwriting text-base font-bold text-[#3d0a15]">
              Документи за ипотека — {meta.short ?? bank}
            </div>
            <div className="handwriting mt-1 text-sm font-bold text-[#3d0a15]/80">
              Доходи от България
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#3d0a15]/90">
              {MORTGAGE_DOC_REQS.map((r) => (
                <li key={r.id}>{r.label}</li>
              ))}
              <li>Нотариален акт / скица</li>
              <li>Съгласие GDPR / ЦКР</li>
            </ul>
            <button
              type="button"
              onClick={onOpenDocs}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              <Paperclip className="h-3.5 w-3.5" /> Качи документите на {client.full_name}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-600">
        <span>
          Сравняваме условията на водещите банки в {city}, за да намерим най-доброто решение.
        </span>
        <a
          href={`tel:${client.phone || ""}`}
          className="rounded-full bg-[#7a1226] px-4 py-2 text-[11px] font-bold text-amber-50"
        >
          Свържи се с нас →
        </a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- графи */

function FormTab({ bank, color, client }: { bank: string; color: string; client: any }) {
  const saved: BankForm = { ...EMPTY_FORM, ...(client?.mortgage_data?.bank_forms?.[bank] as BankForm) };
  const [form, setForm] = useState<BankForm>(saved);
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
    "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-[#3d0a15] focus:outline-none";

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <div>
        <div className="font-display text-base text-[#3d0a15]">Графи за ипотечен кредит</div>
        <p className="text-[11px] text-zinc-500">Пазят се при клиента за {bank}.</p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {(
          [
            ["price", "Цена на имота / сделката (EUR)"],
            ["amount", "Желана сума (EUR)"],
            ["years", "Срок (години)"],
            ["income", "Месечен доход (EUR)"],
            ["employer", "Работодател"],
            ["egon", "ЕГН"],
            ["property", "Имот / адрес"],
            ["ownFunds", "Собствени средства (EUR)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-1">
            <span className="text-[11px] font-bold text-[#7a1226]">{label}</span>
            <input value={form[key]} onChange={set(key)} className={field} />
          </label>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#7a1226]">Бележка към банката</span>
        <textarea value={form.note} onChange={set("note")} rows={3} className={`${field} resize-none`} />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60"
        style={{ backgroundColor: color }}
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
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
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
            placeholder="Имейл"
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
