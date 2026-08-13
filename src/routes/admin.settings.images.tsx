import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { Image as ImageIcon, Upload, Loader2, Eye, EyeOff, Trash2, Plus, Check, X, ArrowLeft } from "lucide-react";
import { uploadPublicImage } from "@/lib/upload-public-image";
import {
  listPageBackgrounds,
  setPageBackground,
  setMyCrmBackground,
  listCityCards,
  listQuarterCards,
  updateCityCard,
  updateQuarterCard,
  deleteCityCard,
  deleteQuarterCard,
  createCityCard,
  createQuarterCard,
} from "@/lib/site-images.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings/images")({ component: Page });

const PAGES: { key: string; label: string }[] = [
  { key: "home", label: "Начало" },
  { key: "sale", label: "За продажба" },
  { key: "rent", label: "Под наем" },
  { key: "about", label: "За нас" },
  { key: "contacts", label: "Контакти" },
];

function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-amber-100">Промяна на снимки</h1>
            <p className="mt-1 text-sm text-amber-100/60">
              Сменяй background-а на сайта, личния си CRM фон и снимките на картите.
            </p>
          </div>
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Назад
          </Link>
        </div>

        <PageBackgroundsSection />
        <CrmBackgroundSection />
        <CityCardsSection />
        <QuarterCardsSection />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Reusable card                                                    */
