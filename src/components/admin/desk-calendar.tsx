import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WeeklySchedule } from "@/components/admin/weekly-schedule";
import logoScroll from "@/assets/logo-scroll-banner.png";
import coverLeft from "@/assets/calendar/calendar-cover-left.jpeg.asset.json";
import coverRight from "@/assets/calendar/calendar-cover-right.jpeg.asset.json";

/** Spiral binding rings shared by cover and opened page. */
function SpiralBinding() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-3 z-30 flex justify-around px-4">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="block h-6 w-3 rounded-full border border-[#5a3b0a]/60"
          style={{
            background:
              "linear-gradient(180deg, #f4e2a4 0%, #e0be5f 35%, #8a6a1e 70%, #d1a944 100%)",
            boxShadow:
              "inset 0 -2px 2px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.65), 0 3px 4px rgba(0,0,0,0.35)",
          }}
        />
      ))}
    </div>
  );
}

function CalendarCover({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Отвори графика"
      className="group relative block w-full overflow-hidden rounded-b-lg rounded-t-md border border-[#C9A84C]/60 text-left shadow-[0_25px_60px_-25px_rgba(0,0,0,0.55)]"
      style={{ aspectRatio: "1920 / 800" }}
    >
      {/* Bordeaux base + gold hairlines */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #8B1A2B 0%, #6a1220 55%, #4a0a17 100%)",
        }}
      />
      {/* Left side image with curved gold arc mask */}
      <div className="absolute inset-y-0 left-0 w-[32%] overflow-hidden">
        <img
          src={coverLeft.url}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
          style={{
            clipPath: "path('M 0 0 L 100% 0 Q 60% 50%, 100% 100% L 0 100% Z')",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-[3px]"
          style={{ background: "linear-gradient(180deg,#f4e2a4,#c9a84c,#8a6a1e)" }}
        />
      </div>
      {/* Right side image with mirrored curve */}
      <div className="absolute inset-y-0 right-0 w-[32%] overflow-hidden">
        <img
          src={coverRight.url}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
          style={{
            clipPath: "path('M 0 0 L 100% 0 L 100% 100% L 0 100% Q 40% 50%, 0 0 Z')",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "linear-gradient(180deg,#f4e2a4,#c9a84c,#8a6a1e)" }}
        />
      </div>

      {/* Center: white scroll logo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <img
          src={logoScroll}
          alt="Недвижими Имоти Надежда"
          className="pointer-events-none select-none"
          style={{
            width: "min(46%, 520px)",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.55))",
          }}
          draggable={false}
        />
        <div className="mt-4 flex items-center gap-3 text-[#f4e2a4]">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-[#C9A84C] to-[#C9A84C]" />
          <span aria-hidden className="text-[10px]">✦</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent via-[#C9A84C] to-[#C9A84C]" />
        </div>
        <div className="mt-2 font-display text-[clamp(14px,2.2vw,26px)] font-semibold uppercase tracking-[0.28em] text-white">
          Професионален график
        </div>
        <div className="mt-1 font-display text-[clamp(20px,3vw,40px)] font-bold text-[#f4e2a4] tabular-nums">
          2025
        </div>
      </div>

      {/* Bottom base shadow */}
      <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-b from-transparent to-black/40" />
      <SpiralBinding />

      {/* Hover hint */}
      <span className="absolute bottom-3 right-4 z-40 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm transition group-hover:bg-white/25">
        Отвори →
      </span>
    </button>
  );
}

export function DeskCalendar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0 w-full" style={open ? undefined : { perspective: "2200px" }}>
      <AnimatePresence initial={false} mode="wait">
        {!open ? (
          <motion.div
            key="cover"
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 100, opacity: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top center", transformStyle: "preserve-3d" }}
          >
            <CalendarCover onOpen={() => setOpen(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="page"
            className="min-w-0 w-full overflow-visible"
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top center" }}
          >
            <div className="relative min-w-0 w-full">
              <div className="absolute right-3 top-2 z-40">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-[#C9A84C]/60 bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B1A2B] shadow hover:bg-white"
                >
                  ← Затвори
                </button>
              </div>
              <WeeklySchedule />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DeskCalendar;