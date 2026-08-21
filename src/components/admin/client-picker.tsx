import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatClientLabel } from "@/lib/task-kinds";

export type ClientOption = { id: string; full_name: string; phone?: string | null };

type Tone = "light" | "dark" | "schedule";

const TONE: Record<Tone, { btn: string; menu: string; input: string; item: string; itemActive: string; muted: string }> = {
  light: {
    btn: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
    menu: "overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
    input: "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
    item: "w-full px-3 py-2 text-left text-sm hover:bg-accent",
    itemActive: "bg-accent font-semibold",
    muted: "text-muted-foreground",
  },
  dark: {
    btn: "w-full rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100",
    menu: "overflow-hidden rounded-md border border-amber-500/30 bg-[#1a0608] text-amber-100 shadow-lg",
    input: "w-full bg-transparent text-sm text-amber-100 outline-none placeholder:text-amber-100/40",
    item: "w-full px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-500/15",
    itemActive: "bg-amber-500/25 font-semibold",
    muted: "text-amber-100/55",
  },
  schedule: {
    btn: "mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-semibold text-black",
    menu: "overflow-hidden rounded-md border border-[#8B1A2B]/30 bg-white text-black shadow-lg",
    input: "w-full bg-transparent text-sm font-medium text-black outline-none placeholder:text-black/40",
    item: "w-full px-3 py-2 text-left text-sm font-medium text-black hover:bg-[#C9A84C]/25",
    itemActive: "bg-[#C9A84C]/40 font-semibold",
    muted: "text-black/50",
  },
};

export function ClientPicker({
  value,
  onChange,
  clients: clientsProp,
  required = false,
  disabled = false,
  locked = false,
  tone = "light",
  placeholder = "Избери клиент…",
}: {
  value: string | null | undefined;
  onChange: (id: string | null, client: ClientOption | null) => void;
  clients?: ClientOption[];
  required?: boolean;
  disabled?: boolean;
  locked?: boolean;
  tone?: Tone;
  placeholder?: string;
}) {
  const t = TONE[tone];
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState<ClientOption[]>([]);
  const [remembered, setRemembered] = useState<ClientOption | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (clientsProp) return;
    let cancelled = false;
    supabase
      .from("clients")
      .select("id,full_name,phone")
      .order("full_name")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setLoaded((data as ClientOption[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [clientsProp]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const clients = clientsProp ?? loaded;
  const selected = clients.find((c) => c.id === value) ?? (remembered?.id === value ? remembered : null);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return clients.slice(0, 80);
    return clients
      .filter((c) => {
        const hay = `${c.full_name} ${c.phone ?? ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 80);
  }, [clients, needle]);

  const openMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  };

  if (locked) {
    return (
      <div className={`${t.btn} cursor-default opacity-95`}>
        {selected ? formatClientLabel(selected) : placeholder}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`${t.btn} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className={selected ? "min-w-0 truncate" : t.muted}>
          {selected ? formatClientLabel(selected) : required ? `${placeholder} *` : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && !required ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setRemembered(null);
                onChange(null, null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setRemembered(null);
                  onChange(null, null);
                }
              }}
              className={t.muted}
              aria-label="Изчисти"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
        </span>
      </button>
      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className={t.menu}
              style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 400 }}
            >
              <div className="flex items-center gap-2 border-b border-current/15 px-3 py-2">
                <Search className="h-3.5 w-3.5 opacity-50" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Търси по име или телефон…"
                  className={t.input}
                />
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className={`px-3 py-4 text-center text-xs ${t.muted}`}>Няма съвпадение в клиентите.</div>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setRemembered(c);
                        onChange(c.id, c);
                        setOpen(false);
                        setQ("");
                      }}
                      className={`${t.item} ${c.id === value ? t.itemActive : ""}`}
                    >
                      <div className="truncate">{c.full_name}</div>
                      {c.phone ? <div className={`text-[11px] ${t.muted}`}>{c.phone}</div> : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
