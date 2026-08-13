import { useMemo, useState } from "react";
import { X, Check, AlertCircle, Upload, FileText, Loader2, CreditCard, Briefcase, IdCard, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitMortgageApplication, uploadMortgageDocument } from "@/lib/mortgage.functions";
import { toast } from "sonner";

type UploadedFile = {
  category: string;
  month?: string;
  path: string;
  file_name: string;
  size: number;
};

const BG_MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

function lastTwelveMonths(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: `${BG_MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const SINGLE_DOCS = [
  { id: "contract", label: "Трудов договор", icon: FileSignature },
  { id: "id_front", label: "Лична карта (лице)", icon: IdCard },
  { id: "id_back", label: "Лична карта (гръб)", icon: IdCard },
  { id: "employer_note", label: "Служебна бележка от работодател", icon: Briefcase },
];

export function MortgageApplyModal({
  open,
  onClose,
  propertyId,
  propertyTitle,
}: {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
  propertyTitle?: string;
}) {
  const months = useMemo(() => lastTwelveMonths(), []);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employer, setEmployer] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const uploadFile = async (file: File, category: string, month?: string) => {
    const key = `${category}-${month ?? "single"}-${file.name}`;
    setUploading(key);
    try {
      const uploaded = await uploadMortgageDocument({
        data: {
          category,
          month: month ?? null,
          fileName: file.name,
          contentType: file.type || null,
          size: file.size,
          base64: await fileToBase64(file),
        },
      });
      setFiles((prev) => [
        ...prev,
        { category, month, path: uploaded.path, file_name: uploaded.file_name, size: uploaded.size },
      ]);
      toast.success("Файлът е качен");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setUploading(null);
    }
  };

  const removeFile = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
  };

  const filesForMonth = (category: string, month: string) =>
    files.filter((f) => f.category === category && f.month === month);
  const filesForCategory = (category: string) =>
    files.filter((f) => f.category === category && !f.month);

  const monthCompleted = (category: string) =>
    months.filter((m) => filesForMonth(category, m.key).length > 0).length;

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Моля попълнете име и телефон");
      return;
    }
    setSubmitting(true);
    try {
      await submitMortgageApplication({
        data: {
          property_id: propertyId ?? null,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          employer: employer.trim() || null,
          monthly_income: monthlyIncome ? Number(monthlyIncome) : null,
          notes: notes.trim() || null,
          files,
        },
      });
      setSubmitted(true);
      toast.success("Заявлението е изпратено!");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при изпращане");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#8B1A2B]/65 p-3 backdrop-blur-sm md:p-6">
      <div className="my-4 w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-500/30 bg-[linear-gradient(180deg,#fbf6ec_0%,#f4ead5_100%)] shadow-[0_30px_80px_rgba(139,26,43,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-primary/15 bg-gradient-to-r from-[#66081c] to-[#4a0613] px-5 py-4 text-amber-100">
          <div>
            <div className="font-display text-2xl">Кандидатствай за ипотечен кредит</div>
            {propertyTitle && <div className="text-xs text-amber-200/80">{propertyTitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-amber-100/10" aria-label="Затвори">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl text-primary">Благодарим Ви!</h3>
            <p className="max-w-md text-sm text-primary/75">
              Получихме Вашето заявление и документи. Кредитен консултант ще се свърже с Вас в рамките на 24 часа.
            </p>
            <Button onClick={onClose} className="gold-cta-button mt-2">Затвори</Button>
          </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {/* Personal info */}
            <section className="mb-6 grid gap-3 sm:grid-cols-2">
              <Field label="Име и фамилия *">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Телефон *">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Имейл">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Работодател">
                <input value={employer} onChange={(e) => setEmployer(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Месечен доход (лв.)">
                <input type="number" min={0} value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Бележки">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </Field>
            </section>

            {/* 12-month documents */}
            {[
              { id: "bank_statement", label: "Банкови извлечения (12 месеца)", icon: CreditCard },
              { id: "payslip", label: "Фишове за заплата (12 месеца)", icon: FileText },
            ].map((cat) => {
              const completed = monthCompleted(cat.id);
              return (
                <section key={cat.id} className="mb-5 rounded-2xl border border-primary/15 bg-white/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-primary">{cat.label}</h3>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${completed === 12 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                      {completed} / 12
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {months.map((m) => {
                      const items = filesForMonth(cat.id, m.key);
                      const ok = items.length > 0;
                      const isUploading = uploading?.startsWith(`${cat.id}-${m.key}`);
                      return (
                        <label
                          key={m.key}
                          className={`group relative flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 text-xs transition ${
                            ok
                              ? "border-emerald-400/50 bg-emerald-50"
                              : "border-rose-300/60 bg-rose-50/50 hover:border-rose-400"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${ok ? "text-emerald-800" : "text-rose-700"}`}>{m.label}</span>
                            {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
                          </div>
                          {items.length > 0 ? (
                            <div className="space-y-0.5">
                              {items.map((f) => (
                                <div key={f.path} className="flex items-center justify-between gap-1 truncate text-[10px] text-emerald-700/90">
                                  <span className="truncate">{f.file_name}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      removeFile(f.path);
                                    }}
                                    className="text-rose-500 hover:text-rose-700"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-rose-600/80">
                              {isUploading ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Качване…</>
                              ) : (
                                <><Upload className="h-3 w-3" /> Качи документ</>
                              )}
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadFile(file, cat.id, m.key);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Single documents */}
            <section className="mb-5 grid gap-3 sm:grid-cols-2">
              {SINGLE_DOCS.map((d) => {
                const items = filesForCategory(d.id);
                const ok = items.length > 0;
                const isUploading = uploading?.startsWith(`${d.id}-single`);
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer flex-col gap-2 rounded-2xl border-2 border-dashed p-4 text-sm transition ${
                      ok ? "border-emerald-400 bg-emerald-50" : "border-primary/25 bg-white/70 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <d.icon className="h-5 w-5 text-primary" />
                        <span className="font-medium text-primary">{d.label}</span>
                      </div>
                      {ok ? <Check className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-rose-500" />}
                    </div>
                    {items.length > 0 ? (
                      <div className="space-y-1 text-xs text-emerald-800">
                        {items.map((f) => (
                          <div key={f.path} className="flex items-center justify-between gap-2">
                            <span className="truncate">{f.file_name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                removeFile(f.path);
                              }}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-primary/65">
                        {isUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Качване…</> : <><Upload className="h-3.5 w-3.5" /> Качи документ</>}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file, d.id);
                        e.target.value = "";
                      }}
                    />
                  </label>
                );
              })}
            </section>

            {/* Submit */}
            <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-primary/15 bg-[linear-gradient(180deg,#fbf6ec_0%,#f4ead5_100%)] px-4 py-3 md:-mx-6 md:px-6">
              <p className="text-[11px] text-primary/65">
                * Можете да изпратите заявлението и с частична документация — нашите консултанти ще се свържат с Вас за останалите документи.
              </p>
              <Button onClick={submit} disabled={submitting} className="gold-cta-button h-12 w-full text-base">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Изпращане…</> : "Изпрати заявление"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">{label}</span>
      {children}
    </label>
  );
}
