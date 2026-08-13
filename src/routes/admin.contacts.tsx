import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MarbleCard } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Phone, Mail, Globe } from "lucide-react";
import {
  listContactGroups,
  listContacts,
  saveContact,
  deleteContact,
  saveContactGroup,
} from "@/lib/contacts.functions";

export const Route = createFileRoute("/admin/contacts")({ component: Page });

type Group = { id: string; slug: string; name: string; display_order: number };
type Contact = {
  id: string;
  group_id: string;
  company_name: string;
  contact_person: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  vat_number: string | null;
  notes: string | null;
};

function Page() {
  const fetchGroups = useServerFn(listContactGroups);
  const fetchContacts = useServerFn(listContacts);
  const saveC = useServerFn(saveContact);
  const delC = useServerFn(deleteContact);
  const saveG = useServerFn(saveContactGroup);
  const qc = useQueryClient();

  const groupsQ = useQuery({ queryKey: ["contact_groups"], queryFn: () => fetchGroups() });
  const contactsQ = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });

  const groups: Group[] = (groupsQ.data?.groups ?? []) as Group[];
  const contacts: Contact[] = (contactsQ.data?.contacts ?? []) as Contact[];

  const [activeSlug, setActiveSlug] = useState<string | "all">("all");
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const visible = useMemo(() => {
    if (activeSlug === "all") return contacts;
    const g = groups.find((x) => x.slug === activeSlug);
    if (!g) return [];
    return contacts.filter((c) => c.group_id === g.id);
  }, [contacts, groups, activeSlug]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.company_name?.trim() || !editing.group_id) {
      toast.error("Име на компания и група са задължителни");
      return;
    }
    try {
      await saveC({
        data: {
          id: editing.id,
          group_id: editing.group_id,
          company_name: editing.company_name.trim(),
          contact_person: editing.contact_person ?? null,
          role: editing.role ?? null,
          phone: editing.phone ?? null,
          email: editing.email ?? null,
          website: editing.website ?? null,
          address: editing.address ?? null,
          vat_number: editing.vat_number ?? null,
          notes: editing.notes ?? null,
        },
      });
      toast.success("Запазено");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Изтрий този контакт?")) return;
    try {
      await delC({ data: { id } });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    }
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04FF]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `g-${Date.now()}`;
    try {
      await saveG({
        data: { slug, name, display_order: (groups.length + 1) * 10 },
      });
      toast.success("Групата е добавена");
      setNewGroupName("");
      setNewGroupOpen(false);
      qc.invalidateQueries({ queryKey: ["contact_groups"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    }
  };

  return (
    <div className="space-y-5">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSlug("all")}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              activeSlug === "all"
                ? "bg-amber-400 text-[#4A1217] font-semibold"
                : "border border-amber-500/30 bg-amber-500/5 text-amber-100 hover:bg-amber-500/15"
            }`}
          >
            Всички ({contacts.length})
          </button>
          {groups.map((g) => {
            const count = contacts.filter((c) => c.group_id === g.id).length;
            const active = activeSlug === g.slug;
            return (
              <button
                key={g.id}
                onClick={() => setActiveSlug(g.slug)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  active
                    ? "bg-amber-400 text-[#4A1217] font-semibold"
                    : "border border-amber-500/30 bg-amber-500/5 text-amber-100 hover:bg-amber-500/15"
                }`}
              >
                {g.name} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setNewGroupOpen(true)}
            className="rounded-full border border-dashed border-amber-500/40 px-3 py-1.5 text-xs text-amber-100/80 hover:bg-amber-500/10"
          >
            + Нова група
          </button>
          <div className="flex-1" />
          <Button onClick={() => setEditing({ group_id: groups[0]?.id })} className="gold-cta-button">
            <Plus className="h-4 w-4" /> Добави контакт
          </Button>
        </div>

        {/* Cards */}
        {visible.length === 0 ? (
          <MarbleCard>
            <div className="py-10 text-center text-sm text-amber-900/70">
              Няма контакти в тази група. Натисни „Добави контакт".
            </div>
          </MarbleCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => {
              const g = groups.find((x) => x.id === c.group_id);
              return (
                <MarbleCard key={c.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-700">
                        <Building2 className="h-3.5 w-3.5" /> {g?.name ?? "—"}
                      </div>
                      <div className="mt-1 truncate font-display text-lg text-[#4A1217]">{c.company_name}</div>
                      {c.contact_person && (
                        <div className="text-sm text-amber-900/80">
                          {c.contact_person}
                          {c.role ? ` · ${c.role}` : ""}
                        </div>
                      )}
                      <div className="mt-2 space-y-1 text-xs text-amber-900/80">
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${c.email}`} className="truncate hover:underline">{c.email}</a>
                          </div>
                        )}
                        {c.website && (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3" />
                            <a href={c.website} target="_blank" rel="noreferrer" className="truncate hover:underline">{c.website}</a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="rounded-md p-1.5 text-amber-700 hover:bg-amber-500/15"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </MarbleCard>
              );
            })}
          </div>
        )}

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Редактирай контакт" : "Нов контакт"}</DialogTitle>
            <DialogDescription>Попълни данните за компанията или лицето.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-semibold">Група *</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={editing.group_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, group_id: e.target.value })}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <Field label="Компания / Име *" value={editing.company_name ?? ""} onChange={(v) => setEditing({ ...editing, company_name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Лице за контакт" value={editing.contact_person ?? ""} onChange={(v) => setEditing({ ...editing, contact_person: v })} />
                <Field label="Роля / Позиция" value={editing.role ?? ""} onChange={(v) => setEditing({ ...editing, role: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Телефон" value={editing.phone ?? ""} onChange={(v) => setEditing({ ...editing, phone: v })} />
                <Field label="Имейл" value={editing.email ?? ""} onChange={(v) => setEditing({ ...editing, email: v })} type="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сайт" value={editing.website ?? ""} onChange={(v) => setEditing({ ...editing, website: v })} />
                <Field label="ДДС №" value={editing.vat_number ?? ""} onChange={(v) => setEditing({ ...editing, vat_number: v })} />
              </div>
              <Field label="Адрес" value={editing.address ?? ""} onChange={(v) => setEditing({ ...editing, address: v })} />
              <div>
                <label className="text-xs font-semibold">Бележки</label>
                <Textarea
                  className="mt-1"
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
            <Button onClick={handleSave} className="gold-cta-button">Запази</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Нова група</DialogTitle>
          </DialogHeader>
          <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="напр. Адвокати" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Отказ</Button>
            <Button onClick={handleAddGroup} className="gold-cta-button">Добави</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold">{label}</label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} type={type} />
    </div>
  );
}
