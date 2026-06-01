import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Trash2, FileDown, Plus, Loader2, Camera, ImageIcon, X, Aperture, RotateCcw } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
// jscanify is dynamically imported in browser-only code paths (SSR-safe)
async function getScanner() {
  const mod: any = await import("jscanify");
  const Ctor = mod.default ?? mod;
  return new Ctor();
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Page = { id: string; src: string; w: number; h: number; name: string };

// OpenCV.js loader (jscanify dependency)
let cvLoadingPromise: Promise<any> | null = null;
function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.cv && w.cv.Mat) return Promise.resolve(w.cv);
  if (cvLoadingPromise) return cvLoadingPromise;
  cvLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-opencv]') as HTMLScriptElement | null;
    const ready = () => {
      const tryReady = () => {
        const cv = (window as any).cv;
        if (cv && cv.Mat) resolve(cv);
        else if (cv && typeof cv.then === "function") cv.then((c: any) => resolve(c));
        else if (cv && cv["onRuntimeInitialized"] !== undefined) {
          cv["onRuntimeInitialized"] = () => resolve(cv);
        } else setTimeout(tryReady, 50);
      };
      tryReady();
    };
    if (existing) {
      ready();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://docs.opencv.org/4.10.0/opencv.js";
    s.async = true;
    s.dataset.opencv = "1";
    s.onload = ready;
    s.onerror = () => reject(new Error("OpenCV.js не успя да се зареди"));
    document.head.appendChild(s);
  });
  return cvLoadingPromise;
}

