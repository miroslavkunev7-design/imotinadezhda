import { useEffect, useRef } from "react";
const W = 1536,
  H = 1024,
  STRIP = 8,
  FRAME = 1000 / 30;
const load = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
export default function SeaMotion({ freeze = false }) {
  const layerRef = useRef(null),
    seaRef = useRef(null),
    protectRef = useRef(null);
  useEffect(() => {
    let cancelled = false,
      raf = 0,
      last = -Infinity,
      visible = true,
      documentVisible = !document.hidden;
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    Promise.all([
      load("/assets/HOME_WORKING_PIXEL_LOCK.png"),
      load("/assets/SEA_EFFECTIVE_MOTION_MASK.png"),
      load("/assets/SEA_PROTECTED_STATIC_MASK.png"),
    ]).then(([base, mask, protectMask]) => {
      if (cancelled) return;
      const sea = seaRef.current.getContext("2d", { alpha: true });
      const protect = protectRef.current.getContext("2d", { alpha: true });
      seaRef.current.width = protectRef.current.width = W;
      seaRef.current.height = protectRef.current.height = H;
      sea.imageSmoothingEnabled = true;
      sea.imageSmoothingQuality = "high";
      protect.imageSmoothingEnabled = true;
      protect.imageSmoothingQuality = "high";
      protect.drawImage(base, 0, 0, W, H);
      protect.globalCompositeOperation = "destination-in";
      protect.drawImage(protectMask, 0, 0, W, H);
      protect.globalCompositeOperation = "source-over";
      const render = (s) => {
        sea.clearRect(0, 0, W, H);
        const p1 = Math.sin(s * 0.6),
          p2 = Math.sin(s * 0.37);
        for (let y = 0; y < H; y += STRIP) {
          const sh = Math.min(STRIP + 1, H - y),
            sx = Math.sin(y * 0.031) + 0.48 * Math.sin(y * 0.013),
            syShape = Math.cos(y * 0.027) + 0.3 * Math.sin(y * 0.009),
            dx = p1 * sx * 1.55 + p2 * Math.cos(y * 0.018) * 0.42,
            dy = p2 * syShape * 0.72,
            sy = Math.max(0, Math.min(H - sh, y + dy));
          sea.drawImage(base, 0, sy, W, sh, dx, y, W, sh + 1);
        }
        sea.globalCompositeOperation = "destination-in";
        sea.drawImage(mask, 0, 0, W, H);
        sea.globalCompositeOperation = "source-over";
      };
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (freeze || reduced) {
        render(0);
        return;
      }
      const tick = (now) => {
        if (cancelled) return;
        if (!visible || !documentVisible) {
          raf = 0;
          return;
        }
        if (now - last >= FRAME) {
          last = now;
          render(now / 1000);
        }
        raf = requestAnimationFrame(tick);
      };
      const resume = () => {
        if (!raf && visible && documentVisible && !cancelled) raf = requestAnimationFrame(tick);
      };
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          if (visible) resume();
          else stop();
        },
        { threshold: 0.01 },
      );
      io.observe(layerRef.current);
      const vis = () => {
        documentVisible = !document.hidden;
        if (documentVisible) resume();
        else stop();
      };
      document.addEventListener("visibilitychange", vis);
      resume();
      layerRef.current._cleanupSea = () => {
        io.disconnect();
        document.removeEventListener("visibilitychange", vis);
      };
    });
    return () => {
      cancelled = true;
      stop();
      layerRef.current?._cleanupSea?.();
    };
  }, [freeze]);
  return (
    <div ref={layerRef} className="sea-motion" aria-hidden="true">
      <canvas ref={seaRef} />
      <canvas ref={protectRef} />
    </div>
  );
}
