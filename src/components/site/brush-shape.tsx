/**
 * BrushShape — бордо/бяла четкова мазка като React + Tailwind компонент.
 *
 * Формата се прилага като CSS mask върху цветен слой, за да може вътре в
 * мазката да се поставя съдържание (лого, текст, бутон) — точно както е
 * на референтния дизайн.
 */
import { forwardRef } from "react";

import brushShape from "@/assets/brush-shape.png.asset.json";
import { cn } from "@/lib/utils";

export const BRUSH_SHAPE_URL = brushShape.url;

export type BrushTone = "burgundy" | "burgundyDark" | "white" | "gold";
export type BrushVariant = "panel" | "badge" | "pill" | "strip";

const TONE_BG: Record<BrushTone, string> = {
  burgundy: "#8B1A2B",
  burgundyDark: "#5f0f1c",
  white: "#ffffff",
  gold: "#C9A84C",
};

const VARIANT_CLASS: Record<BrushVariant, string> = {
  /** Голям вертикален панел (дясната страна на hero-а). */
  panel: "px-10 py-12",
  /** Лого бадж горе вляво. */
  badge: "px-8 py-6",
  /** Малка пилюла (бутон „Търси"). */
  pill: "px-7 py-3",
  /** Хоризонтална лента по дъното. */
  strip: "px-8 py-6",
};

export type BrushShapeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: BrushTone;
  variant?: BrushVariant;
  /** Обръща формата хоризонтално (за огледален ръб). */
  flipX?: boolean;
  /** Обръща формата вертикално. */
  flipY?: boolean;
  /** Пълни целия контейнер вместо да разтяга по съдържание. */
  stretch?: boolean;
};

export const BrushShape = forwardRef<HTMLDivElement, BrushShapeProps>(function BrushShape(
  {
    tone = "burgundy",
    variant = "panel",
    flipX = false,
    flipY = false,
    stretch = false,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const scaleX = flipX ? -1 : 1;
  const scaleY = flipY ? -1 : 1;

  return (
    <div
      ref={ref}
      className={cn("relative isolate", stretch && "h-full w-full", className)}
      style={style}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundColor: TONE_BG[tone],
          WebkitMaskImage: `url(${BRUSH_SHAPE_URL})`,
          maskImage: `url(${BRUSH_SHAPE_URL})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          transform: `scale(${scaleX}, ${scaleY})`,
        }}
      />
      <div className={cn("relative flex flex-col", VARIANT_CLASS[variant])}>{children}</div>
    </div>
  );
});

export default BrushShape;
