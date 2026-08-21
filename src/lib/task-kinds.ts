/** Shared CRM task kinds and which ones require a linked client. */

export type TaskKindOption = { value: string; label: string };

export const TASK_TYPE_OPTIONS: TaskKindOption[] = [
  { value: "general", label: "Обща" },
  { value: "mortgage", label: "Ипотека" },
  { value: "viewing", label: "Оглед" },
  { value: "visit", label: "Оглед" },
  { value: "deal", label: "Сделка" },
  { value: "call", label: "Обаждане" },
  { value: "call_client", label: "Обаждане (онлайн)" },
  { value: "message_client", label: "Съобщение (онлайн)" },
  { value: "qualification", label: "Квалификация" },
  { value: "client_docs", label: "Документи на клиент" },
  { value: "document", label: "Документ" },
  { value: "bank_appointment", label: "Банково бюро / кредит" },
  { value: "follow_up", label: "Follow-up" },
  { value: "meeting_client", label: "Среща с клиент" },
  { value: "meeting", label: "Среща" },
  { value: "contract_prelim", label: "Предварителен договор" },
  { value: "contract_notary", label: "Нотариус / окончателен договор" },
  { value: "rent_collect", label: "Събиране на наем" },
];

/** Types shown when creating a task from a client card / mortgage / deal folder. */
export const CLIENT_BOUND_TASK_OPTIONS: TaskKindOption[] = [
  { value: "mortgage", label: "Ипотека" },
  { value: "viewing", label: "Оглед" },
  { value: "deal", label: "Сделка" },
  { value: "call", label: "Обаждане" },
  { value: "qualification", label: "Квалификация" },
  { value: "client_docs", label: "Документи на клиент" },
  { value: "bank_appointment", label: "Банково бюро / кредит" },
  { value: "follow_up", label: "Follow-up" },
  { value: "meeting_client", label: "Среща с клиент" },
  { value: "contract_prelim", label: "Предварителен договор" },
  { value: "contract_notary", label: "Нотариус" },
  { value: "message_client", label: "Съобщение" },
];

export const CLIENT_RELATED_TASK_TYPES = new Set<string>([
  "mortgage",
  "viewing",
  "visit",
  "deal",
  "call",
  "call_client",
  "message_client",
  "qualification",
  "client_docs",
  "document",
  "document_prep",
  "bank_appointment",
  "follow_up",
  "meeting_client",
  "meeting",
  "contract_prelim",
  "contract_notary",
  "rent_collect",
  "meeting_owner",
  "key_handover",
]);

export function isClientRelatedTaskType(type?: string | null): boolean {
  return !!type && CLIENT_RELATED_TASK_TYPES.has(type);
}

export function taskTypeLabel(type?: string | null): string {
  if (!type) return "Задача";
  return TASK_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

export function formatClientLabel(c: { full_name: string; phone?: string | null }): string {
  const phone = (c.phone ?? "").trim();
  return phone ? `${c.full_name} · ${phone}` : c.full_name;
}

export function autoTaskTitle(type: string, clientName: string): string {
  return `${taskTypeLabel(type)} — ${clientName}`;
}
