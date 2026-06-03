import { Link } from "@tanstack/react-router";

import landing from "@/assets/landing-master.png.asset.json";

type Hotspot = {
  to: string;
  search?: Record<string, string>;
  label: string;
  // % positions in the 1402x1122 master image
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// Calibrated to the C67E… master mock (1402 × 1122)
const HOTSPOTS: Hotspot[] = [
  // Navbar
  { to: "/", label: "Начало", left: 2.1, right: 71.8, top: 1.3, bottom: 82.2 }, // logo scroll
  { to: "/search", search: { status: "sale" }, label: "За продажба", left: 43.2, right: 43.7, top: 7.1, bottom: 88.4 },
  { to: "/search", search: { status: "rent" }, label: "Под наем",   left: 60.3, right: 27.2, top: 7.1, bottom: 88.4 },
  { to: "/about",                                label: "За нас",    left: 75.6, right: 15.1, top: 7.1, bottom: 88.4 },
  { to: "/login", search: { redirect: "/admin" }, label: "Профил",   left: 94.2, right: 1.6,  top: 7.1, bottom: 88.4 },

  // Search bar fields → all open /search
  { to: "/search", label: "Град",      left: 4.6,  right: 81.5, top: 52.6, bottom: 41.2 },
  { to: "/search", label: "Квартал",   left: 19.6, right: 68.6, top: 52.6, bottom: 41.2 },
  { to: "/search", label: "Вид имот",  left: 32.5, right: 55.4, top: 52.6, bottom: 41.2 },
  { to: "/search", label: "Цена",      left: 45.6, right: 37.2, top: 52.6, bottom: 41.2 },
  { to: "/search", label: "Площ",      left: 63.8, right: 22.9, top: 52.6, bottom: 41.2 },
  { to: "/search", label: "Търси",     left: 79.2, right: 8.0,  top: 53.9, bottom: 41.2 },
  { to: "/search", label: "Още филтри", left: 92.4, right: 1.6, top: 53.9, bottom: 41.2 },

  // City cards
  { to: "/cities/$slug", search: undefined, label: "Бургас",    left: 4.6,  right: 74.7, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Варна",     left: 26.4, right: 52.9, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Шумен",     left: 48.1, right: 31.2, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Нов Пазар", left: 69.9, right: 9.4,  top: 61.9, bottom: 17.6 },
];

// city hotspot slugs in order
const CITY_SLUGS = ["burgas", "varna", "shumen", "novi-pazar"];

export function LandingImageHome() {
  return (
    <main
      className="relative w-full"
      style={{
        backgroundColor: "#1a0d10",
      }}
    >
      <div className="relative mx-auto w-full" style={{ maxWidth: 1402 }}>
        <div className="relative w-full" style={{ aspectRatio: "1402 / 1122" }}>
          <img
            src={landing.url}
            alt="Недвижими имоти Надежда — начална страница"
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
            style={{ objectFit: "fill" }}
            fetchPriority="high"
          />
          {HOTSPOTS.map((h, i) => {
            const isCity = h.to === "/cities/$slug";
            const cityIndex =
              isCity ? HOTSPOTS.filter((x, j) => x.to === "/cities/$slug" && j <= i).length - 1 : -1;
            const params = isCity ? { slug: CITY_SLUGS[cityIndex] } : undefined;
            return (
              <Link
                key={`${h.label}-${i}`}
                to={h.to as never}
                params={params as never}
                search={h.search as never}
                aria-label={h.label}
                className="absolute block rounded-md transition-colors duration-150 hover:bg-white/5 focus:bg-white/10 focus:outline-none"
                style={{
                  left: `${h.left}%`,
                  right: `${h.right}%`,
                  top: `${h.top}%`,
                  bottom: `${h.bottom}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default LandingImageHome;
