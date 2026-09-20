import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Users,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Star,
  BookOpen,
  Building2,
  FileText,
} from "lucide-react";

import notebookSpread from "@/assets/notebook/notebook-spread.jpg";
import logoWatermark from "@/assets/notebook/logo-watermark.png";
import stickyNote from "@/assets/notebook/sticky-note.png";
import { MortgageDocsModal } from "@/components/admin/mortgage-docs-modal";
import { BankFlowModal } from "@/components/admin/bank-flow-modal";
import { ClientA4Sheet } from "@/components/admin/client-a4-sheet";
import { getLiveRate, type IncomeOrigin } from "@/lib/mortgage-rates";

/** 10 цвята за маркера, който подчертава реда в тетрадката. */
const MARKER_COLORS = [
  "#f6d96a",
  "#f5a9ae",
  "#9bd6d0",
  "#b9b2f1",
  "#a8d98b",
  "#f4b183",
  "#8ec5f0",
  "#f39ad3",
  "#d9d2b4",
  "#c9a84c",
];

type AnyClient = any;

function initials(name: string) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })} г. ${d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}`;
}

const TYPE_LABEL: Record<string, string> = {
  buyer: "Купувач",
  seller: "Продавач",
  tenant: "Наемател",
  landlord: "Наемодател",
};

function criteria(c: AnyClient): string[] {
  const out: string[] = [];
  const pt: Record<string, string> = {
    apartment: "Апартамент",
    house: "Къща",
    office: "Офис",
    land: "Парцел",
    commercial: "Търговски имот",
  };
  if (c.search_property_type) out.push(pt[c.search_property_type] ?? c.search_property_type);
  if (c.cities?.name)
    out.push(`гр. ${c.cities.name}${c.quarters?.name ? `, ${c.quarters.name}` : ""}`);
  if (c.budget_max)
    out.push(`До ${Number(c.budget_max).toLocaleString("bg-BG")} ${c.currency ?? "EUR"}`);
  else if (c.budget_min)
    out.push(`От ${Number(c.budget_min).toLocaleString("bg-BG")} ${c.currency ?? "EUR"}`);
  if (c.rooms_min || c.rooms_max) out.push(`Стаи: ${c.rooms_min ?? "?"} – ${c.rooms_max ?? "?"}`);
  if (c.area_min) out.push(`Площ над ${c.area_min} кв.м.`);
  if (c.search_status) out.push(c.search_status === "rent" ? "Под наем" : "За продажба");
  return out;
}

export function ClientNotebook({
  clients,
  selectedId,
  onSelect,
  onNew,
  onOpen,
  search,
  onSearch,
}: {
  clients: AnyClient[];
  selectedId: string | null;
  onSelect: (c: AnyClient) => void;
  onNew: () => void;
  onOpen: (c: AnyClient) => void;
  search: string;
  onSearch: (v: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [isTurningPage, setIsTurningPage] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteColor, setNoteColor] = useState("#f6d96a");
  const [pinnedNotes, setPinnedNotes] = useState<{ id: number; text: string; color: string }[]>([]);
  const [letter, setLetter] = useState<string | null>(null);
  const [docsClient, setDocsClient] = useState<AnyClient | null>(null);
  const [bankClient, setBankClient] = useState<AnyClient | null>(null);
  const [a4Client, setA4Client] = useState<AnyClient | null>(null);
  const [markerColor, setMarkerColor] = useState(MARKER_COLORS[0]);
  const [rowMarks, setRowMarks] = useState<Record<string, string>>({});
  /** Локално запазени избори на банка, за да се виждат веднага след потвърждение. */
  const [bankByClient, setBankByClient] = useState<Record<string, string>>({});
  const bankOf = (c: AnyClient | null): string =>
    (c ? (bankByClient[c.id] ?? c.mortgage_data?.bank ?? "") : "") as string;

  const turnPage = () => {
    if (isTurningPage) return;
    setIsTurningPage(true);
    setTimeout(() => setIsTurningPage(false), 1180);
  };

  const pinNote = () => {
    if (!noteDraft.trim()) return;
    setPinnedNotes((n) => [...n, { id: Date.now(), text: noteDraft.trim(), color: noteColor }]);
    setNoteDraft("");
    setNoteOpen(false);
  };
  const perPage = 9;
  const filtered = letter
    ? clients.filter((c) => (c.full_name ?? "").trim().toUpperCase().startsWith(letter))
    : clients;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const slice = filtered.slice(page * perPage, page * perPage + perPage);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? clients[0] ?? null,
    [clients, selectedId],
  );

  return (
    <div className="crm-notebook-scope flex nb-gap-sm">
      {/* Clients list panel */}
      <div className="crm-brush-panel hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <div className="crm-brush-divider p-4">
          <div className="mb-4 flex items-center gap-2 text-amber-100">
            <Users className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wider">Клиенти</span>
          </div>
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#3c141a] py-3 text-sm font-bold text-amber-50 shadow-lg shadow-black/20 transition hover:bg-[#5a1b23]"
          >
            <Plus className="h-3.5 w-3.5" /> Нов клиент
          </button>
          <div className="crm-brush-field relative mt-5">
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Търсене на клиент..."
              className="w-full bg-transparent px-4 py-2.5 text-xs text-amber-100 placeholder:text-amber-100/40 focus:outline-none"
            />
            <Search className="absolute right-3.5 top-3 h-3.5 w-3.5 text-amber-100/40" />
          </div>

          {/* Маркери — 10 цвята */}
          <div className="mt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-100/50">
              Маркер
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MARKER_COLORS.map((color) => {
                const active = markerColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setMarkerColor(color)}
                    title={`Маркер ${color}`}
                    aria-label={`Маркер ${color}`}
                    aria-pressed={active}
                    style={{ backgroundColor: color }}
                    className={`h-5 w-5 rounded-full border transition-transform ${
                      active
                        ? "scale-115 border-white shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
                        : "border-white/25 hover:scale-110"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="max-h-[620px] flex-1 overflow-y-auto">
          {slice.map((c) => {
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  setRowMarks((m) => ({ ...m, [c.id]: markerColor }));
                }}
                onDoubleClick={() => onOpen(c)}
                data-crm-row=""
                aria-selected={active}
                className={`crm-brush-divider crm-brush-divider--soft relative flex w-full items-center gap-3 p-3 text-left transition-colors ${
                  active ? "crm-brush-rowfill text-amber-50" : "text-amber-100/90"
                }`}
              >
                {/* Анимиран маркер, който рисува върху реда */}
                <AnimatePresence>
                  {rowMarks[c.id] && (
                    <motion.span
                      key={rowMarks[c.id]}
                      aria-hidden
                      initial={{ scaleX: 0, opacity: 0.15 }}
                      animate={{ scaleX: 1, opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        transformOrigin: "left center",
                        background: `linear-gradient(90deg, ${rowMarks[c.id]} 0%, ${rowMarks[c.id]} 92%, transparent 100%)`,
                        clipPath: "polygon(0 18%, 99% 8%, 100% 84%, 96% 96%, 2% 92%, 0 76%)",
                        mixBlendMode: "screen",
                      }}
                      className="pointer-events-none absolute inset-y-1.5 left-0 right-1.5 rounded-[3px] blur-[0.3px]"
                    />
                  )}
                </AnimatePresence>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? "bg-white/20" : "bg-white/10 opacity-70"
                  }`}
                >
                  {initials(c.full_name)}
                </span>
                <span className="flex-1 overflow-hidden">
                  <span className="block truncate text-xs font-semibold">{c.full_name}</span>
                  <span className="block text-[10px] text-amber-100/50">{c.phone ?? "—"}</span>
                  {bankOf(c) && (
                    <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-50">
                      <Building2 className="h-2.5 w-2.5 flex-none" />
                      <span className="truncate">{bankOf(c)}</span>
                    </span>
                  )}
                </span>

                <span className="whitespace-nowrap text-[10px] text-amber-100/40">
                  {fmtDate(c.created_at)}
                </span>
              </button>
            );
          })}
          {!slice.length && (
            <div className="p-6 text-center text-xs text-amber-100/40">
              Няма клиенти в тази папка.
            </div>
          )}
        </div>

        <div className="crm-brush-divider crm-brush-divider--top crm-brush-divider--soft flex items-center justify-between p-3 text-[10px] text-amber-100/60">
          <div className="flex gap-2">
            {Array.from({ length: Math.min(pages, 4) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`flex h-6 w-6 items-center justify-center rounded ${
                  page === i ? "bg-[#3c141a] font-bold text-amber-50" : "hover:bg-white/5"
                }`}
              >
                {i + 1}
              </button>
            ))}
            {pages > 4 && <span className="px-1 self-center">…</span>}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="p-1 hover:text-amber-100"
            aria-label="Следваща страница"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Notebook spread */}
      <div className="nb-spread relative flex-1" style={{ perspective: 2400 }}>
        <div
          className="nb-art relative mx-auto aspect-[1152/880] w-full max-w-[1100px] rounded-3xl bg-contain bg-center bg-no-repeat shadow-[0_35px_60px_-15px_rgba(0,0,0,0.9)]"
          style={{ ["--nb-art" as string]: `url(${notebookSpread})` }}
        >
          {/* Left page — cover */}
          <div className="absolute left-[8%] top-[10%] flex h-[80%] w-[34%] flex-col items-center">
            <img src={logoWatermark} alt="" className="mt-[3cqw] mb-[3.5cqw] w-[75%] opacity-40" />
            <div className="handwriting nb-cover-title nb-mb-2 tracking-tight text-[#3c141a]/80">
              CRM - Клиенти
            </div>
            <div className="mb-[3cqw] h-px w-1/2 bg-[#3c141a]/15" />
            <div className="flex items-center gap-6 text-[#3c141a]/50">
              <div className="h-px w-12 bg-[#3c141a]/15" />
              <div className="handwriting nb-cover-year">{new Date().getFullYear()}</div>
              <div className="h-px w-12 bg-[#3c141a]/15" />
            </div>
            <div className="mt-[5cqw] opacity-30">
              <svg width="100" height="30" viewBox="0 0 100 30" fill="none">
                <path d="M10 15C30 5 70 25 90 15" stroke="#3c141a" strokeWidth="1" />
                <circle cx="50" cy="15" r="3" fill="#3c141a" />
              </svg>
            </div>
          </div>

          {/* Кръгъл бърз бутон „Банки“ — на ръба на тефтера */}
          <button
            type="button"
            onClick={() => selected && setBankClient(selected)}
            disabled={!selected}
            title={selected ? `Банки за ${selected.full_name}` : "Избери клиент"}
            aria-label="Банки"
            className="absolute left-[-2%] top-[40%] z-50 flex h-[3.6cqw] w-[3.6cqw] min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[#F6D98A]/45 bg-[#7a1226] text-[#F6D98A] shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-all hover:scale-110 hover:bg-[#8B1A2B] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Building2 className="h-[1.6cqw] w-[1.6cqw] min-h-[18px] min-w-[18px]" />
          </button>

          {/* Sticky note palette (left page, bottom) */}
          <div className="absolute bottom-[8%] left-[9%] z-40 flex -space-x-5">
            {["#f6d96a", "#f5a9ae", "#9bd6d0", "#b9b2f1"].map((color, i) => (
              <button
                key={color}
                onClick={() => {
                  setNoteColor(color);
                  setNoteOpen(true);
                }}
                style={{ backgroundColor: color, transform: `rotate(${i % 2 ? 5 : -5}deg)` }}
                className="h-[3.2cqw] w-[3.2cqw] min-h-[28px] min-w-[28px] border border-black/10 shadow-md transition-transform hover:-translate-y-2 hover:scale-110"
                title="Нова лепка"
                aria-label="Нова лепка"
              />
            ))}
          </div>

          {/* Pinned notes */}
          {pinnedNotes.map((note, i) => (
            <div
              key={note.id}
              style={{
                transform: `rotate(${i % 2 ? 3 : -3}deg)`,
                backgroundColor: note.color,
                top: `${57 + (i % 2) * 13}%`,
                left: `${11 + (i % 3) * 9}%`,
              }}
              className="pinned-note handwriting absolute z-30 w-[11cqw] min-w-[110px] p-3 nb-body text-[#3c141a]"
            >
              <span className="pin-head absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-red-700" />
              <button
                onClick={() => setPinnedNotes((n) => n.filter((x) => x.id !== note.id))}
                className="absolute right-1 top-0.5 text-[10px] text-[#3c141a]/50 hover:text-[#3c141a]"
                aria-label="Премахни лепката"
              >
                ✕
              </button>
              {note.text}
            </div>
          ))}

          {/* New note composer */}
          {noteOpen && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/25">
              <div
                className="w-80 -rotate-2 p-6 text-[#3c141a] shadow-2xl"
                style={{ backgroundColor: noteColor }}
              >
                <div className="handwriting mb-3 text-3xl">Нова задача</div>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Напиши задачата си..."
                  className="h-28 w-full resize-none border border-[#3c141a]/20 bg-white/40 p-3 text-sm outline-none"
                />
                <div className="mt-4 flex justify-end gap-2 text-xs">
                  <button onClick={() => setNoteOpen(false)} className="px-3 py-2">
                    Отказ
                  </button>
                  <button
                    onClick={pinNote}
                    className="rounded bg-[#3c141a] px-4 py-2 font-semibold text-white"
                  >
                    Забий 📌
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Index tabs (right edge) */}
          <div className="absolute right-[1.5%] top-[10%] z-40 flex max-h-[80%] flex-col gap-[0.25cqw] overflow-hidden">
            {"АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЮЯ".split("").map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLetter(letter === l ? null : l);
                  setPage(0);
                }}
                className={`handwriting w-[1.6cqw] min-w-[14px] text-center text-[1.15cqw] leading-[1.35] transition-colors ${
                  letter === l
                    ? "font-bold text-[#F6D98A]"
                    : "text-[#F6D98A]/55 hover:text-[#F6D98A]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Right page — client sheet with real page-turn animation */}
          <div
            className="absolute right-[9.5%] top-[8%] h-[84%] w-[35%]"
            style={{ transformStyle: "preserve-3d" }}
          >
            <button
              onClick={turnPage}
              disabled={isTurningPage}
              title="Разлисти страницата"
              aria-label="Разлисти страницата"
              className="absolute -top-[2%] right-0 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#3c141a] text-white shadow-lg shadow-black/30 transition-all hover:scale-105 hover:bg-[#5a1b23] active:scale-95 disabled:opacity-60"
            >
              <BookOpen className="h-4 w-4" />
            </button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected?.id ?? "empty"}
                initial={{ rotateY: 88, x: -24, opacity: 0.15, filter: "brightness(0.8)" }}
                animate={{ rotateY: 0, x: 0, opacity: 1, filter: "brightness(1)" }}
                exit={{ rotateY: -84, x: -18, opacity: 0.1, filter: "brightness(0.85)" }}
                transition={{ duration: 0.62, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                }}
                className={`h-full w-full overflow-y-auto pr-1 text-[#3c141a] ${isTurningPage ? "live-page-turn" : ""}`}
              >
                {selected ? (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2 pr-2">
                      <div className="flex min-w-0 flex-col">
                        <button
                          onClick={() => onOpen(selected)}
                          className="handwriting nb-h1 text-left font-medium tracking-tight hover:underline"
                        >
                          {selected.full_name}
                        </button>
                        {bankOf(selected) && (
                          <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border border-[#7a1226]/25 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#7a1226]">
                            <Building2 className="h-3 w-3 flex-none" /> Банка: {bankOf(selected)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBankClient(selected)}
                          title={bankOf(selected) ? `Банка: ${bankOf(selected)}` : "Избор на банка"}
                          className="flex items-center gap-1 rounded-full border border-[#7a1226]/25 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#7a1226] shadow-sm transition-colors hover:bg-[#7a1226]/10"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="max-w-[9rem] truncate">
                            {bankOf(selected) || "Банка"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setA4Client(selected)}
                          title="Широк A4 тефтер"
                          className="flex items-center gap-1 rounded-full border border-[#7a1226]/25 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#7a1226] shadow-sm transition-colors hover:bg-[#7a1226]/10"
                        >
                          <FileText className="h-3.5 w-3.5" /> A4
                        </button>
                        <Star className="nb-star text-red-700/50" />
                      </div>
                    </div>

                    <div className="nb-mb-2 h-px w-full bg-[#3c141a]/10" />

                    <div className="nb-mb-3 space-y-2">
                      <div className="flex items-center nb-gap-sm">
                        <Phone className="nb-ico opacity-40" />
                        <span className="handwriting nb-body tracking-wide opacity-80">
                          {selected.phone ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center nb-gap-sm">
                        <Mail className="nb-ico opacity-40" />
                        <span className="handwriting nb-body tracking-wide opacity-80">
                          {selected.email ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center nb-gap-sm">
                        <Calendar className="nb-ico opacity-40" />
                        <span className="handwriting nb-body tracking-wide opacity-80">
                          Първи контакт: {fmtDate(selected.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="nb-mb-3">
                      <h3 className="handwriting nb-h2 nb-mb-1 font-bold underline decoration-[#3c141a]/15 underline-offset-4 opacity-90">
                        Търси:
                      </h3>
                      <ul className="handwriting nb-body space-y-1 pl-[2cqw] opacity-80">
                        {criteria(selected).map((line, i) => (
                          <li key={i}>– {line}</li>
                        ))}
                        {!criteria(selected).length && <li>– Няма въведени критерии</li>}
                      </ul>
                    </div>

                    <div className="nb-mb-3">
                      <h3 className="handwriting nb-h2 nb-mb-2 font-bold underline decoration-[#3c141a]/15 underline-offset-4 opacity-90">
                        История на контакта:
                      </h3>
                      <div className="space-y-3">
                        <div className="flex nb-gap-sm">
                          <Phone className="nb-ico mt-[0.5cqw] opacity-40" />
                          <div className="handwriting nb-body">
                            <div className="text-blue-900/70 underline decoration-blue-900/10">
                              {fmtDateTime(selected.created_at)}
                            </div>
                            <div className="opacity-80">
                              Създаден профил · {TYPE_LABEL[selected.client_type] ?? "Клиент"}
                            </div>
                          </div>
                        </div>
                        {selected.updated_at && (
                          <div className="flex nb-gap-sm">
                            <Mail className="nb-ico mt-[0.5cqw] opacity-40" />
                            <div className="handwriting nb-body">
                              <div className="text-blue-900/70 underline decoration-blue-900/10">
                                {fmtDateTime(selected.updated_at)}
                              </div>
                              <div className="text-blue-800/80">Последна редакция по картона.</div>
                            </div>
                          </div>
                        )}
                        {selected.deposit_amount && (
                          <div className="flex nb-gap-sm">
                            <Calendar className="nb-ico mt-[0.5cqw] opacity-40" />
                            <div className="handwriting nb-body">
                              <div className="text-blue-900/70 underline decoration-blue-900/10">
                                {fmtDate(selected.deposit_date)}
                              </div>
                              <div className="relative inline-block">
                                Оставен депозит:{" "}
                                {Number(selected.deposit_amount).toLocaleString("bg-BG")}{" "}
                                {selected.deposit_currency ?? "EUR"}
                                <span className="absolute inset-0 -z-10 -rotate-1 rounded-sm bg-yellow-400/25" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="handwriting nb-h2 nb-mb-1 font-bold underline decoration-[#3c141a]/15 underline-offset-4 opacity-90">
                        Бележки:
                      </h3>
                      <p className="handwriting nb-body whitespace-pre-line opacity-80">
                        {selected.notes || "—"}
                      </p>
                    </div>

                    {(selected.interest_note || selected.notes) && (
                      <div className="nb-note pointer-events-none absolute z-30 rotate-3 drop-shadow-[0_15px_15px_rgba(0,0,0,0.2)]">
                        <img src={stickyNote} alt="" className="w-full" />
                        <div className="handwriting nb-note-text absolute inset-0 flex flex-col items-center justify-center px-[2.4cqw] pt-[2cqw] text-center text-[#3c141a]">
                          <span className="line-clamp-5">
                            {selected.interest_note || selected.notes}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Забодено листче с документите по кредита */}
                    {bankOf(selected) && (
                      <button
                        type="button"
                        onClick={() => setDocsClient(selected)}
                        title="Документи по кредита"
                        className="absolute bottom-[4%] left-[4%] z-30 w-[26%] -rotate-6 drop-shadow-[0_14px_14px_rgba(0,0,0,0.22)] transition-transform hover:-rotate-3 hover:scale-105"
                      >
                        <img src={stickyNote} alt="" className="w-full" />
                        <span className="handwriting absolute inset-0 flex flex-col items-center justify-center px-[1.6cqw] text-center text-[#3c141a]">
                          <span className="text-[1.5cqw] font-bold leading-tight">Документи</span>
                          <span className="text-[1.2cqw] leading-tight opacity-80">
                            {bankOf(selected)}
                          </span>
                          <span className="text-[1.1cqw] leading-tight opacity-70">
                            {(() => {
                              const md = selected.mortgage_data ?? {};
                              const live = getLiveRate(
                                bankOf(selected),
                                (md.income_origin ?? "bg") as IncomeOrigin,
                                new Date(md.rate_date || Date.now()),
                              );

                              const shown = md.rate_manual && md.rate ? Number(md.rate) : live.rate;
                              return `${Number(shown).toFixed(2)}% ${
                                (md.income_origin ?? "bg") === "foreign" ? "чужбина" : "България"
                              }`;
                            })()}
                          </span>
                          <span className="text-[1.05cqw] leading-tight opacity-60">6 позиции</span>
                        </span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="handwriting nb-h2 flex h-full items-center justify-center text-[#3c141a]/50">
                    Изберете клиент
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {docsClient && <MortgageDocsModal client={docsClient} onClose={() => setDocsClient(null)} />}
      {a4Client && <ClientA4Sheet client={a4Client} onClose={() => setA4Client(null)} />}

      {bankClient && (
        <BankFlowModal
          client={{
            ...bankClient,
            mortgage_data: {
              ...(bankClient.mortgage_data ?? {}),
              ...(bankByClient[bankClient.id] ? { bank: bankByClient[bankClient.id] } : {}),
            },
          }}
          onClose={() => setBankClient(null)}
          onPicked={(bank) => {
            setBankByClient((m) => ({ ...m, [bankClient.id]: bank }));
          }}
          onAddTask={(text) =>
            setPinnedNotes((n) => [...n, { id: Date.now(), text, color: noteColor }])
          }
        />
      )}
    </div>
  );
}
