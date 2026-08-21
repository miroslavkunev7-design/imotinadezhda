import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Share2,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  disconnectPortal,
  listDistributeDesk,
  savePortalLogin,
  scatterListing,
  startFacebookConnect,
} from "@/lib/distribute.functions";

export const Route = createFileRoute("/admin/distribute")({
  validateSearch: (s: Record<string, unknown>) => ({
    property: typeof s.property === "string" ? s.property : undefined,
    facebook: typeof s.facebook === "string" ? s.facebook : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: DistributePage,
});

type Desk = Awaited<ReturnType<typeof listDistributeDesk>>;
type Portal = Desk["portals"][number];

function DistributePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState(search.property ?? "");
  const [channels, setChannels] = useState<string[]>(["facebook"]);
  const [formKey, setFormKey] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [username, setUsername] = useState("");

  const load = async () => {
    try {
      const d = await listDistributeDesk();
      setDesk(d);
    } catch (e: any) {
      toast.error(e?.message ?? "Не мога да заредя разпръскването");
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
    if (search.facebook === "ok") {
      toast.success("Facebook страницата е свързана.");
      navigate({ to: "/admin/distribute", search: { property: search.property }, replace: true });
      void load();
    } else if (search.facebook === "error") {
      toast.error(search.reason || "Facebook свързването се провали");
      navigate({ to: "/admin/distribute", search: { property: search.property }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.facebook]);

  const property = useMemo(
    () => (desk?.properties ?? []).find((p: any) => p.id === propertyId) ?? null,
    [desk, propertyId],
  );

  const toggleChannel = (key: string) => {
    setChannels((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const connectFacebook = async () => {
    setBusy("facebook");
    try {
      const { url } = await startFacebookConnect({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Не стана свързването");
      setBusy(null);
    }
  };

  const saveLogin = async (key: string) => {
    setBusy(key);
    try {
      await savePortalLogin({
        data: {
          platform_key: key,
          email,
          password,
          username,
          profile_url: profileUrl,
        },
      });
      toast.success("Профилът е записан.");
      setFormKey(null);
      setEmail("");
      setPassword("");
      setProfileUrl("");
      setUsername("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не се записа");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (key: string) => {
    if (!confirm("Прекратяване на връзката с този профил?")) return;
    setBusy(key);
    try {
      await disconnectPortal({ data: { platform_key: key } });
      toast.success("Прекратено.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не стана");
    } finally {
      setBusy(null);
    }
  };

  const scatter = async () => {
    if (!propertyId) {
      toast.error("Избери обява");
      return;
    }
    if (!channels.length) {
      toast.error("Избери поне един канал");
      return;
    }
    setBusy("scatter");
    try {
      const res = await scatterListing({ data: { property_id: propertyId, channels } });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.filter((r) => !r.ok);
      if (ok) toast.success(`Разпръснато към ${ok} канала.`);
      for (const f of fail) toast.error(`${f.channel}: ${f.error}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Разпръскването се провали");
    } finally {
      setBusy(null);
    }
  };

  const shareManual = () => {
    if (!property) {
      toast.error("Избери обява");
      return;
    }
    const url = `https://imotinadezhda.bg/properties/${property.id}`;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=640,height=720",
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-amber-100/70">
        <Loader2 className="h-5 w-5 animate-spin" /> Зареждане…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl text-amber-100">
          <Share2 className="h-6 w-6" /> Разпръскване на обяви
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-amber-100/60">
          Свържете Facebook страницата и профилите в порталите, после пуснете обява към избраните канали.
          Facebook и Instagram публикуват веднага през официалното API. Другите портали влизат в опашката на worker-а.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200/80">Свързани профили</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(desk?.portals ?? []).map((p) => (
            <PortalCard
              key={p.key}
              portal={p}
              busy={busy === p.key}
              facebookOAuthReady={Boolean(desk?.facebookOAuthReady)}
              formOpen={formKey === p.key}
              email={email}
              password={password}
              profileUrl={profileUrl}
              username={username}
              onEmail={setEmail}
              onPassword={setPassword}
              onProfileUrl={setProfileUrl}
              onUsername={setUsername}
              onOpenForm={() => {
                setFormKey(p.key);
                setEmail("");
                setPassword("");
                setProfileUrl(p.profileUrl ?? "");
                setUsername(p.displayName ?? "");
              }}
              onCloseForm={() => setFormKey(null)}
              onSave={() => saveLogin(p.key)}
              onDisconnect={() => disconnect(p.key)}
              onFacebook={connectFacebook}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/15 bg-black/25 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200/80">Пусни обява</h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="block">
            <div className="mb-1 text-xs text-amber-100/50">Обява</div>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-xl border border-amber-200/20 bg-black/40 px-3 py-2.5 text-sm text-amber-50"
            >
              <option value="">— избери имот —</option>
              {(desk?.properties ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.cities?.name ? ` · ${p.cities.name}` : ""}
                  {p.price != null ? ` · ${p.price} ${p.currency ?? ""}` : ""}
                </option>
              ))}
            </select>
          </label>
          {property?.cover_image_url ? (
            <img
              src={property.cover_image_url}
              alt=""
              className="h-[72px] w-full rounded-xl object-cover opacity-90"
            />
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(desk?.portals ?? []).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleChannel(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                channels.includes(p.key)
                  ? "border-amber-300 bg-amber-300 text-[#2a0a12]"
                  : "border-amber-200/25 bg-transparent text-amber-100/70"
              }`}
            >
              {p.label}
              {p.connected ? "" : " · не е свързан"}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={scatter} disabled={busy === "scatter"} className="bg-amber-400 text-[#2a0a12] hover:bg-amber-300">
            {busy === "scatter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Разпръсни
          </Button>
          <Button variant="outline" onClick={shareManual} className="border-amber-200/30 text-amber-100">
            <ExternalLink className="h-4 w-4" /> Сподели ръчно във Facebook
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200/80">Опашка</h2>
        <div className="overflow-hidden rounded-2xl border border-amber-200/15">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30 text-amber-100/50">
              <tr>
                <th className="px-3 py-2 font-medium">Канал</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Линк / грешка</th>
                <th className="px-3 py-2 font-medium">Кога</th>
              </tr>
            </thead>
            <tbody>
              {(desk?.queue ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-amber-100/40">
                    Още няма пускания.
                  </td>
                </tr>
              ) : (
                (desk?.queue ?? []).map((q: any) => (
                  <tr key={q.id} className="border-t border-amber-200/10">
                    <td className="px-3 py-2 text-amber-50">{q.site}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={q.status} />
                    </td>
                    <td className="max-w-[360px] truncate px-3 py-2 text-amber-100/70">
                      {q.external_url ? (
                        <a href={q.external_url} target="_blank" rel="noreferrer" className="underline">
                          {q.external_url}
                        </a>
                      ) : (
                        q.error || "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-amber-100/40">
                      {new Date(q.updated_at || q.created_at).toLocaleString("bg-BG")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-500/20 text-emerald-200"
      : status === "failed"
        ? "bg-red-500/20 text-red-200"
        : status === "processing"
          ? "bg-sky-500/20 text-sky-200"
          : "bg-amber-500/20 text-amber-100";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{status}</span>;
}

function PortalCard({
  portal,
  busy,
  facebookOAuthReady,
  formOpen,
  email,
  password,
  profileUrl,
  username,
  onEmail,
  onPassword,
  onProfileUrl,
  onUsername,
  onOpenForm,
  onCloseForm,
  onSave,
  onDisconnect,
  onFacebook,
}: {
  portal: Portal;
  busy: boolean;
  facebookOAuthReady: boolean;
  formOpen: boolean;
  email: string;
  password: string;
  profileUrl: string;
  username: string;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onProfileUrl: (v: string) => void;
  onUsername: (v: string) => void;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSave: () => void;
  onDisconnect: () => void;
  onFacebook: () => void;
}) {
  const oauth = portal.key === "facebook" || portal.key === "instagram";
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-amber-50">{portal.label}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {portal.connected ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-200/90">{portal.displayName || portal.emailMasked || "Свързан"}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-400/70" />
                <span className="text-amber-100/50">Не е свързан</span>
              </>
            )}
          </div>
        </div>
        {portal.connected ? (
          <button type="button" onClick={onDisconnect} disabled={busy} className="text-amber-100/40 hover:text-red-300">
            <Unlink className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="mt-3 space-y-2">
          <input
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            placeholder="Име / потребител"
            className="w-full rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50"
          />
          <input
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="Имейл за вход"
            className="w-full rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="Парола"
            className="w-full rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50"
          />
          <input
            value={profileUrl}
            onChange={(e) => onProfileUrl(e.target.value)}
            placeholder="Линк към профила (по желание)"
            className="w-full rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Запиши
            </Button>
            <Button size="sm" variant="ghost" onClick={onCloseForm}>
              Отказ
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {portal.key === "facebook" ? (
            <>
              <Button size="sm" onClick={onFacebook} disabled={busy} className="bg-[#1877F2] text-white hover:bg-[#166fe5]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Свържи Facebook страница
              </Button>
              {!facebookOAuthReady ? (
                <p className="w-full text-[11px] leading-snug text-amber-100/45">
                  За автоматично публикуване е нужно Meta приложение (META_APP_ID и META_APP_SECRET в .env) и Redirect URI
                  {" "}
                  <span className="text-amber-100/70">http://localhost:8080/api/public/hooks/facebook-oauth</span>
                </p>
              ) : null}
            </>
          ) : null}
          {portal.key === "instagram" ? (
            <p className="text-[11px] leading-snug text-amber-100/45">
              Instagram се връзва автоматично, ако Facebook страницата има бизнес профил.
            </p>
          ) : null}
          {portal.kind === "login" || portal.key === "facebook" ? (
            <Button size="sm" variant="outline" onClick={onOpenForm} className="border-amber-200/25 text-amber-100">
              {portal.connected ? "Обнови вход" : "Запиши профил"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
