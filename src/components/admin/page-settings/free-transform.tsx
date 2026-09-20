/**
 * Свободно местене, оразмеряване и завъртане на поставен елемент —
 * само с pointer events, без външна библиотека.
 *
 * Позицията и ширината се пазят в проценти от страницата, а височината в px,
 * така че елементът се държи еднакво на десктоп и на мобилно.
 */
import { useCallback, useRef, type ReactNode } from "react";
import { Move, RotateCw } from "lucide-react";

export type Transform = { x: number; y: number; w: number; h: number; rotate: number };

type Props = {
  value: Transform;
  active: boolean;
  onChange: (next: Partial<Transform>) => void;
  onCommit?: () => void;
  onSelect?: () => void;
  children: ReactNode;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function FreeTransform({ value, active, onChange, onCommit, onSelect, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; py: number; t: Transform; box: DOMRect } | null>(null);

  const begin = useCallback(
    (e: React.PointerEvent) => {
      const parent = hostRef.current?.offsetParent as HTMLElement | null;
      const box = (parent ?? document.body).getBoundingClientRect();
      start.current = { px: e.clientX, py: e.clientY, t: { ...value }, box };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    },
    [value],
  );

  const finish = useCallback(() => {
    if (!start.current) return;
    start.current = null;
    onCommit?.();
  }, [onCommit]);

  const onDragMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.box.width === 0) return;
    const dx = ((e.clientX - s.px) / s.box.width) * 100;
    const dy = ((e.clientY - s.py) / s.box.height) * 100;
    onChange({ x: clamp(s.t.x + dx, -20, 110), y: clamp(s.t.y + dy, -20, 400) });
  };

  const onResizeMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.box.width === 0) return;
    const dw = ((e.clientX - s.px) / s.box.width) * 100;
    const dh = e.clientY - s.py;
    onChange({ w: clamp(s.t.w + dw, 5, 200), h: clamp(s.t.h + dh, 40, 2400) });
  };

  const onRotateMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const host = hostRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
    onChange({ rotate: Math.round(deg) });
  };

  return (
    <div
      ref={hostRef}
      className="absolute"
      style={{
        left: `${value.x}%`,
        top: `${value.y}%`,
        width: `${value.w}%`,
        height: `${value.h}px`,
        transform: `rotate(${value.rotate}deg)`,
        pointerEvents: "auto",
        touchAction: active ? "none" : undefined,
        outline: active ? "2px dashed rgba(201,168,76,.8)" : undefined,
        outlineOffset: 2,
      }}
      onClick={(e) => {
        if (!active) return;
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {children}

      {active && (
        <>
          {/* Дръжка „ръка“ за местене */}
          <button
            type="button"
            data-crm-edit-ui
            aria-label="Премести"
            title="Премести"
            className="absolute -left-3 -top-3 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-full border border-amber-300 bg-[#4f0314] text-amber-200 shadow"
            onPointerDown={begin}
            onPointerMove={onDragMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <Move className="h-3.5 w-3.5" />
          </button>

          {/* Ъглова дръжка за размер */}
          <button
            type="button"
            data-crm-edit-ui
            aria-label="Оразмери"
            title="Оразмери"
            className="absolute -bottom-3 -right-3 z-20 h-7 w-7 cursor-nwse-resize rounded-full border border-amber-300 bg-amber-400 shadow"
            onPointerDown={begin}
            onPointerMove={onResizeMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          />

          {/* Дръжка за завъртане */}
          <button
            type="button"
            data-crm-edit-ui
            aria-label="Завърти"
            title="Завърти"
            className="absolute -top-3 right-4 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-[#4f0314] text-amber-200 shadow"
            onPointerDown={begin}
            onPointerMove={onRotateMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export default FreeTransform;
