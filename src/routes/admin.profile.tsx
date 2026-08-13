import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, User as UserIcon, Save, Palette, Check } from "lucide-react";
import { toast } from "sonner";
import { useCrmTheme, CRM_THEME_PRESETS, type CrmTheme } from "@/hooks/use-crm-theme";

export const Route = createFileRoute("/admin/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
        setLoading(false);
      });
  }, [user]);

  const onUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${safeExt}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (updErr) throw updErr;
      setAvatarUrl(publicUrl);
      toast.success("Снимката е качена");
    } catch (e: any) {
      console.error("Avatar upload error:", e);
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        phone,
        avatar_url: avatarUrl,
      });
      if (error) throw error;
      toast.success("Профилът е запазен");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-amber-100/70">Зарежда…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-4xl text-amber-100">Моят профил</h1>
        <p className="mt-1 text-sm text-amber-100/60">Управление на админ профила и аватар</p>
      </header>

      <div className="space-y-6 rounded-2xl border border-amber-500/20 bg-[rgba(255,255,255,0.85)] p-6 shadow-[0_18px_45px_rgba(139,26,43,0.35)]">
        <div className="flex items-center gap-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-amber-400/40 bg-amber-500/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-amber-200/60">
                <UserIcon className="h-12 w-12" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#8B1A2B]/55">
                <Loader2 className="h-6 w-6 animate-spin text-amber-200" />
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20">
              <Upload className="h-4 w-4" />
              {avatarUrl ? "Смени снимка" : "Качи снимка"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
            </label>
            <p className="mt-2 text-[11px] text-amber-100/50">JPG / PNG, до 5MB</p>
          </div>
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-100/70">Имейл</span>
            <input
              value={user?.email ?? ""}
              disabled
              className="w-full rounded-lg border border-amber-500/20 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100/60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-100/70">Име и фамилия</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-100/70">Телефон</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0899 620 262"
              className="w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gold-cta-button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Запази промените
          </Button>
        </div>
      </div>

      <ThemeSection />
    </div>
  );
}

function ThemeSection() {
  const { theme, setTheme, loaded } = useCrmTheme();
  const [local, setLocal] = useState<CrmTheme>(theme);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded) setLocal(theme);
  }, [loaded, theme]);

  const applyPreset = (key: string) => {
    const p = CRM_THEME_PRESETS[key];
    if (p) setLocal({ ...p });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setTheme(local);
      toast.success("Темата е запазена");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setSaving(false);
    }
  };

  const Color = ({ label, k }: { label: string; k: keyof CrmTheme }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-100/70">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={typeof local[k] === "string" && (local[k] as string).startsWith("#") ? (local[k] as string) : "#000000"}
          onChange={(e) => setLocal({ ...local, [k]: e.target.value })}
          className="h-10 w-14 cursor-pointer rounded border border-amber-500/30 bg-transparent"
        />
        <input
          type="text"
          value={String(local[k] ?? "")}
          onChange={(e) => setLocal({ ...local, [k]: e.target.value })}
          className="w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
        />
      </div>
    </label>
  );

  return (
    <div className="space-y-6 rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-6 shadow-[0_18px_45px_rgba(139,26,43,0.35)]">
      <header className="flex items-center gap-3">
        <Palette className="h-5 w-5 text-amber-300" />
        <div>
          <h2 className="font-display text-2xl text-amber-100">Моята тема</h2>
          <p className="text-xs text-amber-100/60">Всеки потребител има собствена тема и цветове за CRM панела</p>
        </div>
      </header>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100/70">Готови теми</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(CRM_THEME_PRESETS).map(([key, p]) => {
            const active = local.preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="group relative overflow-hidden rounded-xl border border-amber-500/25 p-3 text-left transition hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${p.surface} 0%, ${p.surfaceTo} 100%)`,
                  color: p.text,
                  borderColor: active ? p.accent : undefined,
                  boxShadow: active ? `0 0 0 2px ${p.accent}` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize">{key}</span>
                  {active && <Check className="h-4 w-4" style={{ color: p.accent }} />}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <span className="h-4 w-4 rounded-full" style={{ background: p.accent }} />
                  <span className="h-4 w-4 rounded-full" style={{ background: p.text }} />
                  <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: p.surface }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Color label="Фон (основен)" k="surface" />
        <Color label="Фон (преливане)" k="surfaceTo" />
        <Color label="Акцент" k="accent" />
        <Color label="Текст" k="text" />
      </div>

      <div
        className="rounded-xl border p-4"
        style={{
          background: `linear-gradient(180deg, ${local.surface}, ${local.surfaceTo})`,
          color: local.text,
          borderColor: local.border,
        }}
      >
        <div className="text-xs uppercase tracking-wide" style={{ color: local.textMuted }}>Преглед</div>
        <div className="mt-1 text-lg font-semibold">Имоти Надежда · CRM</div>
        <button
          type="button"
          className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: local.accent, color: local.surface }}
        >
          Акцентен бутон
        </button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="gold-cta-button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Запази темата
        </Button>
      </div>
    </div>
  );
}
