import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Sun,
  Sofa,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPublicImage } from "@/lib/upload-public-image";
import {
  attachPhotoResult,
  listPhotoDesk,
  listPropertyPhotoSources,
  processPhotoJob,
  type PhotoJobType,
  type StagingStyle,
} from "@/lib/photo-jobs.functions";

export const Route = createFileRoute("/admin/photos")({
  validateSearch: (s: Record<string, unknown>) => ({
    property: typeof s.property === "string" ? s.property : undefined,
  }),
  component: PhotosPage,
});

type Desk = Awaited<ReturnType<typeof listPhotoDesk>>;

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

const TYPE_META: Record<PhotoJobType, { label: string; hint: string; icon: typeof Wand2 }> = {
  enhance: { label: "Подобри", hint: "Светлина, острота, баланс — без да се сменя обстановката", icon: Wand2 },
  hdr: { label: "HDR", hint: "По-равномерна светлина, възстановени сенки и светлини", icon: Sun },
  staging: { label: "Виртуално обзавеждане", hint: "Добавя мебели върху същата стая, оригиналът остава", icon: Sofa },
};

function statusLabel(status: string) {
  if (status === "done") return "Готово";
  if (status === "error") return "Грешка";
  if (status === "processing") return "Обработва се";
  return "Чака";
}

