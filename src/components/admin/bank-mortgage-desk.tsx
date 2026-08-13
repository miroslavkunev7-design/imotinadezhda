import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { X, Plus, Trash2, Mail, Phone, Folder, Upload, Send, Save, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClientDeal, getClientDocuments, addClientDocument } from "@/lib/crm.functions";
import { runCkrCheck, type CkrCheckResult } from "@/lib/ckr.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  calcNotaryDeal,
  fetchDayFx,
  fmtBg,
  type DayFx,
  type NotaryBreakdown,
} from "@/lib/notary-fees";
import {
  SHUMEN_BANKS,
  loadBankDesk,
  saveBankContacts,
  saveBankTemplates,
  type BankContact,
  type BankRole,
  type BankTemplate,
  type ShumenBank,
} from "@/lib/shumen-banks";
import { BANK_BRANCH_PHOTOS } from "@/lib/bank-branch-photos";

type ClientLite = {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  mortgage_data?: any;
};

const ROLES: BankRole[] = ["кредитен консултант", "управител", "клонов мениджър", "друг"];

export function BankMortgageDesk({
  client,
  open,
  onClose,
  onSaved,
}: {
  client: ClientLite;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [bank, setBank] = useState<ShumenBank | null>(null);

  useEffect(() => {
    if (!open) setBank(null);
  }, [open, client.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="pointer-events-auto !z-[220] bg-[#8B1A2B]/55" />
        <DialogPrimitive.Content
          className={`pointer-events-auto fixed left-1/2 top-1/2 !z-[230] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border-2 p-0 shadow-[0_24px_70px_rgba(49,2,12,0.4)] outline-none ${
            bank ? "w-[min(96vw,980px)] border-white/40 bg-black" : "w-[min(92vw,640px)] border-[#C9A84C]/50 bg-[#faf6ee]"
          }`}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
          onFocusOutside={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Банки в Шумен — {client.full_name}</DialogTitle>
          {bank ? (
            <BankWindow
              bank={bank}
              client={client}
              onBack={() => setBank(null)}
              onClose={onClose}
              onSaved={onSaved}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="font-display text-2xl text-[#31020c]">Банки в Шумен</div>
                  <div className="text-xs text-muted-foreground">Ипотека за {client.full_name}</div>
                </div>
                <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-accent/30">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[calc(88vh-88px)] overflow-y-auto px-5 pb-5">
                <div className="grid grid-cols-2 gap-3">
                  {SHUMEN_BANKS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBank(b)}
                      className="overflow-hidden rounded-2xl text-left shadow-sm ring-1 ring-black/10"
                    >
                    <span className="relative block h-36">
                      <img
                        src={BANK_BRANCH_PHOTOS[b.id]}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                      <span
                        className="absolute inset-x-3 bottom-2 rounded-sm px-2 py-2 text-center shadow-lg ring-2 ring-white/80"
                        style={{ background: b.color, color: b.textOn }}
                      >
                        <span className="block text-[9px] font-bold uppercase tracking-[0.28em] opacity-90">{b.branchBoard}</span>
                        <span className="block font-display text-lg leading-tight">{b.name}</span>
                        <span className="block text-[10px] opacity-90">{b.address}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function BankWindow({
  bank,
  client,
  onBack,
  onClose,
  onSaved,
}: {
  bank: ShumenBank;
  client: ClientLite;
  onBack: () => void;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const saved = loadBankDesk(bank.id);
  const [contacts, setContacts] = useState<BankContact[]>(saved.contacts);
  const [templates, setTemplates] = useState<BankTemplate[]>(saved.templates);
  const apps = (client.mortgage_data?.bank_apps ?? {}) as Record<string, Record<string, string>>;
  const [form, setForm] = useState<Record<string, string>>(apps[bank.id] ?? {});
  const [busy, setBusy] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", role: "кредитен консултант" as BankRole, phone: "", email: "" });
  const [tplLabel, setTplLabel] = useState("");

  const persistContacts = (next: BankContact[]) => {
    setContacts(next);
    saveBankContacts(bank.id, next);
  };
  const persistTemplates = (next: BankTemplate[]) => {
    setTemplates(next);
    saveBankTemplates(bank.id, next);
  };

  const saveForm = async () => {
    setBusy(true);
    try {
      await updateClientDeal({
        data: {
          id: client.id,
          deal_stage: "mortgage",
          mortgage_data: {
            ...(client.mortgage_data ?? {}),
            bank_apps: { ...(client.mortgage_data?.bank_apps ?? {}), [bank.id]: form },
            started_deal: true,
            bank_case: {
              bankId: bank.id,
              bankName: bank.name,
              worker: (client.mortgage_data?.bank_case?.worker as string) ?? "",
              sent: (client.mortgage_data?.bank_case?.sent as string) ?? "",
              progress: (client.mortgage_data?.bank_case?.progress as string) ?? "подадена графа",
            },
          },
        },
      });
      toast.success("Графата за ипотеката е записана.");
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setBusy(false);
    }
  };

  const addContact = () => {
    if (!contactDraft.name.trim()) return toast.error("Напиши име на човека от банката.");
    persistContacts([
      ...contacts,
      { id: Math.random().toString(36).slice(2, 10), ...contactDraft, name: contactDraft.name.trim(), email: contactDraft.email.trim(), phone: contactDraft.phone.trim() },
    ]);
    setContactDraft({ name: "", role: "кредитен консултант", phone: "", email: "" });
  };

  const addTemplate = async (file: File) => {
    const label = tplLabel.trim() || file.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(file);
    persistTemplates([...templates, { id: Math.random().toString(36).slice(2, 10), label, fileName: file.name, url }]);
    setTplLabel("");
    toast.success("Образецът е в папката.");
  };

  const sendTo = (c: BankContact) => {
    if (!c.email) {
      toast.error("Няма имейл за този контакт — добави ABV или друг.");
      return;
    }
    const subject = `Ипотечна кандидатура — ${client.full_name} — ${bank.short}`;
    const lines = [
      `Здравейте, ${c.name},`,
      "",
      `Изпращам кандидатура към ${bank.name}, клон Шумен.`,
      "",
      `Клиент: ${client.full_name}`,
      client.phone ? `Телефон: ${client.phone}` : null,
      client.email ? `Имейл: ${client.email}` : null,
      ...bank.formFields.map((f) => (form[f.key] ? `${f.label}: ${form[f.key]}` : null)),
      "",
      templates.length
        ? `Образци в папката: ${templates.map((t) => t.label).join("; ")}`
        : "Образци от банката още не са качени — приложих документите на клиента.",
      "",
      "Моля прикачете свалените файлове към писмото (ABV приема прикачени документи).",
      "",
      "Поздрави,",
      "Имоти Надежда",
    ].filter(Boolean).join("\n");
    templates.forEach((t) => {
      const a = document.createElement("a");
      a.href = t.url;
      a.download = t.fileName;
      a.click();
    });
    window.location.href = `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    toast.success(`Отворено е писмо до ${c.email}. Образците се свалят, за да ги прикачиш в ABV.`);
  };

  return (
    <div className="relative flex max-h-[88vh] flex-col">
      <img
        src={BANK_BRANCH_PHOTOS[bank.id]}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, ${bank.color2}aa 0%, transparent 32%, rgba(6,10,8,0.42) 100%)` }} />

      <div className="relative z-10 flex items-start justify-between gap-2 px-4 pb-2 pt-3">
        <button type="button" onClick={onBack} className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold shadow" style={{ color: bank.color2 }}>
          ← Банките
        </button>
        <div
          className="min-w-0 flex-1 rounded-sm px-4 py-3 text-center shadow-[0_10px_28px_rgba(0,0,0,0.35)] ring-[3px] ring-white/85"
          style={{ background: `linear-gradient(180deg, ${bank.color}, ${bank.color2})`, color: bank.textOn }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-90">{bank.branchBoard}</div>
          <div className="font-display text-2xl leading-tight sm:text-3xl">{bank.name}</div>
          <div className="mt-0.5 text-[12px] opacity-95">{bank.address}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-white/90 p-1.5 shadow" style={{ color: bank.color2 }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 overflow-y-auto px-5 py-4 space-y-5">
        <BankCkrPanel
          bank={bank}
          client={client}
          form={form}
          setForm={setForm}
          onSaved={onSaved}
        />

        <BankCalcBoard bank={bank} form={form} setForm={setForm} />

        <section className="rounded-2xl border border-white/50 bg-white/92 p-3 shadow-md backdrop-blur-[2px]">
          <h3 className="mb-2 font-display text-lg" style={{ color: bank.color2 }}>Графи за ипотечен кредит</h3>
          <div className="grid grid-cols-2 gap-2">
            {[{ key: "price", label: "Цена на имота / сделката (EUR)", type: "number" as const }, ...bank.formFields.filter((f) => f.key !== "price")].map((f) => (
              <label key={f.key} className={f.type === "textarea" ? "col-span-2 text-xs" : "text-xs"}>
                <span className="mb-1 block text-muted-foreground">{f.label}</span>
                {f.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-sm"
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-sm"
                  />
                )}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-3 rounded-full text-white" style={{ background: bank.color }} onClick={saveForm} disabled={busy}>
            <Save className="h-3.5 w-3.5" /> {busy ? "Запис..." : "Запази графата"}
          </Button>
        </section>

        <section className="rounded-2xl border border-white/50 bg-white/92 p-3 shadow-md backdrop-blur-[2px]">
          <div className="mb-2 flex items-center gap-2 font-display text-lg" style={{ color: bank.color2 }}>
            <Folder className="h-4 w-4" /> Папка с образци
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Ако банката е качила бланки — сложи ги тук с ясно име. Типични за {bank.short}:
          </p>
          <ul className="mb-3 space-y-1 text-xs text-[#31020c]">
            {bank.samples.map((s) => {
              const uploaded = templates.find((t) => t.label.toLowerCase() === s.toLowerCase());
              return (
                <li key={s} className="flex items-center justify-between gap-2 rounded-lg bg-[#faf6ee] px-2 py-1">
                  <span>{s}</span>
                  {uploaded ? (
                    <a href={uploaded.url} target="_blank" rel="noreferrer" className="text-primary underline">отвори</a>
                  ) : (
                    <span className="text-muted-foreground">няма качен файл</span>
                  )}
                </li>
              );
            })}
          </ul>
          {templates.filter((t) => !bank.samples.some((s) => s.toLowerCase() === t.label.toLowerCase())).map((t) => (
            <div key={t.id} className="mb-1 flex items-center justify-between text-xs">
              <a href={t.url} target="_blank" rel="noreferrer" className="text-primary underline">{t.label}</a>
              <button type="button" onClick={() => persistTemplates(templates.filter((x) => x.id !== t.id))}><Trash2 className="h-3.5 w-3.5 text-rose-600" /></button>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input
              value={tplLabel}
              onChange={(e) => setTplLabel(e.target.value)}
              placeholder="Надпис на образеца, напр. Заявление за жилищен кредит"
              className="flex-1 rounded-lg border border-input px-2 py-1.5 text-xs"
            />
            <label className="flex cursor-pointer items-center gap-1 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary">
              <Upload className="h-3.5 w-3.5" /> Качи
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) addTemplate(f);
              }} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-white/50 bg-white/92 p-3 shadow-md backdrop-blur-[2px]">
          <h3 className="mb-2 font-display text-lg" style={{ color: bank.color2 }}>Хора в банката</h3>
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#31020c]">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.role}</div>
                    {c.phone && <div className="text-xs"><Phone className="mr-1 inline h-3 w-3" />{c.phone}</div>}
                    {c.email && <div className="text-xs"><Mail className="mr-1 inline h-3 w-3" />{c.email}</div>}
                  </div>
                  <button type="button" onClick={() => persistContacts(contacts.filter((x) => x.id !== c.id))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
                </div>
                <Button size="sm" className="mt-2 rounded-full" disabled={!c.email} onClick={() => sendTo(c)}>
                  <Send className="h-3.5 w-3.5" /> Изпрати на {c.email?.includes("abv") ? "ABV" : "имейла"}
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input placeholder="Име" value={contactDraft.name} onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" />
            <select value={contactDraft.role} onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value as BankRole })} className="rounded-lg border px-2 py-1.5 text-xs">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Телефон" value={contactDraft.phone} onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" />
            <input placeholder="Имейл (напр. ...@abv.bg)" value={contactDraft.email} onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" />
          </div>
          <Button size="sm" variant="outline" className="mt-2 w-full rounded-full" onClick={addContact}>
            <Plus className="h-3.5 w-3.5" /> Добави контакт
          </Button>
        </section>
      </div>
    </div>
  );
}

function isIdCardDoc(d: { document_type?: string; file_name?: string }) {
  const t = `${d.document_type ?? ""} ${d.file_name ?? ""}`.toLowerCase();
  return t.includes("id_card") || t.includes("личн");
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("Не се прочете файлът."));
    r.readAsDataURL(file);
  });
}

function BankCkrPanel({
  bank,
  client,
  form,
  setForm,
  onSaved,
}: {
  bank: ShumenBank;
  client: ClientLite;
  form: Record<string, string>;
  setForm: (next: Record<string, string>) => void;
  onSaved?: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CkrCheckResult | null>(
    () => (client.mortgage_data?.ckr_checks?.[bank.id] as CkrCheckResult | undefined) ?? null,
  );

  const reloadDocs = async () => {
    const rows = await getClientDocuments({ data: { client_id: client.id } });
    setDocs((rows ?? []).filter(isIdCardDoc));
  };

  useEffect(() => {
    reloadDocs().catch(() => setDocs([]));
    setResult((client.mortgage_data?.ckr_checks?.[bank.id] as CkrCheckResult | undefined) ?? null);
  }, [client.id, bank.id]);

  const runFromFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, 2);
    if (!images.length) {
      toast.error("Снимай личната карта (лице, при нужда и гръб) — не PDF.");
      return;
    }
    setBusy(true);
    try {
      for (const file of images) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${client.id}/id_card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        await addClientDocument({
          data: {
            client_id: client.id,
            document_type: "id_card",
            file_url: signed?.signedUrl ?? path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          },
        });
      }
      await reloadDocs();
      const payload = await Promise.all(images.map(async (f) => ({
        imageBase64: await fileToBase64(f),
        mimeType: f.type || "image/jpeg",
      })));
      const next = await runCkrCheck({
        data: { clientId: client.id, bankId: bank.id, images: payload },
      });
      setResult(next);
      if (next.identity.egn) setForm({ ...form, egn: next.identity.egn });
      onSaved?.();
      if (next.status === "passed") toast.success("Проверката за ЦКР мина — ЕГН-то е валидно, пакетът е готов за банката.");
      else if (next.status === "failed") toast.error(next.summary);
      else toast.message(next.summary);
    } catch (e: any) {
      toast.error(e?.message ?? "Проверката не мина.");
    } finally {
      setBusy(false);
    }
  };

  const runFromExisting = async () => {
    const first = docs.find((d) => String(d.mime_type ?? "").startsWith("image/") && d.file_url);
    if (!first) {
      toast.error("Няма качена снимка на лична карта. Прикачи лицето на картата.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(first.file_url);
      const blob = await res.blob();
      const file = new File([blob], first.file_name || "id.jpg", { type: blob.type || "image/jpeg" });
      const next = await runCkrCheck({
        data: {
          clientId: client.id,
          bankId: bank.id,
          images: [{ imageBase64: await fileToBase64(file), mimeType: file.type }],
        },
      });
      setResult(next);
      if (next.identity.egn) setForm({ ...form, egn: next.identity.egn });
      onSaved?.();
      if (next.status === "passed") toast.success("Проверката за ЦКР мина.");
      else toast.message(next.summary);
    } catch (e: any) {
      toast.error(e?.message ?? "Проверката не мина.");
    } finally {
      setBusy(false);
    }
  };

  const tone =
    result?.status === "passed" ? "border-emerald-400 bg-emerald-50" :
    result?.status === "failed" ? "border-rose-300 bg-rose-50" :
    "border-white/50 bg-white/92";

  return (
    <section className={`rounded-2xl border p-3 shadow-md backdrop-blur-[2px] ${tone}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-lg" style={{ color: bank.color2 }}>
          <ShieldCheck className="h-5 w-5" /> Проверка на ЦКР
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: bank.color }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Прикачи лична карта
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                if (list.length) runFromFiles(list);
              }}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            style={{ borderColor: bank.color, color: bank.color2 }}
            onClick={runFromExisting}
          >
            {busy ? "Проверявам..." : "Проверка на ЦКР"}
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-[#5a3a3f]">
        Щом качиш личната карта на {client.full_name}, системата я чете, проверява ЕГН-то и записва резултата за {bank.short}. Без карта проверката не тръгва.
      </p>
      {docs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {docs.map((d) => (
            <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="text-[11px] underline" style={{ color: bank.color2 }}>
              {d.file_name}
            </a>
          ))}
        </div>
      )}
      {result && (
        <div className="mt-3 space-y-1.5 text-xs text-[#2a0a12]">
          <div className="font-semibold">{result.summary}</div>
          {result.steps.map((s) => (
            <div key={s.label} className="flex gap-2">
              <span className={s.ok ? "text-emerald-700" : "text-rose-700"}>{s.ok ? "✓" : "✗"}</span>
              <span><b>{s.label}.</b> {s.detail}</span>
            </div>
          ))}
          {result.identity.id_number && (
            <div className="pt-1 text-[11px] text-[#5a3a3f]">№ на карта: {result.identity.id_number}</div>
          )}
        </div>
      )}
    </section>
  );
}

function dealNumbers(form: Record<string, string>, rateToday: number) {
  const loan = Number(form.amount) || 0;
  const own = Number(form.own_funds) || 0;
  const price = Number(form.price) || (loan && own ? loan + own : loan);
  const years = Number(form.years) || 25;
  return { price, loan, years, rate: rateToday };
}

function BankCalcBoard({
  bank,
  form,
  setForm,
}: {
  bank: ShumenBank;
  form: Record<string, string>;
  setForm: (next: Record<string, string>) => void;
}) {
  const [fx, setFx] = useState<DayFx | null>(null);
  const [notary, setNotary] = useState<NotaryBreakdown | null>(null);

  useEffect(() => {
    fetchDayFx().then(setFx);
  }, []);

  const nums = dealNumbers(form, bank.rateToday);

  const runLoan = () => {
    if (!nums.loan) {
      toast.error("Попълни желаната сума в ипотечната карта.");
      return;
    }
    setNotary(calcNotaryDeal({
      priceEur: nums.price || nums.loan,
      loanEur: nums.loan,
      years: nums.years,
      ratePct: nums.rate,
    }));
  };

  const runNotary = () => {
    if (!nums.price && !nums.loan) {
      toast.error("Попълни цената на имота и сумата на кредита в графата.");
      return;
    }
    const n = calcNotaryDeal({
      priceEur: nums.price || nums.loan,
      loanEur: nums.loan,
      years: nums.years,
      ratePct: nums.rate,
    });
    setNotary(n);
    if (!form.price && nums.price) setForm({ ...form, price: String(nums.price) });
    toast.success("Нотариусът е сметнат по тарифа т. 8 + ДДС, вписване и 3% данък Шумен.");
  };

  const today = fx?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/50 bg-white/88 p-3 shadow-md backdrop-blur-[2px]">
      <div className="mb-2 font-display text-lg" style={{ color: bank.color2 }}>Табло — калкулатор и листчета</div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr_1fr]">
        <div className="rounded-xl border p-3" style={{ borderColor: `${bank.color}55`, background: "#fff" }}>
          <div className="font-display text-base" style={{ color: bank.color2 }}>Кредитен калкулатор</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Взима сума, срок и цена от ипотечната карта. Лихвата е днешната на {bank.short}: {fmtBg(bank.rateToday, 2)}%.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>Сума: <b>{nums.loan ? `${fmtBg(nums.loan, 0)} €` : "—"}</b></div>
            <div>Срок: <b>{nums.years} г.</b></div>
            <div>Цена имот: <b>{nums.price ? `${fmtBg(nums.price, 0)} €` : "—"}</b></div>
            <div>Лихва: <b>{fmtBg(bank.rateToday, 2)}%</b></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full text-white" style={{ background: bank.color }} onClick={runLoan}>Изчисли вноска</Button>
            <Button size="sm" variant="outline" className="rounded-full" style={{ borderColor: bank.color, color: bank.color2 }} onClick={runNotary}>Изчисли нотариус</Button>
          </div>
          {notary && (
            <div className="mt-3 space-y-1 rounded-lg bg-[#faf6ee] p-2 text-xs text-[#31020c]">
              <div>Месечна вноска: <b>{fmtBg(notary.monthlyEur)} €</b> ({fmtBg(notary.monthlyEur * 1.95583)} лв.)</div>
              <div>Общо лихва за срока: <b>{fmtBg(notary.totalInterestEur)} €</b></div>
              <div className="border-t border-accent/30 pt-1 font-semibold">При нотариуса (Шумен)</div>
              <div>Нотариална такса т. 8 + 20% ДДС: {fmtBg(notary.notarySaleVatBgn)} лв.</div>
              <div>Учредяване на ипотека (50% от т. 8 + ДДС): {fmtBg(notary.notaryMortgageVatBgn)} лв.</div>
              <div>Вписване 0,1%: {fmtBg(notary.registryBgn)} лв.</div>
              <div>Местен данък 3% (Шумен, 2026): {fmtBg(notary.localTaxBgn)} лв.</div>
              <div className="font-display text-sm">Всичко на каса нотариус: {fmtBg(notary.totalNotaryDeskBgn)} лв. / {fmtBg(notary.totalNotaryDeskBgn / 1.95583)} €</div>
            </div>
          )}
        </div>

        <div className="relative min-h-[180px] rotate-[-2.5deg] rounded-sm bg-[#fff4a3] px-3 pb-3 pt-5 shadow-[3px_4px_10px_rgba(80,40,0,0.28)]">
          <span className="absolute left-1/2 top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-[#b42318] shadow" />
          <div className="font-display text-[15px] text-[#5c3b12]">Днес — {today}</div>
          <div className="mt-2 space-y-1 text-[12px] leading-snug text-[#4a2f0f]">
            <div>EUR → BGN: <b>1 = {fmtBg(fx?.eurBgn ?? 1.95583, 5)}</b></div>
            <div>USD → BGN: <b>{fx?.usdBgn ? fmtBg(fx.usdBgn, 4) : "…"}</b></div>
            <div>GBP → BGN: <b>{fx?.gbpBgn ? fmtBg(fx.gbpBgn, 4) : "…"}</b></div>
            <div className="mt-2 border-t border-[#e0c45a] pt-2">
              Лихва {bank.short} днес:
              <div className="font-display text-xl">{fmtBg(bank.rateToday, 2)}%</div>
              <div className="text-[10px] opacity-80">{bank.rateNote}</div>
            </div>
          </div>
        </div>

        <div className="relative min-h-[220px] rotate-[1.8deg] rounded-sm bg-[#ffe08a] px-3 pb-3 pt-5 shadow-[3px_5px_12px_rgba(80,40,0,0.28)]">
          <span className="absolute left-1/2 top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-[#b42318] shadow" />
          <div className="font-display text-[15px] text-[#5c3b12]">Документи за ипотека — {bank.short}</div>
          <div className="mt-2 max-h-56 overflow-y-auto text-[11px] leading-snug text-[#4a2f0f]">
            <div className="font-semibold">Доходи от България</div>
            <ul className="mb-2 list-disc pl-4">
              {bank.docsBg.map((d) => <li key={d}>{d}</li>)}
            </ul>
            <div className="font-semibold">Доходи от чужбина</div>
            <ul className="list-disc pl-4">
              {bank.docsAbroad.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
