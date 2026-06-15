import type { ThemePresets } from "@/lib/theme/tokens";

type Group = {
  key: keyof ThemePresets;
  label: string;
  options: Array<{ value: string; label: string; preview: string }>;
};

const GROUPS: Group[] = [
  {
    key: "cards",
    label: "Карти с градове",
    options: [
      { value: "classic", label: "Класик", preview: "bg-card border border-border shadow-md" },
      { value: "glass", label: "Glass", preview: "bg-white/10 backdrop-blur border border-white/30" },
      { value: "minimal", label: "Минимал", preview: "bg-transparent border-b border-border" },
      { value: "gradient", label: "Градиент", preview: "bg-gradient-to-br from-primary to-accent text-primary-foreground" },
    ],
  },
  {
    key: "navbar",
    label: "Navbar",
    options: [
      { value: "burgundy", label: "Бургундия pill", preview: "bg-primary text-primary-foreground rounded-full" },
      { value: "transparent", label: "Прозрачен", preview: "bg-transparent border border-white/30 text-foreground" },
      { value: "dark", label: "Тъмен", preview: "bg-neutral-900 text-white" },
    ],
  },
  {
    key: "logo",
    label: "Позиция на лого",
    options: [
      { value: "left-above", label: "Ляво над", preview: "bg-card border border-border text-card-foreground" },
      { value: "left-inline", label: "Ляво в линия", preview: "bg-card border border-border text-card-foreground" },
      { value: "center", label: "Центрирано", preview: "bg-card border border-border text-card-foreground" },
    ],
  },
  {
    key: "forms",
    label: "Стил на форми",
    options: [
      { value: "rounded", label: "Закръглени", preview: "bg-input rounded-xl border border-border" },
      { value: "classic", label: "Класически", preview: "bg-input rounded border border-border" },
      { value: "underline", label: "Underline", preview: "bg-transparent border-b-2 border-primary" },
    ],
  },
  {
    key: "buttons",
    label: "Стил на бутони",
    options: [
      { value: "pill", label: "Pill", preview: "bg-primary text-primary-foreground rounded-full" },
      { value: "rounded", label: "Закръглени", preview: "bg-primary text-primary-foreground rounded-lg" },
      { value: "square", label: "Квадратни", preview: "bg-primary text-primary-foreground rounded-none" },
    ],
  },
];

type Props = {
  presets: ThemePresets;
  onChange: (next: ThemePresets) => void;
};

export function PresetPicker({ presets, onChange }: Props) {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.key}>
          <div className="mb-2 text-sm font-medium text-amber-100">{group.label}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.options.map((opt) => {
              const active = presets[group.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...presets, [group.key]: opt.value as never })}
                  className={`group flex flex-col items-stretch gap-2 rounded-xl border p-2 text-left transition ${
                    active
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-amber-500/25 bg-[rgba(20,4,8,0.55)] hover:border-amber-400/60"
                  }`}
                >
                  <div className={`flex h-10 items-center justify-center rounded-md text-[10px] font-medium ${opt.preview}`}>
                    Aa
                  </div>
                  <div className="text-xs text-amber-100">{opt.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