export function DocScanner() {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Сканиран документ");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => setPickerOpen(true);

  const openFilePicker = () => {
    setPickerOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const openCamera = () => {
    setPickerOpen(false);
    setCameraOpen(true);
  };

  const addProcessed = (src: string, w: number, h: number, label: string) => {
    setPages((p) => [...p, { id: crypto.randomUUID(), src, w, h, name: label }]);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const cv = await loadOpenCv().catch(() => null);
      const scanner = cv ? await getScanner().catch(() => null) : null;
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name}: само снимки`);
          continue;
        }
        const dataUrl = await fileToDataUrl(f);
        const img = await loadImage(dataUrl);
        let outCanvas: HTMLCanvasElement | null = null;
        if (scanner) {
          try {
            outCanvas = scanner.extractPaper(img, img.naturalWidth, img.naturalHeight) as HTMLCanvasElement;
          } catch {
            /* fallback to original */
          }
        }
        const enhanced = enhanceDocument(outCanvas ?? img);
        const outUrl = enhanced.toDataURL("image/jpeg", 0.95);
        const w = enhanced.width;
        const h = enhanced.height;
        addProcessed(outUrl, w, h, f.name);
      }
      toast.success("Документът е обработен");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при обработка");
    } finally {
      setBusy(false);
    }
  };

  const removePage = (id: string) => setPages((p) => p.filter((x) => x.id !== id));

  const downloadPdf = () => {
    if (!pages.length) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pages.forEach((pg, i) => {
      if (i > 0) pdf.addPage();
      const ratio = Math.min(pageW / pg.w, pageH / pg.h);
      const w = pg.w * ratio;
      const h = pg.h * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(pg.src, "JPEG", x, y, w, h, undefined, "FAST");
    });
    pdf.save(`${name || "Документ"}.pdf`);
    toast.success("PDF файлът е изтеглен");
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[rgba(15,3,6,0.85)] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
            <ScanLine className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <div className="font-display text-lg">Скенер на документи</div>
            <div className="text-[11px] text-amber-100/60">Камера или файл → авто изправяне → PDF</div>
          </div>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Име на документа"
          className="w-56 rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1.5 text-sm text-amber-100 placeholder:text-amber-100/40"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pages.map((p, i) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-black/40">
            <img src={p.src} alt={p.name} className="h-40 w-full object-cover" />
            <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              Стр. {i + 1}
            </div>
            <button
              onClick={() => removePage(p.id)}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-rose-300 opacity-0 transition group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddClick}
          className="flex h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 text-amber-100/70 hover:bg-amber-500/10"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
          <span className="text-xs">{busy ? "Обработва…" : "Добави страница"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100/60">
        <span>{pages.length} страници</span>
        <div className="flex gap-2">
          {pages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPages([])} className="border-amber-500/30 text-amber-100 hover:bg-amber-500/10">
              Изчисти
            </Button>
          )}
          <Button onClick={downloadPdf} disabled={!pages.length} className="gold-cta-button">
            <FileDown className="h-4 w-4" /> Свали PDF
          </Button>
        </div>
      </div>

      {/* Source picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="border-amber-500/30 bg-[rgba(15,3,6,0.97)] text-amber-100">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Как да добавим страница?</DialogTitle>
            <DialogDescription className="text-amber-100/60">
              Снимай в реално време с камерата или избери файл от устройството.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={openCamera}
              className="group flex flex-col items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 transition hover:bg-amber-500/20"
            >
              <Camera className="h-10 w-10 text-amber-300 transition group-hover:scale-110" />
              <span className="font-display text-lg">Камера</span>
              <span className="text-[11px] text-amber-100/60 text-center">
                Авто откриване на ръбове и изправяне на перспективата
              </span>
            </button>
            <button
              onClick={openFilePicker}
              className="group flex flex-col items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 transition hover:bg-amber-500/20"
            >
              <ImageIcon className="h-10 w-10 text-amber-300 transition group-hover:scale-110" />
              <span className="font-display text-lg">Файл / Снимка</span>
              <span className="text-[11px] text-amber-100/60 text-center">
                От галерия, лаптоп или телефон. Авто кадриране.
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {cameraOpen && (
        <CameraCapture
          startCount={pages.length}
          onClose={() => setCameraOpen(false)}
          onCapture={(src, w, h, idx) => {
            addProcessed(src, w, h, `Снимка ${idx}.jpg`);
          }}
        />
      )}
    </div>
  );
}

function CameraCapture({
  startCount,
  onClose,
  onCapture,
}: {
  startCount: number;
  onClose: () => void;
  onCapture: (src: string, w: number, h: number, index: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [shooting, setShooting] = useState(false);
  const [shots, setShots] = useState(0);
  const [lastShot, setLastShot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        await loadOpenCv();
        scannerRef.current = await getScanner();
        setStatus("ready");
        startDetectionLoop();
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Няма достъп до камера");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDetectionLoop = () => {
    const tick = () => {
      const video = videoRef.current;
      const canvas = overlayRef.current;
      const scanner = scannerRef.current;
      if (video && canvas && scanner && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, vw, vh);
            ctx.drawImage(video, 0, 0, vw, vh);
            try {
              const highlighted = scanner.highlightPaper(canvas) as HTMLCanvasElement;
              ctx.clearRect(0, 0, vw, vh);
              ctx.drawImage(highlighted, 0, 0);
            } catch {
              /* ignore frame errors */
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const capture = async () => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner) return;
    setShooting(true);
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const tmp = document.createElement("canvas");
      tmp.width = vw;
      tmp.height = vh;
      tmp.getContext("2d")!.drawImage(video, 0, 0, vw, vh);
      let outCanvas: HTMLCanvasElement;
      try {
        outCanvas = scanner.extractPaper(tmp, vw, vh) as HTMLCanvasElement;
      } catch {
        outCanvas = tmp;
      }
      const enhanced = enhanceDocument(outCanvas);
      const dataUrl = enhanced.toDataURL("image/jpeg", 0.95);
      const nextIndex = startCount + shots + 1;
      onCapture(dataUrl, enhanced.width, enhanced.height, nextIndex);
      setShots((s) => s + 1);
      setLastShot(dataUrl);
      toast.success(`Страница ${nextIndex} добавена`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при заснемане");
    } finally {
      setShooting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-amber-100">
        <div className="text-sm font-semibold">Сканиране на документ</div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain opacity-0" />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-contain" />
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-amber-100">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Зарежда камера и AI разпознаване…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-amber-100">
            <Camera className="h-10 w-10 text-rose-400" />
            <div className="font-display text-lg">Няма достъп до камера</div>
            <div className="text-xs text-amber-100/70 max-w-sm">{errorMsg}</div>
            <Button onClick={onClose} variant="outline" className="border-amber-500/30 text-amber-100">
              <RotateCcw className="h-4 w-4" /> Затвори
            </Button>
          </div>
        )}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-col items-center gap-2">
            <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-amber-100">
              Центрирай документа — рамката се закача автоматично
            </div>
            {shots > 0 && (
              <div className="rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-black">
                {shots} {shots === 1 ? "страница заснета" : "страници заснети"}
              </div>
            )}
          </div>
        )}
      </div>
      {status === "ready" && (
        <div className="flex items-center justify-between gap-4 bg-black/85 px-4 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-500/30 bg-black/40 text-[10px] text-amber-100/60">
            {lastShot ? <img src={lastShot} alt="Последна" className="h-full w-full object-cover" /> : "—"}
          </div>
          <button
            onClick={capture}
            disabled={shooting}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-300 bg-amber-500/20 text-amber-100 transition hover:scale-105 disabled:opacity-50"
          >
            {shooting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Aperture className="h-9 w-9" />}
          </button>
          <button
            onClick={onClose}
            className="flex h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-amber-100 hover:bg-amber-500/20"
          >
            <span className="text-xs font-semibold">Готово</span>
            <span className="text-[10px] text-amber-200/70">{shots} стр.</span>
          </button>
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// CamScanner-like enhancement: white-balance + adaptive contrast + sharpening
// Removes shadows from table/surface and makes text crisp & dark on white background.
function enhanceDocument(src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const w = (src as any).width || (src as HTMLImageElement).naturalWidth;
  const h = (src as any).height || (src as HTMLImageElement).naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src as any, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const n = w * h;

  // 1) Compute luminance map
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    lum[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }

  // 2) Estimate background illumination via large box blur (shadow removal)
  const radius = Math.max(15, Math.round(Math.min(w, h) / 25));
  const bg = boxBlur(lum, w, h, radius);

  // 3) Divide image by background -> flat lighting, then boost contrast
  // Find global max of normalized to stretch to white
  const norm = new Float32Array(n);
  let maxN = 0;
  for (let i = 0; i < n; i++) {
    const v = (lum[i] / Math.max(bg[i], 1)) * 255;
    norm[i] = v;
    if (v > maxN) maxN = v;
  }
  const scale = maxN > 0 ? 255 / maxN : 1;

  // Contrast curve: deepen mid-darks, keep paper white
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const ratio = (lum[i] / Math.max(bg[i], 1)); // ~1 for paper
    // White-balance: paper -> white
    let r = (data[j] / Math.max(bg[i], 1)) * 255 * scale;
    let g = (data[j + 1] / Math.max(bg[i], 1)) * 255 * scale;
    let b = (data[j + 2] / Math.max(bg[i], 1)) * 255 * scale;

    // Contrast around 0.85 midpoint, push text darker
    const boost = (v: number) => {
      // Soft S-curve: keeps white white, darkens dark
      const x = v / 255;
      const y = x < 0.5
        ? Math.pow(x * 2, 1.6) / 2
        : 1 - Math.pow((1 - x) * 2, 1.6) / 2;
      return Math.max(0, Math.min(255, y * 255));
    };
    r = boost(r);
    g = boost(g);
    b = boost(b);

    data[j] = r;
    data[j + 1] = g;
    data[j + 2] = b;
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Fast separable box blur on a single-channel Float32Array
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = r * 2 + 1;
  // horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      const addIdx = Math.min(w - 1, x + r + 1);
      const subIdx = Math.max(0, x - r);
      sum += src[row + addIdx] - src[row + subIdx];
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      const addIdx = Math.min(h - 1, y + r + 1);
      const subIdx = Math.max(0, y - r);
      sum += tmp[addIdx * w + x] - tmp[subIdx * w + x];
    }
  }
  return out;
}