function PhotosPage() {
  const search = Route.useSearch();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState(search.property ?? "");
  const [jobType, setJobType] = useState<PhotoJobType>("enhance");
  const [stagingStyle, setStagingStyle] = useState<StagingStyle>("living");
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [sources, setSources] = useState<Array<{ id: string; url: string; is_cover: boolean }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const d = await listPhotoDesk();
      setDesk(d);
    } catch (e: any) {
      toast.error(e?.message ?? "Не мога да заредя снимките");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (search.property) setPropertyId(search.property);
  }, [search.property]);

  useEffect(() => {
    if (!propertyId || !isUuid(propertyId)) {
      setSources([]);
      return;
    }
    void listPropertyPhotoSources({ data: { property_id: propertyId } })
      .then((r) => setSources(r.images as Array<{ id: string; url: string; is_cover: boolean }>))
      .catch(() => setSources([]));
  }, [propertyId]);

  const property = useMemo(
    () => (desk?.properties ?? []).find((p: { id: string }) => p.id === propertyId) ?? null,
    [desk, propertyId],
  );

  const onUpload = async (file: File) => {
    setBusy("upload");
    try {
      const url = await uploadPublicImage(file, "photo-jobs/inbox");
      setSourceUrl(url);
      toast.success("Снимката е качена. Изберете обработка.");
    } catch (e: any) {
      toast.error(e?.message ?? "Качването се провали");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (!sourceUrl) {
      toast.error("Изберете или качете снимка");
      return;
    }
    setBusy("process");
    try {
      const res = await processPhotoJob({
        data: {
          property_id: isUuid(propertyId) ? propertyId : null,
          source_url: sourceUrl,
          job_type: jobType,
          staging_style: jobType === "staging" ? stagingStyle : null,
        },
      });
      toast.success("Обработката е готова. Оригиналът не е презаписан.");
      setSourceUrl(res.result_url);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Обработката се провали");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const attach = async (jobId: string, propId: string | null) => {
    const target = (propId && isUuid(propId) ? propId : null) || (isUuid(propertyId) ? propertyId : "");
    if (!target) {
      toast.error("Изберете имот, към който да се прикачи резултатът");
      return;
    }
    setBusy(`attach-${jobId}`);
    try {
      await attachPhotoResult({ data: { job_id: jobId, property_id: target } });
      toast.success("Прикачена е като нова снимка към имота. Оригиналът е запазен.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Прикачването се провали");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-amber-100/70">
        <Loader2 className="h-5 w-5 animate-spin" /> Зареждане…
      </div>
    );
  }

  const stats = desk?.stats;
  const mixTotal = (stats?.mix.enhance ?? 0) + (stats?.mix.hdr ?? 0) + (stats?.mix.staging ?? 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl text-amber-100">
          <ImageIcon className="h-6 w-6" /> AI обработка на снимки
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-amber-100/60">
          Подобряване, HDR и виртуално обзавеждане на снимки към обяви. Резултатът се записва отделно — оригиналът не се трие.
        </p>
      </header>

      {!desk?.aiReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <div className="font-semibold">AI ключовете липсват</div>
            <p className="mt-1 text-amber-100/70">{desk?.aiHint}</p>
            <p className="mt-1 text-amber-100/50">Можете да разглеждате историята и да качвате снимки. Обработката тръгва след ключовете.</p>
          </div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Задачи днес" value={String(stats?.jobsToday ?? 0)} />
        <StatCard
          label="Успех днес"
          value={stats?.successRate == null ? "—" : `${stats.successRate}%`}
        />
        <div className="rounded-2xl border border-amber-200/15 bg-black/25 p-4">
          <div className="text-xs uppercase tracking-wider text-amber-100/50">Микс днес</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-100/80">
            <MixPill label="Подобри" n={stats?.mix.enhance ?? 0} total={mixTotal} />
            <MixPill label="HDR" n={stats?.mix.hdr ?? 0} total={mixTotal} />
            <MixPill label="Обзавеждане" n={stats?.mix.staging ?? 0} total={mixTotal} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/15 bg-black/25 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200/80">Обработка</h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="block">
            <div className="mb-1 text-xs text-amber-100/50">Имот (по избор)</div>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setSourceUrl("");
              }}
              className="w-full rounded-xl border border-amber-200/20 bg-black/40 px-3 py-2.5 text-sm text-amber-50"
            >
              <option value="">— без имот / само качване —</option>
              {(desk?.properties ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.cities?.name ? ` · ${p.cities.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          {property?.cover_image_url ? (
            <img src={property.cover_image_url} alt="" className="h-[72px] w-full rounded-xl object-cover opacity-90" />
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        {sources.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs text-amber-100/50">Снимки към обявата</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {sources.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSourceUrl(img.url)}
                  className={`overflow-hidden rounded-lg border ${
                    sourceUrl === img.url ? "border-amber-300 ring-2 ring-amber-300/40" : "border-amber-200/15"
                  }`}
                >
                  <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-amber-200/30 text-amber-100"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "upload"}
          >
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Качи снимка
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = "";
            }}
          />
          {sourceUrl && !sourceUrl.startsWith("data:") && (
            <span className="truncate text-xs text-amber-100/50">Избрана снимка</span>
          )}
        </div>

        {sourceUrl ? (
          <img src={sourceUrl} alt="" className="mt-4 max-h-56 rounded-xl border border-amber-200/15 object-contain" />
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {(Object.keys(TYPE_META) as PhotoJobType[]).map((key) => {
            const meta = TYPE_META[key];
            const Icon = meta.icon;
            const on = jobType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setJobType(key)}
                className={`rounded-xl border px-3 py-3 text-left ${
                  on ? "border-amber-300 bg-amber-300/15 text-amber-50" : "border-amber-200/20 text-amber-100/70"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" /> {meta.label}
                </div>
                <div className="mt-1 text-[11px] text-amber-100/50">{meta.hint}</div>
              </button>
            );
          })}
        </div>

        {jobType === "staging" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStagingStyle("living")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                stagingStyle === "living" ? "border-amber-300 bg-amber-300 text-[#2a0a12]" : "border-amber-200/25 text-amber-100/70"
              }`}
            >
              Дневна
            </button>
            <button
              type="button"
              onClick={() => setStagingStyle("empty")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                stagingStyle === "empty" ? "border-amber-300 bg-amber-300 text-[#2a0a12]" : "border-amber-200/25 text-amber-100/70"
              }`}
            >
              Празно помещение
            </button>
          </div>
        )}

        <div className="mt-5">
          <Button
            onClick={run}
            disabled={!!busy || !desk?.aiReady}
            className="bg-amber-400 text-[#2a0a12] hover:bg-amber-300"
          >
            {busy === "process" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Обработи снимка
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200/80">История</h2>
        <div className="space-y-3">
          {(desk?.jobs ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200/20 px-4 py-8 text-center text-sm text-amber-100/40">
              Още няма обработки.
            </div>
          ) : (
            (desk?.jobs ?? []).map((job: any) => (
              <div
                key={job.id}
                className="grid gap-3 rounded-2xl border border-amber-200/15 bg-black/25 p-4 md:grid-cols-[1fr_1fr_220px]"
              >
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-amber-100/40">Оригинал</div>
                  {job.source_url ? (
                    <img src={job.source_url} alt="" className="h-36 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-amber-200/15 text-xs text-amber-100/40">
                      качена снимка
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-amber-100/40">Резултат</div>
                  {job.result_url ? (
                    <img src={job.result_url} alt="" className="h-36 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-amber-200/15 text-xs text-amber-100/40">
                      {job.error_message ? job.error_message.slice(0, 180) : "няма резултат"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="font-semibold text-amber-50">
                    {TYPE_META[job.job_type as PhotoJobType]?.label ?? job.job_type}
                    {job.staging_style === "living" ? " · дневна" : job.staging_style === "empty" ? " · празно" : ""}
                  </div>
                  <div className="flex items-center gap-1 text-amber-100/60">
                    {job.status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : job.status === "error" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {statusLabel(job.status)}
                  </div>
                  <div className="text-[11px] text-amber-100/40">
                    {new Date(job.created_at).toLocaleString("bg-BG")}
                    {job.provider ? ` · ${job.provider}` : ""}
                  </div>
                  {job.status === "done" && job.result_url && !job.attached_image_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto border-amber-200/30 text-amber-100"
                      disabled={busy === `attach-${job.id}`}
                      onClick={() => attach(job.id, job.property_id)}
                    >
                      {busy === `attach-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Прикачи към имота
                    </Button>
                  )}
                  {job.attached_image_id && (
                    <div className="text-[11px] text-emerald-300">Прикачена към галерията</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-black/25 p-4">
      <div className="text-xs uppercase tracking-wider text-amber-100/50">{label}</div>
      <div className="mt-1 font-display text-3xl text-amber-100">{value}</div>
    </div>
  );
}

function MixPill({ label, n, total }: { label: string; n: number; total: number }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <span className="rounded-full border border-amber-200/20 px-2.5 py-1">
      {label} {n}
      {total ? ` · ${pct}%` : ""}
    </span>
  );
}
