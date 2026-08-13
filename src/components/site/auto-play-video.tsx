import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { shouldPlayHeroVideo } from "@/lib/device-perf";

/** Deferred hero video: poster first, metadata preload, fade-in when ready. */
export function AutoPlayVideo(
  props: VideoHTMLAttributes<HTMLVideoElement> & {
    src?: string;
    fallbackSrc?: string;
    onPermanentError?: () => void;
    /** How the video/poster fills the container. Default: "cover". */
    objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
    /** Focal point for cropping. Default: "center". */
    objectPosition?: string;
  },
) {
  const {
    src,
    fallbackSrc,
    onPermanentError,
    onError,
    poster,
    className,
    style,
    objectFit = "cover",
    objectPosition = "center",
    preload: _ignoredPreload,
    ...videoProps
  } = props;
  const ref = useRef<HTMLVideoElement | null>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const [mountVideo, setMountVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [allowVideo, setAllowVideo] = useState(true);
  const [focalPosition, setFocalPosition] = useState(objectPosition);

  useEffect(() => {
    setFocalPosition(objectPosition);
  }, [objectPosition]);

  // Adaptive quality: on weak devices / slow connections / reduced-motion,
  // never mount the <video> — the poster stays as the hero.
  useEffect(() => {
    setAllowVideo(shouldPlayHeroVideo());
  }, []);

  useEffect(() => {
    setActiveSrc(src);
    setVideoReady(false);
  }, [src]);

  useEffect(() => {
    if (!src || !allowVideo) return;
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
  }, [src, allowVideo]);

  useEffect(() => {
    if (!mountVideo) return;
    const el = ref.current;
    if (!el || !activeSrc) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    try {
      (el as unknown as { disablePictureInPicture: boolean }).disablePictureInPicture = true;
      (el as unknown as { disableRemotePlayback: boolean }).disableRemotePlayback = true;
    } catch {
      /* ignore */
    }
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
    if (el.readyState >= 3) tryPlay();
    else el.addEventListener("canplay", tryPlay, { once: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) el.play().catch(() => {});
          else el.pause();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    const onVisibility = () => {
      if (document.hidden) el.pause();
      else el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("canplay", tryPlay);
    };
  }, [activeSrc, mountVideo]);

  const handleError: VideoHTMLAttributes<HTMLVideoElement>["onError"] = (event) => {
    onError?.(event);
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      return;
    }
    onPermanentError?.();
  };

  const mediaFit: React.CSSProperties = {
    objectFit,
    objectPosition: focalPosition,
    width: "100%",
    height: "100%",
    display: "block",
  };

  return (
    <div className={className} style={style}>
      {poster ? (
        <img
          src={typeof poster === "string" ? poster : undefined}
          alt=""
          aria-hidden
          className="absolute inset-0"
          style={mediaFit}
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
          onCanPlay={() => setVideoReady(true)}
          onLoadedMetadata={(e) => {
            // Adapt focal point when a portrait source lands in a landscape
            // container (or vice-versa) to avoid awkward crops.
            const v = e.currentTarget;
            const host = v.parentElement;
            if (!host || !v.videoWidth || !v.videoHeight) return;
            const vAR = v.videoWidth / v.videoHeight;
            const cAR = host.clientWidth / Math.max(host.clientHeight, 1);
            if (objectPosition !== "center") return; // caller overrides
            if (vAR < 1 && cAR > 1.2) setFocalPosition("center 35%");
            else if (vAR > 1 && cAR < 0.8) setFocalPosition("50% center");
            else setFocalPosition("center");
          }}
          onEnded={(e) => {
            const v = e.currentTarget;
            try {
              v.currentTime = 0;
              void v.play();
            } catch {
              /* ignore */
            }
          }}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ ...mediaFit, opacity: videoReady ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
