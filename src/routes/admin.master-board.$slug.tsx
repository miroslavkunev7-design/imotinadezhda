import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Ban, Check, Expand, ImageOff, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { findRowBySlug } from "@/lib/master-board-slug";
import {
  PROCESS_BANS,
  PROCESS_CHAIN,
  PROCESS_LOCK_NOTE,
  PROCESS_STEPS,
} from "@/lib/page-process-rules";
import {
  addBoardStage,
  deleteBoardStage,
  listBoardStages,
  listBoardState,
  setBoardApproval,
  setBoardProgress,
  setBoardStageDone,
  type BoardStage,
} from "@/lib/master-board.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/master-board/$slug")({
  head: () => ({
    meta: [
      { title: "Стадии на референция | Имоти Надежда" },
      { name: "description", content: "MASTER референция и задължителни етапи за реализация." },
      { property: "og:title", content: "Стадии на референция | Имоти Надежда" },
      {
        property: "og:description",
        content: "MASTER референция и задължителни етапи за реализация.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StagePage,
});

const WINE = "#7d0b24";

function StagePage() {
  const { slug } = Route.useParams();
  const row = findRowBySlug(slug);
  const qc = useQueryClient();

  const loadState = useServerFn(listBoardState);
  const loadStages = useServerFn(listBoardStages);
  const saveProgress = useServerFn(setBoardProgress);
  const saveApproval = useServerFn(setBoardApproval);
  const createStage = useServerFn(addBoardStage);
  const toggleStage = useServerFn(setBoardStageDone);
  const removeStage = useServerFn(deleteBoardStage);

  const route = row?.route ?? "";

  const stateQuery = useQuery({ queryKey: ["visual-board-state"], queryFn: () => loadState() });
  const stagesQuery = useQuery({
    queryKey: ["visual-board-stages", route],
    queryFn: () => loadStages({ data: { route } }),
    enabled: Boolean(route),
  });

  const state = useMemo(
    () => (stateQuery.data ?? []).find((s) => s.route === route) ?? null,
    [stateQuery.data, route],
  );

  const flags = state?.stage_flags ?? {};
  const [notes, setNotes] = useState("");
  const [percent, setPercent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [viewer, setViewer] = useState<{ src: string; label: string } | null>(null);

  useEffect(() => {
    setNotes(state?.notes ?? "");
    setPercent(state?.match_percent == null ? "" : String(state.match_percent));
  }, [state?.notes, state?.match_percent]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["visual-board-state"] });
    void qc.invalidateQueries({ queryKey: ["visual-board-stages", route] });
  };

  const progress = useMutation({
    mutationFn: (v: {
      stage_flags: Record<string, boolean>;
      match_percent?: number | null;
      notes?: string | null;
    }) =>
      saveProgress({
        data: {
          route,
          stage_flags: v.stage_flags,
          match_percent: v.match_percent ?? (percent === "" ? null : Number(percent)),
          notes: v.notes ?? (notes || null),
        },
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const approval = useMutation({
    mutationFn: (approved: boolean) => saveApproval({ data: { route, approved } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const stageAdd = useMutation({
    mutationFn: () => createStage({ data: { route, title: newTitle, detail: newDetail } }),
    onSuccess: () => {
      setNewTitle("");
      setNewDetail("");
      toast.success("Стадият е добавен");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stageToggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggleStage({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const stageDelete = useMutation({
    mutationFn: (id: string) => removeStage({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!row) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Страницата не е намерена в таблицата</h1>
        <Link to="/admin/master-board" className="text-sm underline">
          Обратно към таблицата
        </Link>
      </div>
    );
  }

  const stages: BoardStage[] = stagesQuery.data ?? [];
  const lockedDone = PROCESS_STEPS.filter((s) => flags[s.key]).length;
  const extraDone = stages.filter((s) => s.done).length;
  const total = PROCESS_STEPS.length + stages.length;
  const doneTotal = lockedDone + extraDone;
  const pct = total === 0 ? 0 : Math.round((doneTotal / total) * 100);
  const approved = state?.approved ?? row.approvedByDefault;

  const setFlag = (key: string, value: boolean) =>
    progress.mutate({ stage_flags: { ...flags, [key]: value } });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/master-board"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Таблица с референции
        </Link>
      </div>

      <header
        className="rounded-xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${WINE}, #4f0314)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/70">
              {row.category} · ред {row.num || "—"}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{row.page}</h1>
            <div className="font-mono text-xs text-white/80">{row.path}</div>
          </div>
          <Button
            variant="secondary"
            disabled={approval.isPending}
            onClick={() => approval.mutate(!approved)}
          >
            <Check className="mr-1 h-4 w-4" />
            {approved ? "Махни одобрението" : "Отбележи като готова"}
          </Button>
        </div>

        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs text-white/85">
            <span>
              Изпълнени стадии: {doneTotal} от {total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[#c59441] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {state?.approved_at && (
            <div className="mt-2 text-[11px] text-white/75">
              Одобрена от {state.approved_by_name} ·{" "}
              {new Date(state.approved_at).toLocaleString("bg-BG")}
            </div>
          )}
        </div>
      </header>

      <section className="w-full overflow-x-auto pb-2">
        <div className="grid w-max grid-cols-[580px_330px] items-start gap-4 xl:grid-cols-[620px_340px]">
          <Ref
            src={row.desktop}
            label={row.desktopLabel}
            placeholderRatio="16 / 9"
            onOpen={setViewer}
          />
          <Ref
            src={row.mobile}
            label={row.mobileLabel}
            placeholderRatio="9 / 16"
            onOpen={setViewer}
          />
        </div>
      </section>

      <div className="rounded-lg p-3 text-xs font-semibold text-white" style={{ background: WINE }}>
        {PROCESS_CHAIN}
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lock className="h-4 w-4" style={{ color: WINE }} /> Задължителни стадии
        </h2>
        {PROCESS_STEPS.map((s) => {
          const done = Boolean(flags[s.key]);
          return (
            <label
              key={s.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={done}
                disabled={progress.isPending}
                onChange={(e) => setFlag(s.key, e.target.checked)}
                className="mt-1 h-5 w-5 accent-[#1c6b35]"
              />
              <span>
                <span className="font-semibold">
                  {s.order}. {s.title}
                </span>
                <span className="block text-sm text-muted-foreground">{s.detail}</span>
              </span>
            </label>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Допълнителни стадии за тази страница</h2>
        {stages.length === 0 && (
          <p className="text-sm text-muted-foreground">Още няма добавени стадии.</p>
        )}
        {stages.map((s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <input
              type="checkbox"
              checked={s.done}
              disabled={stageToggle.isPending}
              onChange={(e) => stageToggle.mutate({ id: s.id, done: e.target.checked })}
              className="mt-1 h-5 w-5 accent-[#1c6b35]"
            />
            <div className="flex-1">
              <div className="font-semibold">{s.title}</div>
              {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
              {s.done && s.done_at && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Готово · {s.done_by_name} · {new Date(s.done_at).toLocaleString("bg-BG")}
                </div>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Изтрий стадия"
              disabled={stageDelete.isPending}
              onClick={() => stageDelete.mutate(s.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Име на нов стадий (например: Галерия със снимки)"
          />
          <Textarea
            value={newDetail}
            onChange={(e) => setNewDetail(e.target.value)}
            placeholder="Кратко описание (по желание)"
            rows={2}
          />
          <Button
            disabled={stageAdd.isPending || newTitle.trim() === ""}
            onClick={() => stageAdd.mutate()}
            style={{ background: WINE }}
          >
            <Plus className="mr-1 h-4 w-4" /> Добави стадий
          </Button>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium">Съвпадение (%)</label>
          <Input
            value={percent}
            inputMode="numeric"
            onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="98"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Бележки</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <div className="sm:col-span-2">
          <Button
            variant="outline"
            disabled={progress.isPending}
            onClick={() =>
              progress.mutate({
                stage_flags: flags,
                match_percent: percent === "" ? null : Number(percent),
                notes: notes || null,
              })
            }
          >
            Запази
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
          <Ban className="h-4 w-4" /> Забранено
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {PROCESS_BANS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">{PROCESS_LOCK_NOTE}</p>

      <Dialog open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="h-[96dvh] w-[96vw] max-w-[96vw] overflow-auto border-0 bg-background/95 p-3 sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewer?.label ?? "Референция"}</DialogTitle>
            <DialogDescription>Преглед на референцията в пълен размер</DialogDescription>
          </DialogHeader>
          {viewer ? (
            <div className="flex h-full min-h-0 min-w-0 items-center justify-center">
              <img
                src={viewer.src}
                alt={viewer.label}
                className="block h-auto max-h-full w-auto max-w-full object-contain object-top"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ref({
  src,
  label,
  placeholderRatio,
  onOpen,
}: {
  src: string | null;
  label: string;
  placeholderRatio: string;
  onOpen: (image: { src: string; label: string }) => void;
}) {
  if (!src) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-4 text-center text-xs text-muted-foreground"
        style={{ aspectRatio: placeholderRatio }}
      >
        <ImageOff className="h-5 w-5" />
        {label}
      </div>
    );
  }
  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => onOpen({ src, label })}
        className="group relative block w-full border bg-muted/30 text-left"
        aria-label={`Отвори в пълен размер: ${label}`}
      >
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="block h-auto min-h-0 w-full max-w-full object-contain object-top [aspect-ratio:auto] [max-height:none]"
        />
        <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
      <figcaption className="text-[11px] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
