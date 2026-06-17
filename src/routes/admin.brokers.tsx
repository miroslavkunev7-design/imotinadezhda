import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, X, Upload, UserCog, Phone, Mail, Shield, CheckSquare, Square, ListChecks, UserPlus, MessageSquare, PhoneCall, CalendarClock, ClipboardList } from "lucide-react";
import {
  listBrokers, upsertBroker, deleteBroker, createBrokerAccount, resetBrokerPassword,
  getBrokerDetails, upsertBrokerTask, toggleBrokerTask, deleteBrokerTask,
  assignClientToBroker, unassignClientFromBroker, listUnassignedClients,
} from "@/lib/crm.functions";
import { BrokerRolesDialog } from "@/components/admin/broker-roles-dialog";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/admin/brokers")({
  component: BrokersAdmin,
});

function BrokersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [detailFor, setDetailFor] = useState<any | null>(null);
  const [rolesFor, setRolesFor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(await listBrokers()); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const { created_at, updated_at, properties_count, clients_count, _password, _confirmPassword, _createAccount, ...payload } = editing;
      if (!editing.id && _createAccount) {
        if (!payload.email) throw new Error("Имейлът е задължителен за акаунт");
        if (!_password) throw new Error("Моля, въведи парола");
        if (_password.length < 8) throw new Error("Паролата трябва да е поне 8 символа");
        if (!/[a-z]/.test(_password)) throw new Error("Паролата трябва да съдържа поне една малка буква");
        if (!/[A-Z]/.test(_password)) throw new Error("Паролата трябва да съдържа поне една главна буква");
        if (!/[0-9]/.test(_password)) throw new Error("Паролата трябва да съдържа поне една цифра");
        if (_password !== _confirmPassword) throw new Error("Паролите не съвпадат");
        await createBrokerAccount({ data: {
          email: payload.email,
          password: _password,
          full_name: payload.full_name,
          phone: payload.phone || null,
          photo_url: payload.photo_url || null,
          license_number: payload.license_number || null,
          bio: payload.bio || null,
          is_active: payload.is_active ?? true,
        }});
      } else {
        await upsertBroker({ data: payload });
      }
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на брокера?")) return;
    try { await deleteBroker({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const newBroker = () => setEditing({ full_name: "", phone: "", email: "", is_active: true, _createAccount: true, _password: "", _confirmPassword: "" });

  const onUploadPhoto = async (file: File | null) => {
    if (!file || !editing) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("broker-photos").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("broker-photos").getPublicUrl(path);
    setEditing({ ...editing, photo_url: pub.publicUrl });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Брокери</h1>
          <p className="mt-1 text-sm text-amber-100/60">{rows.length} брокера · цъкни картата за задачи и клиенти</p>
        </div>
        <Button onClick={newBroker} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов брокер</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((b) => (
          <div key={b.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255, 255, 255,0.85)] p-5 text-amber-100 transition hover:border-amber-400/60 hover:shadow-[0_0_30px_-10px_rgba(212,175,55,0.45)] cursor-pointer" onClick={() => setDetailFor(b)}>
            <div className="flex items-center gap-4">
              {b.photo_url ? (
                <img src={b.photo_url} alt={b.full_name} className="h-16 w-16 rounded-full object-cover border border-amber-500/30" loading="lazy" decoding="async" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-300"><UserCog className="h-7 w-7" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl truncate">{b.full_name}</div>
                {b.license_number && <div className="text-xs text-amber-100/60">Лиценз: {b.license_number}</div>}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase ${b.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{b.is_active ? "Активен" : "Неактивен"}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {b.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{b.phone}</div>}
              {b.email && <div className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5" />{b.email}</div>}
            </div>
            {b.bio && <p className="mt-3 line-clamp-3 text-xs text-amber-100/70">{b.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setDetailFor(b)} className="flex-1 min-w-[120px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"><ListChecks className="inline h-3.5 w-3.5 mr-1" />Задачи и клиенти</button>
              <button
                onClick={() => b.user_id ? setRolesFor(b) : toast.error("Брокерът няма свързан акаунт. Свържи го с user_id първо.")}
                title="Управление на роли"
                className={`rounded-lg border px-3 py-1.5 text-xs ${b.user_id ? "border-[#C9A84C]/60 bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20" : "border-white/10 text-white/30 cursor-not-allowed"}`}
              >
                <Shield className="inline h-3.5 w-3.5 mr-1" />Роли
              </button>
              <button onClick={() => setEditing(b)} className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs hover:bg-amber-500/10"><Pencil className="inline h-3.5 w-3.5" /></button>
              <button onClick={() => remove(b.id)} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="inline h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-amber-500/30 p-10 text-center text-amber-100/50">Няма брокери.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов брокер"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center gap-4">
              {editing.photo_url ? <img src={editing.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" loading="lazy" decoding="async" /> : <div className="h-20 w-20 rounded-full bg-muted" />}
              <label className="cursor-pointer rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted">
                <Upload className="inline h-4 w-4 mr-1" /> Качи снимка
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Име *</span><input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Лиценз №</span><input value={editing.license_number ?? ""} onChange={(e) => setEditing({ ...editing, license_number: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Телефон</span><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Имейл</span><input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={iC} /></label>
              {editing.id ? (
                <div className="md:col-span-2 space-y-3">
                  <label className="block"><span className="text-xs uppercase text-muted-foreground">User ID (за достъп)</span><input value={editing.user_id ?? ""} onChange={(e) => setEditing({ ...editing, user_id: e.target.value || null })} placeholder="UUID на регистриран потребител" className={iC} /></label>
                  {editing.user_id && (
                    <PasswordResetPanel brokerId={editing.id} brokerName={editing.full_name} />
                  )}
                </div>
              ) : (
                <div className="md:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={!!editing._createAccount} onChange={(e) => setEditing({ ...editing, _createAccount: e.target.checked })} />
                    Създай акаунт за брокера (имейл + парола)
                  </label>
                  {editing._createAccount && (
                    <>
                      <label className="block"><span className="text-xs uppercase text-muted-foreground">Парола *</span>
                        <input type="password" required value={editing._password ?? ""} onChange={(e) => setEditing({ ...editing, _password: e.target.value })} placeholder="Минимум 8 символа, главна, малка, цифра" className={iC} autoComplete="new-password" />
                      </label>
                      <label className="block"><span className="text-xs uppercase text-muted-foreground">Потвърди паролата *</span>
                        <input type="password" required value={editing._confirmPassword ?? ""} onChange={(e) => setEditing({ ...editing, _confirmPassword: e.target.value })} placeholder="Въведи паролата отново" className={iC} autoComplete="new-password" />
                      </label>
                      <p className="text-[11px] text-muted-foreground">Брокерът ще може да влезе с този имейл и парола. Сподели ги сигурно с него.</p>
                    </>
                  )}
                </div>
              )}
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Био</span><textarea rows={3} value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} className={iC} /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Активен</label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
            </div>
          </form>
        </div>
      )}

      {detailFor && <BrokerDetailModal broker={detailFor} onClose={() => setDetailFor(null)} />}
      {rolesFor && (
        <BrokerRolesDialog
          brokerName={rolesFor.full_name}
          userId={rolesFor.user_id}
          onClose={() => setRolesFor(null)}
        />
      )}
    </div>
  );
}

const iC = "w-full rounded border border-input bg-background px-3 py-2";

const TYPE_META: Record<string, { label: string; Icon: typeof MessageSquare; online: boolean }> = {
  general: { label: "Обикновена", Icon: ClipboardList, online: false },
  message_client: { label: "Изпрати съобщение", Icon: MessageSquare, online: true },
  call_client: { label: "Обади се", Icon: PhoneCall, online: true },
  meeting: { label: "Среща", Icon: CalendarClock, online: false },
};

function BrokerDetailModal({ broker, onClose }: { broker: any; onClose: () => void }) {
  const [data, setData] = useState<{ broker: any; clients: any[]; tasks: any[] } | null>(null);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [taskDraft, setTaskDraft] = useState<any | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await getBrokerDetails({ data: { broker_id: broker.id } });
      setData(d);
    } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [broker.id]);

  const openAssign = async () => {
    try { setUnassigned(await listUnassignedClients()); setShowAssign(true); } catch (e: any) { toast.error(e.message); }
  };

  const doAssign = async (clientId: string) => {
    setBusy(true);
    try { await assignClientToBroker({ data: { broker_id: broker.id, client_id: clientId } }); await load(); setShowAssign(false); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doUnassign = async (clientId: string) => {
    if (!confirm("Премахни клиента от брокера?")) return;
    try { await unassignClientFromBroker({ data: { client_id: clientId } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const newTask = () => setTaskDraft({ broker_id: broker.id, title: "", task_type: "general", client_id: null });

  const saveTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskDraft || !taskDraft.title) return;
    setBusy(true);
    try { await upsertBrokerTask({ data: taskDraft }); setTaskDraft(null); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const toggle = async (t: any) => {
    try { await toggleBrokerTask({ data: { id: t.id, is_completed: !t.is_completed } }); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const removeTask = async (id: string) => {
    if (!confirm("Изтриване на задачата?")) return;
    try { await deleteBrokerTask({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/65 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-amber-500/30 bg-[rgba(255, 255, 255,0.95)] p-6 text-amber-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {broker.photo_url
              ? <img src={broker.photo_url} alt="" className="h-20 w-20 rounded-full object-cover border border-amber-500/40" loading="lazy" decoding="async" />
              : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-amber-300"><UserCog className="h-9 w-9" /></div>}
            <div>
              <h2 className="font-display text-3xl">{broker.full_name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-amber-100/70">
                {broker.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{broker.phone}</span>}
                {broker.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{broker.email}</span>}
                <span>{data?.clients.length ?? 0} клиента · {data?.tasks.filter((t) => !t.is_completed).length ?? 0} открити задачи</span>
              </div>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Tasks */}
          <section className="rounded-xl border border-amber-500/20 bg-[rgba(20,5,9,0.85)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl flex items-center gap-2"><ListChecks className="h-5 w-5 text-amber-300" /> Задачи</h3>
              <Button onClick={newTask} size="sm" className="gold-cta-button"><Plus className="h-4 w-4" /> Добави задача</Button>
            </div>
            <div className="space-y-2">
              {(data?.tasks ?? []).map((t) => {
                const meta = TYPE_META[t.task_type] ?? TYPE_META.general;
                const Icon = meta.Icon;
                return (
                  <div key={t.id} className={`rounded-lg border p-3 ${t.is_completed ? "border-emerald-500/30 bg-emerald-500/5 opacity-70" : "border-amber-500/20 bg-amber-500/5"}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggle(t)} className="mt-0.5 text-amber-300">
                        {t.is_completed ? <CheckSquare className="h-5 w-5 text-emerald-400" /> : <Square className="h-5 w-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${t.is_completed ? "line-through" : ""}`}>{t.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-amber-100/60">
                          <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5"><Icon className="h-3 w-3" />{meta.label}</span>
                          {t.clients?.full_name && <span>· клиент: <strong>{t.clients.full_name}</strong></span>}
                          {t.due_at && <span>· до {new Date(t.due_at).toLocaleString("bg-BG")}</span>}
                        </div>
                        {t.description && <p className="mt-1 text-xs text-amber-100/70">{t.description}</p>}
                        {t.auto_action_log?.note && (
                          <div className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">✓ {t.auto_action_log.note}</div>
                        )}
                      </div>
                      <button onClick={() => removeTask(t.id)} className="text-rose-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}
              {!data?.tasks.length && <div className="rounded-lg border border-dashed border-amber-500/20 py-6 text-center text-xs text-amber-100/50">Няма задачи.</div>}
            </div>
          </section>

          {/* Clients */}
          <section className="rounded-xl border border-amber-500/20 bg-[rgba(20,5,9,0.85)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl flex items-center gap-2"><UserCog className="h-5 w-5 text-amber-300" /> Клиенти</h3>
              <Button onClick={openAssign} size="sm" className="gold-cta-button"><UserPlus className="h-4 w-4" /> Добави клиент</Button>
            </div>
            <div className="space-y-2">
              {(data?.clients ?? []).map((c) => (
                <div key={c.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.full_name}</div>
                      <div className="text-[11px] text-amber-100/60">
                        {labelType(c.client_type)} · {c.status} {c.cities?.name && `· ${c.cities.name}`}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-amber-100/70">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </div>
                    <button onClick={() => doUnassign(c.id)} className="text-rose-400" title="Премахни"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {!data?.clients.length && <div className="rounded-lg border border-dashed border-amber-500/20 py-6 text-center text-xs text-amber-100/50">Няма закачени клиенти.</div>}
            </div>
          </section>
        </div>

        {/* Task draft modal */}
        {taskDraft && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#8B1A2B]/65 p-4" onClick={() => setTaskDraft(null)}>
            <form onSubmit={saveTask} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-card p-6 text-foreground shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Нова задача</h3>
                <button type="button" onClick={() => setTaskDraft(null)}><X className="h-5 w-5" /></button>
              </div>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Заглавие *</span>
                <input required value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} className={iC} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="text-xs uppercase text-muted-foreground">Тип</span>
                  <select value={taskDraft.task_type} onChange={(e) => setTaskDraft({ ...taskDraft, task_type: e.target.value })} className={iC}>
                    <option value="general">Обикновена</option>
                    <option value="message_client">Изпрати съобщение (онлайн)</option>
                    <option value="call_client">Обади се (онлайн)</option>
                    <option value="meeting">Среща</option>
                  </select>
                </label>
                <label className="block"><span className="text-xs uppercase text-muted-foreground">Клиент</span>
                  <select value={taskDraft.client_id ?? ""} onChange={(e) => setTaskDraft({ ...taskDraft, client_id: e.target.value || null })} className={iC}>
                    <option value="">—</option>
                    {(data?.clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Краен срок</span>
                  <input type="datetime-local" value={taskDraft.due_at ?? ""} onChange={(e) => setTaskDraft({ ...taskDraft, due_at: e.target.value || null })} className={iC} />
                </label>
                <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Описание</span>
                  <textarea rows={3} value={taskDraft.description ?? ""} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} className={iC} />
                </label>
              </div>
              <p className="rounded bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-200">
                За онлайн задачи (съобщение / обаждане) — при отметка системата автоматично записва, че действието е извършено.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTaskDraft(null)}>Отказ</Button>
                <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
              </div>
            </form>
          </div>
        )}

        {/* Assign client picker */}
        {showAssign && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#8B1A2B]/65 p-4" onClick={() => setShowAssign(false)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-card p-6 text-foreground shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-xl">Прикачи клиент</h3>
                <button onClick={() => setShowAssign(false)}><X className="h-5 w-5" /></button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Само клиенти без брокер. Брокерът ще вижда само своите клиенти.</p>
              <div className="space-y-2">
                {unassigned.map((c) => (
                  <button key={c.id} disabled={busy} onClick={() => doAssign(c.id)} className="flex w-full items-center justify-between rounded border border-border p-2 text-left hover:bg-muted">
                    <div>
                      <div className="font-semibold text-sm">{c.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">{labelType(c.client_type)} {c.cities?.name && `· ${c.cities.name}`} {c.phone && `· ${c.phone}`}</div>
                    </div>
                    <UserPlus className="h-4 w-4 text-primary" />
                  </button>
                ))}
                {!unassigned.length && <div className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">Няма свободни клиенти.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function labelType(t: string) { return ({ buyer: "Купувач", seller: "Продавач", tenant: "Наемател", landlord: "Наемодател" } as any)[t] ?? t; }

function PasswordResetPanel({ brokerId, brokerName }: { brokerId: string; brokerName: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 8) return toast.error("Паролата трябва да е поне 8 символа");
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return toast.error("Изисква малка, главна буква и цифра");
    if (pw !== pw2) return toast.error("Паролите не съвпадат");
    setBusy(true);
    try {
      await resetBrokerPassword({ data: { broker_id: brokerId, new_password: pw } });
      toast.success(`Паролата на ${brokerName} е сменена`);
      setOpen(false); setPw(""); setPw2("");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20">
        <KeyRound className="h-4 w-4" /> Смени парола (без стара)
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <KeyRound className="h-4 w-4" /> Нова парола за {brokerName}
      </div>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Нова парола (мин. 8, главна, малка, цифра)" className={iC} autoComplete="new-password" />
      <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Потвърди паролата" className={iC} autoComplete="new-password" />
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={busy} className="gold-cta-button">{busy ? "Смяна..." : "Запази новата парола"}</Button>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); setPw(""); setPw2(""); }}>Отказ</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Старата парола не е нужна. Брокерът трябва да влезе с новата.</p>
    </div>
  );
}