/* ---------------------------------------------------------------- */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-5 backdrop-blur md:p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg text-amber-100">{title}</h2>
        {description && <p className="mt-1 text-xs text-amber-100/60">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DevicePreview({ imageUrl, mode }: { imageUrl: string | null; mode: "desktop" | "mobile" }) {
  const frame =
    mode === "desktop"
      ? "aspect-[16/10] w-full max-w-[420px] rounded-lg border-2 border-amber-500/40"
      : "h-[300px] w-[150px] rounded-[18px] border-2 border-amber-500/40";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${frame} overflow-hidden bg-[#2b1418] shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}
        style={
          imageUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(20,4,8,0.45), rgba(20,4,8,0.65)), url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!imageUrl && (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-amber-100/40">
            (няма снимка)
          </div>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-amber-100/50">
        {mode === "desktop" ? "Desktop" : "Mobile"}
      </span>
    </div>
  );
}

function UploadButton({
  onFile,
  busy,
  label = "Качи снимка",
}: {
  onFile: (f: File) => void;
  busy?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-amber-300/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:from-amber-500/40 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {label}
      </button>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Section A: Page backgrounds                                      */
/* ---------------------------------------------------------------- */

function PageBackgroundsSection() {
  const [bgs, setBgs] = useState<Record<string, { image_url: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    listPageBackgrounds().then(setBgs).catch(() => {});
  }, []);

  async function handleUpload(pageKey: string, file: File) {
    setBusyKey(pageKey);
    try {
      const url = await uploadPublicImage(file, `page-bg/${pageKey}`);
      setDrafts((d) => ({ ...d, [pageKey]: url }));
      toast.success("Снимката е качена. Натисни „Запази“ за да приложиш.");
    } catch (e) {
      toast.error("Грешка при качване: " + (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSave(pageKey: string) {
    const url = drafts[pageKey];
    if (!url) return;
    setBusyKey(pageKey);
    try {
      await setPageBackground({ data: { page_key: pageKey, image_url: url } });
      setBgs((b) => ({ ...b, [pageKey]: { image_url: url } }));
      setDrafts((d) => {
        const next = { ...d };
        delete next[pageKey];
        return next;
      });
      toast.success("Запазено.");
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Section
      title="Background на сайта (глобално)"
      description="Видимо за всички посетители. Качи снимка, виж preview за десктоп и мобилен, после запази."
    >
      <div className="space-y-6">
        {PAGES.map((p) => {
          const current = bgs[p.key]?.image_url ?? null;
          const draft = drafts[p.key] ?? null;
          const preview = draft ?? current;
          return (
            <div key={p.key} className="rounded-xl border border-amber-500/15 bg-[rgba(20,4,8,0.4)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <ImageIcon className="h-4 w-4 text-amber-300" /> {p.label}
                </div>
                <div className="flex items-center gap-2">
                  <UploadButton onFile={(f) => handleUpload(p.key, f)} busy={busyKey === p.key} />
                  {draft && (
                    <>
                      <button
                        onClick={() => handleSave(p.key)}
                        disabled={busyKey === p.key}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Запази
                      </button>
                      <button
                        onClick={() =>
                          setDrafts((d) => {
                            const n = { ...d };
                            delete n[p.key];
                            return n;
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/80 hover:bg-amber-500/10"
                      >
                        <X className="h-3.5 w-3.5" /> Откажи
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <DevicePreview imageUrl={preview} mode="desktop" />
                <DevicePreview imageUrl={preview} mode="mobile" />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- */
/* Section B: Personal CRM background                               */
/* ---------------------------------------------------------------- */

function CrmBackgroundSection() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("crm_background_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setCurrent(data?.crm_background_url ?? null));
  }, [user]);

  async function handleUpload(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadPublicImage(file, `crm-bg/${user.id}`);
      setDraft(url);
      toast.success("Снимката е качена. Натисни „Запази“ за да приложиш.");
    } catch (e) {
      toast.error("Грешка при качване: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setBusy(true);
    try {
      await setMyCrmBackground({ data: { image_url: draft } });
      setCurrent(draft);
      setDraft(null);
      toast.success("Запазено. Презареди CRM, за да го видиш.");
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    try {
      await setMyCrmBackground({ data: { image_url: null } });
      setCurrent(null);
      setDraft(null);
      toast.success("Върнат е дефолтният фон.");
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = draft ?? current;

  return (
    <Section
      title="Background на CRM (само за теб)"
      description="Личен фон само за твоя профил в админ панела. Не влияе на други потребители или на сайта."
    >
      <div className="flex flex-wrap items-end gap-6">
        <DevicePreview imageUrl={preview} mode="desktop" />
        <DevicePreview imageUrl={preview} mode="mobile" />
        <div className="flex flex-col gap-2">
          <UploadButton onFile={handleUpload} busy={busy} />
          {draft && (
            <button
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Запази
            </button>
          )}
          {current && (
            <button
              onClick={handleReset}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/80 hover:bg-amber-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Върни дефолт
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- */
/* Section C: City cards                                            */
/* ---------------------------------------------------------------- */

type CityRow = {
  id: string;
  name: string;
  slug: string;
  hero_image_url: string | null;
  is_published: boolean;
  display_order: number | null;
};

function CityCardsSection() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = () => listCityCards().then((r) => setCities(r as CityRow[])).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  async function handleReplaceImage(id: string, file: File) {
    setBusyId(id);
    try {
      const url = await uploadPublicImage(file, `cities`);
      await updateCityCard({ data: { id, hero_image_url: url } });
      toast.success("Снимката е сменена.");
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublish(c: CityRow) {
    setBusyId(c.id);
    try {
      await updateCityCard({ data: { id: c.id, is_published: !c.is_published } });
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: CityRow) {
    if (!confirm(`Изтрий град „${c.name}“?`)) return;
    setBusyId(c.id);
    try {
      await deleteCityCard({ data: { id: c.id } });
      toast.success("Изтрит.");
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section
      title="Карти Градове"
      description="Сменяй снимка, скривай / показвай или добавяй нови карти градове."
    >
      <div className="mb-4">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-amber-300/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:from-amber-500/40"
        >
          <Plus className="h-3.5 w-3.5" /> Добави нов град
        </button>
      </div>
      {adding && (
        <AddCityForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => (
          <CardTile
            key={c.id}
            name={c.name}
            slug={c.slug}
            imageUrl={c.hero_image_url}
            published={c.is_published}
            busy={busyId === c.id}
            onReplace={(f) => handleReplaceImage(c.id, f)}
            onTogglePublish={() => handleTogglePublish(c)}
            onDelete={() => handleDelete(c)}
          />
        ))}
      </div>
    </Section>
  );
}

function AddCityForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function autoSlug(v: string) {
    setName(v);
    if (!slug) {
      setSlug(
        v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 60),
      );
    }
  }

  async function handleUpload(f: File) {
    setBusy(true);
    try {
      const url = await uploadPublicImage(f, "cities");
      setImageUrl(url);
    } catch (e) {
      toast.error("Грешка при качване: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!name || !slug) {
      toast.error("Попълни име и slug.");
      return;
    }
    setBusy(true);
    try {
      await createCityCard({ data: { name, slug, hero_image_url: imageUrl ?? undefined } });
      toast.success("Добавен.");
      onSaved();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-amber-500/30 bg-[rgba(20,4,8,0.5)] p-4 sm:grid-cols-2">
      <input
        value={name}
        onChange={(e) => autoSlug(e.target.value)}
        placeholder="Име (напр. Варна)"
        className="rounded-md border border-amber-500/30 bg-[#1a0608] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug (напр. varna)"
        className="rounded-md border border-amber-500/30 bg-[#1a0608] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <UploadButton onFile={handleUpload} busy={busy} label={imageUrl ? "Смени снимка" : "Качи снимка"} />
        {imageUrl && <img src={imageUrl} alt="" className="h-12 w-16 rounded object-cover" />}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="rounded-md border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/80 hover:bg-amber-500/10"
        >
          Откажи
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Запази
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Section D: Quarter cards                                         */
/* ---------------------------------------------------------------- */

type QuarterRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_published: boolean;
  display_order: number | null;
  city_id: string;
};

function QuarterCardsSection() {
  const [quarters, setQuarters] = useState<QuarterRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    listQuarterCards().then((r) => setQuarters(r as QuarterRow[])).catch(() => {});
    listCityCards().then((r) => setCities(r as CityRow[])).catch(() => {});
  };
  useEffect(() => {
    refresh();
  }, []);

  async function handleReplaceImage(id: string, file: File) {
    setBusyId(id);
    try {
      const url = await uploadPublicImage(file, `quarters`);
      await updateQuarterCard({ data: { id, image_url: url } });
      toast.success("Снимката е сменена.");
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublish(q: QuarterRow) {
    setBusyId(q.id);
    try {
      await updateQuarterCard({ data: { id: q.id, is_published: !q.is_published } });
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(q: QuarterRow) {
    if (!confirm(`Изтрий квартал „${q.name}“?`)) return;
    setBusyId(q.id);
    try {
      await deleteQuarterCard({ data: { id: q.id } });
      toast.success("Изтрит.");
      refresh();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section
      title="Карти Квартали"
      description="Сменяй снимка, скривай / показвай или добавяй нови карти квартали."
    >
      <div className="mb-4">
        <button
          onClick={() => setAdding(true)}
          disabled={cities.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-amber-300/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:from-amber-500/40 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Добави нов квартал
        </button>
      </div>
      {adding && (
        <AddQuarterForm
          cities={cities}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quarters.map((q) => {
          const city = cities.find((c) => c.id === q.city_id);
          return (
            <CardTile
              key={q.id}
              name={q.name}
              slug={`${city?.name ?? "—"} · ${q.slug}`}
              imageUrl={q.image_url}
              published={q.is_published}
              busy={busyId === q.id}
              onReplace={(f) => handleReplaceImage(q.id, f)}
              onTogglePublish={() => handleTogglePublish(q)}
              onDelete={() => handleDelete(q)}
            />
          );
        })}
      </div>
    </Section>
  );
}

function AddQuarterForm({
  cities,
  onCancel,
  onSaved,
}: {
  cities: CityRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function autoSlug(v: string) {
    setName(v);
    if (!slug) {
      setSlug(
        v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 60),
      );
    }
  }

  async function handleUpload(f: File) {
    setBusy(true);
    try {
      const url = await uploadPublicImage(f, "quarters");
      setImageUrl(url);
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!cityId || !name || !slug) {
      toast.error("Попълни всички полета.");
      return;
    }
    setBusy(true);
    try {
      await createQuarterCard({
        data: { city_id: cityId, name, slug, image_url: imageUrl ?? undefined },
      });
      toast.success("Добавен.");
      onSaved();
    } catch (e) {
      toast.error("Грешка: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-amber-500/30 bg-[rgba(20,4,8,0.5)] p-4 sm:grid-cols-3">
      <select
        value={cityId}
        onChange={(e) => setCityId(e.target.value)}
        className="rounded-md border border-amber-500/30 bg-[#1a0608] px-3 py-2 text-sm text-amber-100"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => autoSlug(e.target.value)}
        placeholder="Име (напр. Лазур)"
        className="rounded-md border border-amber-500/30 bg-[#1a0608] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug (напр. lazur)"
        className="rounded-md border border-amber-500/30 bg-[#1a0608] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30"
      />
      <div className="flex items-center gap-3 sm:col-span-3">
        <UploadButton onFile={handleUpload} busy={busy} label={imageUrl ? "Смени снимка" : "Качи снимка"} />
        {imageUrl && <img src={imageUrl} alt="" className="h-12 w-16 rounded object-cover" />}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="rounded-md border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/80 hover:bg-amber-500/10"
        >
          Откажи
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Запази
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Card tile (city/quarter)                                         */
/* ---------------------------------------------------------------- */

function CardTile({
  name,
  slug,
  imageUrl,
  published,
  busy,
  onReplace,
  onTogglePublish,
  onDelete,
}: {
  name: string;
  slug: string;
  imageUrl: string | null;
  published: boolean;
  busy: boolean;
  onReplace: (f: File) => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.5)]">
      <div
        className="relative aspect-[16/10] bg-[#2b1418]"
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!imageUrl && (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-amber-100/40">
            (няма снимка)
          </div>
        )}
        {!published && (
          <span className="absolute left-2 top-2 rounded bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            Скрит
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold text-amber-100">{name}</div>
        <div className="truncate text-[11px] text-amber-100/50">{slug}</div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <UploadButton onFile={onReplace} busy={busy} label="Смени" />
          <button
            onClick={onTogglePublish}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 px-2 py-1 text-[11px] text-amber-100/80 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {published ? "Скрий" : "Покажи"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Изтрий
          </button>
        </div>
      </div>
    </div>
  );
}
