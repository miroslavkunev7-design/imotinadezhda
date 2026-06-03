import { useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/admin-shell";
import { useLogoSettings, defaultLogoSettings } from "@/hooks/useLogoSettings";

export const Route = createFileRoute("/admin/settings/logo")({ component: Page });

function Page() {
  const { settings, update, reset } = useLogoSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update({ src: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const inputCls =
    "w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.55)] px-3 py-2 text-amber-100 outline-none focus:border-amber-400";

  return (
    <AdminShell breadcrumb="Лого">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-2">
        <div>
          <h1 className="font-display text-2xl text-amber-100">Лого — качване и позиция</h1>
          <p className="text-sm text-amber-100/60">
            Качи ново лого и настрой позицията/размера. Промените се виждат веднага в навбара.
          </p>
        </div>

        {/* Preview */}
        <div className="relative h-56 overflow-hidden rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)]">
          <img
            src={settings.src}
            alt="Преглед на логото"
            style={{
              position: "absolute",
              top: `${settings.top}px`,
              left: `${settings.left}px`,
              height: `${settings.height}px`,
              width: "auto",
              filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.55))",
            }}
            draggable={false}
          />
          <div className="absolute right-2 top-2 rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-amber-100/80">
            top {settings.top}px · left {settings.left}px · h {settings.height}px
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-2 rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)] p-4">
          <label className="font-display text-amber-100">Качи ново лого (PNG с прозрачност)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="block w-full text-sm text-amber-100/80 file:mr-3 file:rounded-md file:border-0 file:bg-amber-500/20 file:px-3 file:py-2 file:text-amber-100 hover:file:bg-amber-500/30"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </div>

        {/* Position controls */}
        <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)] p-4 sm:grid-cols-3">
          {[
            { key: "top" as const,    label: "Отгоре (px)", min: -200, max: 400 },
            { key: "left" as const,   label: "Отляво (px)", min: -200, max: 800 },
            { key: "height" as const, label: "Височина (px)", min: 40,  max: 500 },
          ].map(({ key, label, min, max }) => (
            <div key={key} className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-amber-100/70">
                {label}
              </label>
              <input
                type="range"
                min={min}
                max={max}
                value={settings[key]}
                onChange={(e) => update({ [key]: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
              <input
                type="number"
                min={min}
                max={max}
                value={settings[key]}
                onChange={(e) => update({ [key]: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-lg border border-amber-500/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500/10"
          >
            Възстанови по подразбиране
          </button>
          <span className="self-center text-xs text-amber-100/50">
            Default: top {defaultLogoSettings.top} · left {defaultLogoSettings.left} · h {defaultLogoSettings.height}
          </span>
        </div>
      </div>
    </AdminShell>
  );
}
