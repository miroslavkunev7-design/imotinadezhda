import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { AlertTriangle, ScrollText, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/rules")({ component: RulesPage });

type Rule = {
  id: string;
  title: string;
  description: string;
  exception?: string;
  priority: "critical" | "high" | "normal";
};

const RULES: Rule[] = [
  {
    id: "1",
    title: "Всяка промяна важи за ВСИЧКИ версии",
    description:
      "Когато правя промяна по сайта, тя ТРЯБВА да бъде приложена едновременно за: Десктоп, Таблет, Мобилен (browser), Mobile App (PWA), Mobile Loyalt preset, App за компютър (installed PWA).",
    exception: 'Само ако изрично кажа: „само за десктоп", „само за мобилен" и т.н.',
    priority: "critical",
  },
  {
    id: "2",
    title: "Pixel-perfect — 1:1 с референциите",
    description:
      "Без импровизации. Само това, което се вижда в screenshot-ите/референциите. Без добавени елементи, текстове или ефекти, които не са поискани.",
    priority: "high",
  },
  {
    id: "3",
    title: "Цветова схема — burgundy + злато + бяло",
    description:
      "Дълбок burgundy/тъмно червено (#600f1c / #4f0314→#260108), злато (#c59441 / #f4d07d→#c59441), бяло/крем. БЕЗ черно, БЕЗ мрамор за нови елементи.",
    priority: "high",
  },
  {
    id: "4",
    title: "Без текст „ИЛДЖ.ИА" в hero секцията",
    description: "Hero не съдържа никога низ „ИЛДЖ.ИА" или подобни placeholder надписи.",
    priority: "normal",
  },
  {
    id: "5",
    title: "Планиране преди изпълнение",
    description:
      "За по-големи или неясни задачи първо обсъждаме план, после изпълнявам. Малки и ясни задачи се правят директно.",
    priority: "normal",
  },
];

const PRIORITY_STYLES: Record<Rule["priority"], { label: string; ring: string; chip: string }> = {
  critical: {
    label: "КРИТИЧНО",
    ring: "border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.35),0_18px_40px_-20px_rgba(239,68,68,0.55)]",
    chip: "bg-red-600 text-white",
  },
  high: {
    label: "ВАЖНО",
    ring: "border-red-400/60",
    chip: "bg-red-500/90 text-white",
  },
  normal: {
    label: "ОБЩО",
    ring: "border-amber-500/30",
    chip: "bg-amber-500/90 text-[#260108]",
  },
};

function RulesPage() {
  return (
    <AdminShell breadcrumb="Правила">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/60 bg-red-600/15 text-red-300">
            <ScrollText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-amber-100">Правила за работа</h1>
            <p className="text-sm text-amber-100/60">
              Задължителни правила, които AI агентът спазва при всяка промяна по сайта.
            </p>
          </div>
        </div>

        {/* Critical banner */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-700/40 via-red-900/30 to-[#260108]/60 p-5 shadow-[0_0_0_2px_rgba(239,68,68,0.25),0_24px_60px_-20px_rgba(239,68,68,0.5)]">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-red-400/60 bg-red-600/30 text-red-200">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  ПРАВИЛО #1
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-200/80">
                  Критично · винаги се прилага
                </span>
              </div>
              <h2 className="mt-2 font-display text-xl text-red-100">
                Всяка промяна важи за ВСИЧКИ версии
              </h2>
              <p className="mt-1 text-sm text-red-100/85">
                Десктоп · Таблет · Мобилен · Mobile App · Mobile Loyalt · App за компютър.
                Изключение само при изрично указание „само за X версия".
              </p>
            </div>
          </div>
        </div>

        {/* Rules table */}
        <div className="overflow-hidden rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)]">
          <div className="grid grid-cols-[60px_1fr_120px] gap-3 border-b border-amber-500/20 bg-[rgba(20,4,8,0.7)] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
            <div>№</div>
            <div>Правило</div>
            <div className="text-right">Приоритет</div>
          </div>

          {RULES.map((rule) => {
            const styles = PRIORITY_STYLES[rule.priority];
            return (
              <div
                key={rule.id}
                className={`grid grid-cols-[60px_1fr_120px] items-start gap-3 border-b border-amber-500/10 px-4 py-4 last:border-b-0 ${
                  rule.priority === "critical" ? "bg-red-950/30" : ""
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 font-display text-lg ${
                    rule.priority === "critical"
                      ? "border-red-400 bg-red-600 text-white"
                      : rule.priority === "high"
                      ? "border-red-400/60 bg-red-600/20 text-red-200"
                      : "border-amber-500/40 bg-amber-500/15 text-amber-100"
                  }`}
                >
                  {rule.id}
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-display text-base ${
                      rule.priority === "critical" ? "text-red-100" : "text-amber-100"
                    }`}
                  >
                    {rule.title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                    <CheckCircle2 className="mr-1 -mt-0.5 inline h-3.5 w-3.5 text-emerald-400" />
                    {rule.description}
                  </p>
                  {rule.exception && (
                    <p className="mt-1.5 text-xs leading-relaxed text-red-200/80">
                      <XCircle className="mr-1 -mt-0.5 inline h-3.5 w-3.5 text-red-400" />
                      <span className="font-semibold">Изключение: </span>
                      {rule.exception}
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles.chip}`}
                  >
                    {styles.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.4)] p-4">
          <p className="text-xs text-amber-100/60">
            💡 Тези правила се пазят в паметта на AI агента и се прилагат автоматично при всеки
            нов разговор. За промяна на правило — кажи на агента и той ще обнови записа.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
