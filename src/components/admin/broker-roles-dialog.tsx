import { useEffect, useState } from "react";
import { X, Shield, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBrokerRoles, setBrokerRoles, type BrokerRole } from "@/lib/crm.functions";

type Props = {
  brokerName: string;
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
};

const ROLE_OPTIONS: { value: BrokerRole; label: string; description: string; tone: string }[] = [
  { value: "admin", label: "Администратор", description: "Пълен достъп до всичко", tone: "from-rose-700 to-rose-900" },
  { value: "boss", label: "Шеф", description: "Управленски достъп", tone: "from-amber-600 to-amber-800" },
  { value: "head_broker", label: "Началник брокер", description: "Ръководи екип от брокери", tone: "from-purple-600 to-purple-800" },
  { value: "broker", label: "Брокер", description: "Стандартен брокер", tone: "from-emerald-600 to-emerald-800" },
  { value: "consultant", label: "Консултант", description: "Консултантски услуги", tone: "from-sky-600 to-sky-800" },
  { value: "rental_dept", label: "Отдел Наем", description: "Само наеми", tone: "from-teal-600 to-teal-800" },
  { value: "agent", label: "Агент", description: "Помощник-брокер", tone: "from-slate-600 to-slate-800" },
];

export function BrokerRolesDialog({ brokerName, userId, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<BrokerRole>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const roles = await getBrokerRoles({ data: { user_id: userId } });
        setSelected(new Set(roles));
      } catch (e: any) {
        setError(e.message ?? "Грешка при зареждане");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const toggle = (r: BrokerRole) => {
    const next = new Set(selected);
    next.has(r) ? next.delete(r) : next.add(r);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setBrokerRoles({ data: { user_id: userId, roles: Array.from(selected) } });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Грешка при запис");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-3xl border-2 border-[#C9A84C]/40 bg-gradient-to-br from-[#8B1A2B] to-[#5e0f1d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-amber-100/70 hover:bg-white/10 hover:text-amber-100"
          aria-label="Затвори"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-[#C9A84C]/20 p-2.5 ring-1 ring-[#C9A84C]/40">
            <Shield className="h-6 w-6 text-[#C9A84C]" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-amber-100">Роли и права</h2>
            <p className="text-sm text-amber-100/70">{brokerName}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-amber-100/70">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {ROLE_OPTIONS.map((opt) => {
              const active = selected.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                    active
                      ? "border-[#C9A84C] bg-gradient-to-r " + opt.tone + " shadow-lg"
                      : "border-white/10 bg-black/20 hover:border-[#C9A84C]/50 hover:bg-black/30"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                      active ? "border-[#C9A84C] bg-[#C9A84C]" : "border-white/40 bg-transparent"
                    }`}
                  >
                    {active && <Check className="h-4 w-4 text-[#5e0f1d]" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${active ? "text-white" : "text-amber-100"}`}>{opt.label}</div>
                    <div className={`text-xs ${active ? "text-white/80" : "text-amber-100/60"}`}>{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/40">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-amber-100/80 hover:bg-white/10 hover:text-amber-100"
          >
            Отказ
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="gold-cta-button"
          >
            {saving ? "Запис..." : "Запази"}
          </Button>
        </div>
      </div>
    </div>
  );
}
