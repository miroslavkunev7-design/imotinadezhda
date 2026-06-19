import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

/** Deferred hero video: poster first, metadata preload, fade-in when ready. */
export function AutoPlayVideo(
  props: VideoHTMLAttributes<HTMLVideoElement> & {
    src?: string;
    fallbackSrc?: string;
    onPermanentError?: () => void;
  },
) {
  const { src, fallbackSrc, onPermanentError, onError, poster, className, style, preload: _ignoredPreload, ...videoProps } =
    props;
  const ref = useRef<HTMLVideoElement | null>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const [mountVideo, setMountVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setVideoReady(false);
  }, [src]);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const schedule = (cb: () => void) => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      if (typeof ric === "function") return ric(() => !cancelled && cb(), { timeout: 200 });
      return window.setTimeout(() => !cancelled && cb(), 0);
    };
    const raf = requestAnimationFrame(() => schedule(() => setMountVideo(true)));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  useEffect(() => {
    if (!mountVideo) return;
    const el = ref.current;
    if (!el || !activeSrc) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          const resume = () => {
            el.play().catch(() => {});
            window.removeEventListener("touchstart", resume);
            window.removeEventListener("click", resume);
          };
          window.addEventListener("touchstart", resume, { once: true, passive: true });
          window.addEventListener("click", resume, { once: true });
        });
      }
    };
    if (el.readyState >= 2) tryPlay();
    else el.addEventListener("loadeddata", tryPlay, { once: true });
  }, [activeSrc, mountVideo]);

  const handleError: VideoHTMLAttributes<HTMLVideoElement>["onError"] = (event) => {
    onError?.(event);
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      return;
    }
    onPermanentError?.();
  };

  return (
    <div className={className} style={style}>
      {poster ? (
        <img
          src={typeof poster === "string" ? poster : undefined}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
      ) : null}
      {mountVideo && activeSrc ? (
        <video
          key={activeSrc}
          ref={ref}
          {...videoProps}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={typeof poster === "string" ? poster : undefined}
          src={activeSrc}
          onError={handleError}
          onLoadedData={() => setVideoReady(true)}
          onEnded={(e) => {
            const v = e.currentTarget;
            try {
              v.currentTime = 0;
              void v.play();
            } catch {
              /* ignore */
            }
          }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: videoReady ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
