import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User } from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

const NAV: Array<{
  key: SiteNavKey;
  label: string;
  to: string;
  search?: Record<string, string>;
}> = [
  { key: "sale", label: "За продажба", to: "/search", search: { status: "sale" } },
  { key: "rent", label: "Под наем", to: "/search", search: { status: "rent" } },
  { key: "about", label: "За нас", to: "/about" },
];

/**
 * Unified SiteHeader — pixel reference: file_8666.jpg.
 *
 * Layout: marble cream panel on the left (logo) with an S-curved right edge
 * that dips into the burgundy panel on the right (nav). A gold ribbon sashes
 * diagonally across the boundary.
 *
 * Used on every public page (home, city, district, property, search, about,
 * login).
 */
export function SiteHeader({ active }: { active?: SiteNavKey } = {}) {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Triple-click logo → /login?redirect=/admin (preserves existing easter egg).
  const handleLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      navigate({ to: "/login", search: { redirect: "/admin" } as never });
      return;
    }
    clickTimer.current = setTimeout(() => {
      const c = clickCount.current;
      clickCount.current = 0;
      if (c === 1) navigate({ to: "/" });
    }, 420);
  };

  return (
    <header
      className="relative z-30 w-full select-none"
      style={{ filter: "drop-shadow(0 8px 22px rgba(80,12,20,0.28))" }}
    >
      <div className="relative h-[108px] w-full overflow-hidden md:h-[140px] lg:h-[160px]">
        {/* ============ Base: burgundy panel (right side) ============ */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 70% 20%, rgba(110,20,38,0.55), transparent 55%), linear-gradient(135deg, #560a18 0%, #3a060f 55%, #220409 100%)",
          }}
        />
        {/* Subtle burgundy marble veining */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-screen"
          style={{
            backgroundImage:
              "repeating-linear-gradient(118deg, transparent 0 90px, rgba(232,190,110,0.35) 90px 91px, transparent 91px 200px), repeating-linear-gradient(72deg, transparent 0 140px, rgba(200,140,60,0.25) 140px 141px, transparent 141px 280px)",
          }}
        />
        {/* Gold hairline along the very top of the burgundy area */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(184,137,58,0.0) 18%, rgba(232,196,119,0.65) 50%, rgba(184,137,58,0.0) 82%, transparent 100%)",
          }}
        />

        {/* ============ Marble panel (left) with S-curve right edge ============ */}
        <div
          className="absolute left-0 top-0 h-full w-[58%] sm:w-[48%] md:w-[40%] lg:w-[36%] xl:w-[34%]"
          style={{
            background:
              "radial-gradient(ellipse at 22% 6%, #fffaf0 0%, transparent 55%), radial-gradient(ellipse at 85% 95%, #e6cc8e 0%, transparent 58%), linear-gradient(165deg, #fbf6ea 0%, #f4e6c4 55%, #ecd9a8 100%)",
            clipPath:
              "path('M0 0 L78% 0 C92% 0 96% 18% 84% 38% C72% 60% 92% 78% 100% 88% C84% 96% 56% 100% 28% 100% L0 100% Z')",
            WebkitClipPath:
              "path('M0 0 L78% 0 C92% 0 96% 18% 84% 38% C72% 60% 92% 78% 100% 88% C84% 96% 56% 100% 28% 100% L0 100% Z')",
          }}
        >
          {/* Marble veining inside the cream panel */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-45 mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, transparent 0 80px, rgba(180,140,70,0.22) 80px 81px, transparent 81px 160px), repeating-linear-gradient(75deg, transparent 0 120px, rgba(120,80,30,0.14) 120px 121px, transparent 121px 240px)",
            }}
          />
          {/* Soft cream-to-gold dust along the chupka edge */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 95% 70%, rgba(228,180,90,0.35) 0%, transparent 38%)",
            }}
          />
        </div>

        {/* Gold edge tracing the S-curve where marble meets burgundy */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-[6] h-full w-[58%] sm:w-[48%] md:w-[40%] lg:w-[36%] xl:w-[34%]"
          viewBox="0 0 400 160"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="siteHeaderGoldEdge" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#b8893a" stopOpacity="0" />
              <stop offset="22%" stopColor="#d8a84a" />
              <stop offset="55%" stopColor="#f8e3a0" />
              <stop offset="85%" stopColor="#c89638" />
              <stop offset="100%" stopColor="#7a5418" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M312 0 C368 0 384 29 336 61 C288 96 368 125 400 141 C336 154 224 160 112 160"
            fill="none"
            stroke="url(#siteHeaderGoldEdge)"
            strokeWidth="2.4"
          />
          <path
            d="M316 6 C360 8 374 30 332 56 C292 86 360 116 392 130"
            fill="none"
            stroke="url(#siteHeaderGoldEdge)"
            strokeWidth="1"
            opacity="0.6"
          />
        </svg>

        {/* ============ Gold ribbon sash crossing the boundary ============ */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-[18%] top-0 z-[7] h-full w-[64%] md:left-[20%] md:w-[58%]"
          viewBox="0 0 1000 160"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Front face of the ribbon — bright polished gold */}
            <linearGradient id="ribbonFront" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fff1c2" />
              <stop offset="22%" stopColor="#f6dc8a" />
              <stop offset="55%" stopColor="#d5a23c" />
              <stop offset="82%" stopColor="#b07c1f" />
              <stop offset="100%" stopColor="#7a5316" />
            </linearGradient>
            {/* Back face — the twist underside, slightly darker */}
            <linearGradient id="ribbonBack" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8a5e1c" />
              <stop offset="50%" stopColor="#c08a2a" />
              <stop offset="100%" stopColor="#f0d077" />
            </linearGradient>
            <linearGradient id="ribbonHighlight" x1="0" x2="1">
              <stop offset="0%" stopColor="#fff8dc" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff8dc" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fff8dc" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Main ribbon body — gentle S-sweep from upper-left to far right */}
          <path
            d="M40,-10 C160,10 240,90 360,80 C460,72 540,30 700,42 C820,50 920,30 1010,8 L1010,28 C920,52 820,72 700,62 C540,50 460,92 360,100 C240,110 160,32 40,12 Z"
            fill="url(#ribbonFront)"
          />
          {/* Underside twist — small darker chevron near the curl */}
          <path
            d="M348,78 C384,76 420,68 456,58 C440,82 408,98 372,102 C360,94 352,86 348,78 Z"
            fill="url(#ribbonBack)"
            opacity="0.92"
          />
          {/* Edge stroke on top */}
          <path
            d="M40,-10 C160,10 240,90 360,80 C460,72 540,30 700,42 C820,50 920,30 1010,8"
            fill="none"
            stroke="#fff4cf"
            strokeWidth="1"
            opacity="0.7"
          />
          {/* Edge stroke on bottom */}
          <path
            d="M40,12 C160,32 240,110 360,100 C460,92 540,50 700,62 C820,72 920,52 1010,28"
            fill="none"
            stroke="#6b4612"
            strokeWidth="0.9"
            opacity="0.55"
          />
          {/* Specular highlight running along the front face */}
          <path
            d="M70,2 C180,22 250,86 360,76 C460,68 540,18 700,32 C820,42 910,22 1000,2"
            fill="none"
            stroke="url(#ribbonHighlight)"
            strokeWidth="1.6"
          />
        </svg>

        {/* ============ Logo (on marble) ============ */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало (троен клик за админ вход)"
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 md:left-10"
        >
          <img
            src={logoNadezhda}
            alt="Недвижими имоти ИЛДЖ.ИА"
            draggable={false}
            className="h-[60px] w-auto object-contain md:h-[88px] lg:h-[104px]"
          />
        </Link>

        {/* ============ Navigation (on burgundy) ============ */}
        <nav className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center gap-5 md:right-10 md:gap-9 lg:gap-12">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              className={cn(
                "relative font-display text-[14px] tracking-wide text-[#f5ecd4] transition hover:text-[#e8c477] md:text-[16px] lg:text-[17px]",
                active === item.key &&
                  "text-[#e8c477] after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-[#e8c477]",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="text-[#f5ecd4] transition hover:text-[#e8c477]"
          >
            <User className="h-5 w-5 md:h-6 md:w-6" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
