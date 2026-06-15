import { useState } from "react";
import { Monitor, Smartphone, Tablet, Laptop, MonitorSmartphone } from "lucide-react";

const DEVICES = [
  { id: "mobile", label: "Mobile", w: 375, h: 667, icon: Smartphone },
  { id: "tablet", label: "Tablet", w: 768, h: 1024, icon: Tablet },
  { id: "desktop", label: "Desktop", w: 1440, h: 900, icon: Monitor },
  { id: "app-win", label: "App Windows", w: 1280, h: 800, icon: Laptop },
  { id: "app-mob", label: "App Mobile", w: 414, h: 896, icon: MonitorSmartphone },
] as const;

export function DevicePreview() {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[2]);
  // Scale to fit container while preserving aspect ratio.
  const maxW = 720;
  const scale = Math.min(1, maxW / device.w);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DEVICES.map((d) => {
          const Icon = d.icon;
          const active = d.id === device.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-amber-400 bg-amber-500/15 text-amber-100"
                  : "border-amber-500/25 bg-[rgba(20,4,8,0.55)] text-amber-100/70 hover:border-amber-400/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {d.label}
              <span className="ml-1 text-amber-100/40">
                {d.w}×{d.h}
              </span>
            </button>
          );
        })}
      </div>
      <div className="overflow-auto rounded-xl border border-amber-500/25 bg-black/40 p-4">
        <div
          style={{
            width: device.w * scale,
            height: device.h * scale,
            overflow: "hidden",
          }}
          className="mx-auto rounded-lg border border-amber-500/20 bg-white shadow-2xl"
        >
          <iframe
            src="/"
            title={`Preview ${device.label}`}
            style={{
              width: device.w,
              height: device.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
            }}
          />
        </div>
      </div>
      <p className="text-xs text-amber-100/60">
        Превюто се обновява автоматично при запазване на темата.
      </p>
    </div>
  );
}
