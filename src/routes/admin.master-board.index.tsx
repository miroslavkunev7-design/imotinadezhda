import { createFileRoute, Link } from "@tanstack/react-router";
import { routeToSlug } from "@/lib/master-board-slug";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, ListChecks, ImageOff, Ban, Expand } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  MASTER_BOARD_ROWS,
  MASTER_BOARD_SUBTITLE,
  MASTER_BOARD_COUNTS,
  MASTER_BOARD_FOOTER,
  type MasterBoardRow,
} from "@/lib/master-board-data";
import {
  PROCESS_STEPS,
  PROCESS_BANS,
  PROCESS_CHAIN,
  PROCESS_LOCK_NOTE,
} from "@/lib/page-process-rules";
import { listBoardState, setBoardApproval, type BoardState } from "@/lib/master-board.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/master-board/")({
  head: () => ({
    meta: [
      { title: "Таблица с референции | Имоти Надежда" },
      { name: "description", content: "MASTER референции и етапи за страниците на Имоти Надежда." },
      { property: "og:title", content: "Таблица с референции | Имоти Надежда" },
      {
        property: "og:description",
        content: "MASTER референции и етапи за страниците на Имоти Надежда.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasterBoardPage,
});

const WINE = "#7d0b24";

function doneCount(flags: Record<string, boolean> | undefined): number {
  if (!flags) return 0;
  return PROCESS_STEPS.filter((s) => flags[s.key]).length;
}

function MasterBoardPage() {
  const qc = useQueryClient();
  const load = useServerFn(listBoardState);
  const save = useServerFn(setBoardApproval);
  const [processRoute, setProcessRoute] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ src: string; label: string } | null>(null);

  const stateQuery = useQuery({ queryKey: ["visual-board-state"], queryFn: () => load() });

  const approval = useMutation({
    mutationFn: (v: { route: string; approved: boolean }) => save({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["visual-board-state"] }),
  });

  const byRoute = useMemo(() => {
    const map = new Map<string, BoardState>();
    for (const s of stateQuery.data ?? []) map.set(s.route, s);
    return map;
  }, [stateQuery.data]);

  const isApproved = (row: MasterBoardRow) =>
    byRoute.get(row.route)?.approved ?? row.approvedByDefault;
  const approvedCount = MASTER_BOARD_ROWS.filter(isApproved).length;
  const activeRow = MASTER_BOARD_ROWS.find((r) => r.route === processRoute) ?? null;

  return (
    <div className="space-y-6" style={{ ["--wine" as string]: WINE }}>
      <header
        className="rounded-xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${WINE}, #4f0314)` }}
      >
        <h1 className="text-2xl font-bold">Таблица с референции</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/85">{MASTER_BOARD_SUBTITLE}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {MASTER_BOARD_COUNTS.map((c) => (
            <span key={c} className="rounded-full bg-white/15 px-3 py-1">
              {c}
            </span>
          ))}
          <span className="rounded-full bg-[#c59441] px-3 py-1 font-semibold text-[#3a0210]">
            {approvedCount} одобрени
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1">
            {MASTER_BOARD_ROWS.length - approvedCount} чакащи
          </span>
        </div>
      </header>

      <div className="w-full overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-white" style={{ background: WINE }}>
              <th className="w-14 px-3 py-3">#</th>
              <th className="w-28 px-3 py-3">Раздел</th>
              <th className="w-56 px-3 py-3">Страница</th>
              <th className="w-[580px] min-w-[580px] max-w-[580px] px-3 py-3 xl:w-[620px] xl:min-w-[620px] xl:max-w-[620px]">
                Desktop референция
              </th>
              <th className="w-[330px] min-w-[330px] max-w-[330px] px-3 py-3 xl:w-[340px] xl:min-w-[340px] xl:max-w-[340px]">
                Mobile референция
              </th>
              <th className="w-44 px-3 py-3">Статус</th>
              <th className="w-40 px-3 py-3">Процес / ✓</th>
            </tr>
          </thead>
          <tbody>
            {MASTER_BOARD_ROWS.map((row) => {
              const approved = isApproved(row);
              const st = byRoute.get(row.route);
              return (
                <tr key={row.route} className="border-b align-top last:border-0">
                  <td className="px-3 py-4 font-mono text-xs text-muted-foreground">{row.num}</td>
                  <td className="px-3 py-4">
                    <span
                      className="rounded-full px-2 py-1 text-[11px] font-semibold text-white"
                      style={{ background: row.category === "CRM" ? "#4f0314" : WINE }}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="font-semibold text-foreground">{row.page}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.path}</div>
                  </td>
                  <td className="px-3 py-4">
                    <RefCell
                      src={row.desktop}
                      label={row.desktopLabel}
                      placeholderRatio="16 / 9"
                      kind="desktop"
                      onOpen={setViewer}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <RefCell
                      src={row.mobile}
                      label={row.mobileLabel}
                      placeholderRatio="9 / 16"
                      kind="mobile"
                      onOpen={setViewer}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                      style={
                        row.statusKind === "ok"
                          ? { background: "#e8f6ec", color: "#1c6b35" }
                          : { background: "#fdf1e3", color: "#8a5a12" }
                      }
                    >
                      {row.statusLabel}
                    </span>
                    {st?.approved_at && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {st.approved_by_name} · {new Date(st.approved_at).toLocaleString("bg-BG")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/admin/master-board/$slug"
                          params={{ slug: routeToSlug(row.route) }}
                        >
                          <ListChecks className="mr-1 h-4 w-4" /> Стадии
                        </Link>
                      </Button>
                      <button
                        type="button"
                        aria-label={approved ? "Махни чекмарката" : "Отбележи като готова"}
                        disabled={approval.isPending}
                        onClick={() => approval.mutate({ route: row.route, approved: !approved })}
                        className="flex h-9 w-9 items-center justify-center rounded-md border transition"
                        style={
                          approved
                            ? { background: "#1c6b35", borderColor: "#1c6b35", color: "#fff" }
                            : { background: "transparent", color: "#9aa0a6" }
                        }
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {doneCount(byRoute.get(row.route)?.stage_flags)} / {PROCESS_STEPS.length}{" "}
                      задължителни стадии
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        {MASTER_BOARD_FOOTER}
      </p>

      <Dialog open={Boolean(activeRow)} onOpenChange={(o) => !o && setProcessRoute(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" style={{ color: WINE }} />
              Процес за: {activeRow?.page}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">{activeRow?.path}</DialogDescription>
          </DialogHeader>

          <div
            className="rounded-lg p-3 text-xs font-semibold text-white"
            style={{ background: WINE }}
          >
            {PROCESS_CHAIN}
          </div>

          <ol className="space-y-3">
            {PROCESS_STEPS.map((s) => (
              <li key={s.key} className="flex gap-3 rounded-lg border p-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: WINE }}
                >
                  {s.order}
                </span>
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <p className="text-sm text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
              <Ban className="h-4 w-4" /> Забранено
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {PROCESS_BANS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">{PROCESS_LOCK_NOTE}</p>
        </DialogContent>
      </Dialog>

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

function RefCell({
  src,
  label,
  placeholderRatio,
  kind,
  onOpen,
}: {
  src: string | null;
  label: string;
  placeholderRatio: string;
  kind: "desktop" | "mobile";
  onOpen: (image: { src: string; label: string }) => void;
}) {
  const fixedWidth =
    kind === "desktop"
      ? "w-[580px] min-w-[580px] xl:w-[620px] xl:min-w-[620px]"
      : "w-[330px] min-w-[330px] xl:w-[340px] xl:min-w-[340px]";
  if (!src) {
    return (
      <div
        className={`${fixedWidth} flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-4 text-center text-xs text-muted-foreground`}
        style={{ aspectRatio: placeholderRatio }}
      >
        <ImageOff className="h-5 w-5" />
        {label}
      </div>
    );
  }
  return (
    <figure className={`${fixedWidth} space-y-2`}>
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
