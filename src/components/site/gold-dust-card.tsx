import { useEffect, useRef } from "react";

/**
 * Interactive gold-dust particle layer for cards.
 *
 * Drop it inside any positioned (relative) container — typically the inner
 * media wrapper of a card. It paints a low-cost canvas overlay that listens
 * to pointer movement on the canvas's parent element and spawns golden
 * particles that drift outward and fade. `pointer-events-none` on the
 * canvas keeps clicks flowing to the card.
 */
export function GoldDustLayer({ density = 3 }: { density?: number } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Respect users who don't want motion.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      decay: number;
      size: number;
      tint: string;
    };
    const particles: Particle[] = [];
    let raf = 0;
    let hovering = false;

    const resize = () => {
      const r = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const tints = [
      "248,113,113",
      "239,68,68",
      "220,38,38",
      "255,255,255",
      "245,245,245",
    ];

    const spawn = (clientX: number, clientY: number) => {
      const r = parent.getBoundingClientRect();
      const x = (clientX - r.left) * dpr;
      const y = (clientY - r.top) * dpr;
      const n = density;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 1.4 + 0.3) * dpr;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.25 * dpr,
          life: 1,
          decay: 0.012 + Math.random() * 0.018,
          size: (Math.random() * 1.6 + 0.5) * dpr,
          tint: tints[(Math.random() * tints.length) | 0],
        });
      }
      // Cap to avoid runaway memory on very fast moves.
      if (particles.length > 320) particles.splice(0, particles.length - 320);
    };

    const onMove = (e: PointerEvent) => {
      hovering = true;
      spawn(e.clientX, e.clientY);
    };
    const onEnter = (e: PointerEvent) => {
      hovering = true;
      spawn(e.clientX, e.clientY);
    };
    const onLeave = () => {
      hovering = false;
    };

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerenter", onEnter);
    parent.addEventListener("pointerleave", onLeave);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Use additive blending for that gold-dust glow.
      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012 * dpr; // gentle gravity
        p.vx *= 0.985;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = Math.max(0, p.life);
        ctx.fillStyle = `rgba(${p.tint},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, p.size * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // Keep animating briefly after pointer leaves so trailing dust fades.
      if (particles.length || hovering) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const startLoop = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    parent.addEventListener("pointerenter", startLoop);
    parent.addEventListener("pointermove", startLoop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerenter", onEnter);
      parent.removeEventListener("pointerleave", onLeave);
      parent.removeEventListener("pointerenter", startLoop);
      parent.removeEventListener("pointermove", startLoop);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
    />
  );
}

export default GoldDustLayer;
