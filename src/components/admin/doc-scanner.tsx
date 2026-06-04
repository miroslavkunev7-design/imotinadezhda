import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Trash2, FileDown, Plus, Loader2, Camera, ImageIcon, X, Aperture, RotateCcw, Merge, Send, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContactGroups, listContacts } from "@/lib/contacts.functions";
// jscanify is dynamically imported in browser-only code paths (SSR-safe)
async function getScanner() {
  const mod: any = await import("jscanify/client");
  const Ctor = mod.default ?? mod;
  return new Ctor();
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type Page = { id: string; src: string; w: number; h: number; name: string };

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
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [autoExport, setAutoExport] = useState(true); // авто-PDF след затваряне на камерата
  const [sendOpen, setSendOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => setPickerOpen(true);

  const openFilePicker = () => {
    setPickerOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const openCamera = () => {
    setPickerOpen(false);
    setCameraOpen(true);
  };

  const addProcessed = (src: string, w: number, h: number, label: string): string => {
    const id = crypto.randomUUID();
    setPages((p) => [...p, { id, src, w, h, name: label }]);
    return id;
  };

  // Run heavy OpenCV+jscanify enhancement in the background — UI stays responsive.
  const enhancePageInBackground = async (pageId: string, sourceUrl: string) => {
    try {
      await new Promise((r) => setTimeout(r, 50));
      const cv = await loadOpenCv().catch(() => null);
      const scanner = cv ? await getScanner().catch(() => null) : null;
      const img = await loadImage(sourceUrl);
      let outCanvas: HTMLCanvasElement | null = null;
      if (scanner) {
        try {
          outCanvas = scanner.extractPaper(img, img.naturalWidth, img.naturalHeight) as HTMLCanvasElement;
        } catch { /* fallback */ }
      }
      await new Promise((r) => setTimeout(r, 0));
      const enhanced = enhanceDocument(outCanvas ?? img);
      const outUrl = enhanced.toDataURL("image/jpeg", 0.9);
      setPages((p) => p.map((x) => x.id === pageId ? { ...x, src: outUrl, w: enhanced.width, h: enhanced.height } : x));
    } catch {
      /* keep original on failure */
    }
  };

  // Downscale very large images to keep file size & rendering snappy.
  const normalizeImage = async (file: File): Promise<{ url: string; w: number; h: number }> => {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const MAX = 1800;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    if (scale === 1) return { url: dataUrl, w, h };
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return { url: c.toDataURL("image/jpeg", 0.9), w, h };
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name}: само снимки`);
          continue;
        }
        const { url, w, h } = await normalizeImage(f);
        const id = addProcessed(url, w, h, f.name);
        if (autoEnhance) void enhancePageInBackground(id, url);
        await new Promise((r) => setTimeout(r, 0));
      }
      toast.success(autoEnhance ? "Добавено — подобряваме във фон" : "Добавено");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при обработка");
    } finally {
      setBusy(false);
    }
  };

  const enhancePage = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    toast.info("Подобряваме страницата…");
    void enhancePageInBackground(id, page.src);
  };

  const removePage = (id: string) => setPages((p) => p.filter((x) => x.id !== id));

  // Изгражда PDF от текущите страници и връща (blob, filename) — без сваляне.
  const buildPdfBlob = (): { blob: Blob; filename: string } | null => {
    if (!pages.length) return null;
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
    const filename = `${(name || "Документ").replace(/[\\/:*?"<>|]+/g, "_")}.pdf`;
    return { blob: pdf.output("blob"), filename };
  };

  const downloadPdf = () => {
    const built = buildPdfBlob();
    if (!built) return;
    triggerDownload(built.blob, built.filename);
    toast.success("PDF файлът е изтеглен");
  };

  // Merge външни PDF файлове в един — без да пипа текущите сканирани страници.
  const mergeExternalPdfs = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length < 2) {
      toast.error("Избери поне 2 PDF файла за обединяване");
      return;
    }
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const f of Array.from(files)) {
        const bytes = await f.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save();
      triggerDownload(new Blob([out], { type: "application/pdf" }), "merged.pdf");
      toast.success("PDF файловете са обединени");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка при обединяване");
    } finally {
      setBusy(false);
    }
  };

  // Споделяне (Web Share API на телефони – истинско прикачване на PDF);
  // ако не се поддържа – сваля PDF и отваря mailto с попълнени получатели.
  const sendToRecipients = async (emails: string[]) => {
    const built = buildPdfBlob();
    if (!built) {
      toast.error("Няма страници за изпращане");
      return;
    }
    const file = new File([built.blob], built.filename, { type: "application/pdf" });
    const subject = `${name || "Документ"} — от Имоти Надежда`;
    const body = `Здравейте,\n\nИзпращаме Ви прикачения документ "${name || "Документ"}".\n\nПоздрави,\nИмоти Надежда`;
    const navAny = navigator as unknown as { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
    if (emails.length && navAny.canShare && navAny.canShare({ files: [file] })) {
      try {
        await navAny.share!({ files: [file], title: subject, text: `${body}\n\nДо: ${emails.join(", ")}` });
        return;
      } catch { /* user cancelled or share failed — продължи с mailto */ }
    }
    triggerDownload(built.blob, built.filename);
    const to = emails.join(",");
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Моля, прикачи свалния PDF файл към имейла.)")}`;
    window.location.href = url;
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255, 255, 255,0.85)] p-5 shadow-[0_18px_45px_rgba(139, 26, 43,0.35)]">
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
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-[#8B1A2B]/40">
            <img src={p.src} alt={p.name} className="h-40 w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute left-2 top-2 rounded bg-[#8B1A2B]/65 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              Стр. {i + 1}
            </div>
            <button
              onClick={() => enhancePage(p.id)}
              title="Подобри качеството"
              className="absolute right-10 top-2 rounded-full bg-[#8B1A2B]/65 p-1.5 text-amber-200 opacity-0 transition group-hover:opacity-100 hover:bg-amber-500/30"
            >
              <ScanLine className="h-4 w-4" />
            </button>
            <button
              onClick={() => removePage(p.id)}
              className="absolute right-2 top-2 rounded-full bg-[#8B1A2B]/65 p-1.5 text-rose-300 opacity-0 transition group-hover:opacity-100"
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
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoEnhance} onChange={(e) => setAutoEnhance(e.target.checked)} className="accent-amber-400" />
          <span>Авто-подобряване (по-бавно)</span>
          <span className="text-amber-100/40">· {pages.length} стр.</span>
        </label>
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
        <DialogContent className="border-amber-500/30 bg-[rgba(255, 255, 255,0.97)] text-amber-100">
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
        // Camera is ready IMMEDIATELY — no wait for OpenCV
        setStatus("ready");
        startDetectionLoop();
        // Lazy-load scanner in background for the edge-highlight overlay
        loadOpenCv()
          .then(() => getScanner())
          .then((s) => { if (!cancelled) scannerRef.current = s; })
          .catch(() => { /* overlay simply stays off */ });
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
    // Live видеото се показва директно през <video> елемента.
    // Тук пускаме САМО детекция на ръбовете върху downscale-нат кадър,
    // максимум ~3 пъти в секунда, и пропускаме кадри докато тече обработка.
    // Иначе OpenCV на 60fps × 1920×1080 замразява мобилния браузър.
    let processing = false;
    let lastRun = 0;
    const MIN_INTERVAL = 320; // ms (≈3 fps)
    const MAX_DIM = 640;      // px за работен canvas

    const tick = () => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const scanner = scannerRef.current;
      const now = performance.now();
      const due = now - lastRun >= MIN_INTERVAL;

      if (!processing && due && video && overlay && scanner && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          processing = true;
          lastRun = now;
          const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
          const sw = Math.max(1, Math.round(vw * scale));
          const sh = Math.max(1, Math.round(vh * scale));
          const work = document.createElement("canvas");
          work.width = sw; work.height = sh;
          const wctx = work.getContext("2d");
          if (wctx) {
            wctx.drawImage(video, 0, 0, sw, sh);
            // Изпълни в отделен microtask — не блокирай rAF
            Promise.resolve().then(() => {
              try {
                const highlighted = scanner.highlightPaper(work) as HTMLCanvasElement;
                if (overlay.width !== sw || overlay.height !== sh) {
                  overlay.width = sw; overlay.height = sh;
                }
                const octx = overlay.getContext("2d");
                if (octx) {
                  octx.clearRect(0, 0, sw, sh);
                  octx.drawImage(highlighted, 0, 0);
                }
              } catch { /* пропусни кадъра */ }
              finally { processing = false; }
            });
          } else {
            processing = false;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    setShooting(true);
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const tmp = document.createElement("canvas");
      tmp.width = vw;
      tmp.height = vh;
      tmp.getContext("2d")!.drawImage(video, 0, 0, vw, vh);
      // Capture is INSTANT — no enhancement in the gesture handler
      const dataUrl = tmp.toDataURL("image/jpeg", 0.9);
      const nextIndex = startCount + shots + 1;
      onCapture(dataUrl, tmp.width, tmp.height, nextIndex);
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#8B1A2B]">
      <div className="flex items-center justify-between p-3 text-amber-100">
        <div className="text-sm font-semibold">Сканиране на документ</div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-contain" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-70 mix-blend-screen" />
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
            <div className="rounded-full bg-[#8B1A2B]/55 px-3 py-1 text-[11px] text-amber-100">
              Центрирай документа — рамката се закача автоматично
            </div>
            {shots > 0 && (
              <div className="rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-[#4A4A4A]">
                {shots} {shots === 1 ? "страница заснета" : "страници заснети"}
              </div>
            )}
          </div>
        )}
      </div>
      {status === "ready" && (
        <div className="flex items-center justify-between gap-4 bg-[#8B1A2B]/85 px-4 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-500/30 bg-[#8B1A2B]/40 text-[10px] text-amber-100/60">
            {lastShot ? <img src={lastShot} alt="Последна" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : "—"}
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

