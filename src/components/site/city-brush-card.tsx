/**
 * CityBrushCard — карта на град: снимка, изрязана в четкова мазка, и бордо
 * мазка отдолу с името на града и „Разгледай“.
 */
import { Link } from "@tanstack/react-router";

import { BRUSH_SHAPE_URL } from "@/components/site/brush-shape";
import { cn } from "@/lib/utils";

export function CityBrushCard({
  name,
  image,
  params,
  className,
}: {
  name: string;
  image: string;
  params: { slug: string };
  className?: string;
}) {
  const mask: React.CSSProperties = {
    WebkitMaskImage: `url(${BRUSH_SHAPE_URL})`,
    maskImage: `url(${BRUSH_SHAPE_URL})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };

  return (
    <Link
      to="/cities/$slug"
      params={params}
      aria-label={`Имоти в ${name}`}
      className={cn("group block", className)}
    >
      {/* Снимка в мазка */}
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={mask}>
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 md:group-hover:scale-105"
        />
      </div>

      {/* Бордо мазка с името и „Разгледай“ */}
      <div className="relative -mt-3 flex aspect-[16/5] w-full flex-col items-center justify-center px-6 text-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ ...mask, backgroundColor: "#8B1A2B" }}
        />
        <span className="relative font-display text-[20px] font-extrabold uppercase leading-none tracking-[0.06em] text-white md:text-[28px]">
          {name}
        </span>
        <span className="relative mt-1 font-display text-[11px] uppercase tracking-[0.22em] text-[#E8C777] md:text-[13px]">
          Разгледай
        </span>
      </div>
    </Link>
  );
}

export default CityBrushCard;
