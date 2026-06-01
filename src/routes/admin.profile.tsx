import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, User as UserIcon, Save } from "lucide-react";
import { toast } from "sonner";

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
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await supabase.from("profiles").upsert({ id: user.id, avatar_url: data.publicUrl });
      toast.success("Снимката е качена");
    } catch (e: any) {
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

      <div className="space-y-6 rounded-2xl border border-amber-500/20 bg-[rgba(15,3,6,0.85)] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-amber-400/40 bg-amber-500/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-amber-200/60">
                <UserIcon className="h-12 w-12" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
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
    </div>
  );
}
