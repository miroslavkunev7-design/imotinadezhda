import { Link } from "@tanstack/react-router";

import { SITE_NAME } from "@/lib/site-config";

const CITY_LINKS = [
  { to: "/cities/$slug" as const, params: { slug: "shumen" }, label: "Имоти Шумен" },
  { to: "/cities/$slug" as const, params: { slug: "varna" }, label: "Имоти Варна" },
  { to: "/cities/$slug" as const, params: { slug: "burgas" }, label: "Имоти Бургас" },
  { to: "/cities/$slug" as const, params: { slug: "novi-pazar" }, label: "Имоти Нови пазар" },
];

const linkCls = "text-[#f4d07d] underline-offset-2 hover:underline";

/** Compact public footer with natural city/intent links — not a keyword dump. */
export function SiteSeoFooter() {
  return (
    <footer className="border-t border-[#C9A84C]/40 bg-[#2a0810] text-[#f5ecc8]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:px-8">
        <nav aria-label="Имоти по градове" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
          {CITY_LINKS.map((c) => (
            <Link key={c.params.slug} to={c.to} params={c.params} className={linkCls}>
              {c.label}
            </Link>
          ))}
          <Link to="/search" search={{ status: "rent", city_slug: "shumen" } as never} className={linkCls}>
            Наеми Шумен
          </Link>
        </nav>
        <nav aria-label="Услуги" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#f5ecc8]/85">
          <Link to="/search" search={{ status: "sale" } as never} className="hover:text-[#f4d07d]">
            Купи имот
          </Link>
          <Link to="/sell" className="hover:text-[#f4d07d]">
            Продай имот
          </Link>
          <Link to="/search" search={{ status: "rent" } as never} className="hover:text-[#f4d07d]">
            Под наем
          </Link>
          <Link to="/about" className="hover:text-[#f4d07d]">
            За нас
          </Link>
          <Link to="/contacts" className="hover:text-[#f4d07d]">
            Контакти
          </Link>
        </nav>
        <p className="text-[11px] tracking-wide text-[#f5ecc8]/55">
          {SITE_NAME}
          {" · "}
          <span lang="en">imoti nadezhda</span>
        </p>
      </div>
    </footer>
  );
}
