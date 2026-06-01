import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Trash2, FileDown, Plus, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

type Page = { id: string; src: string; w: number; h: number; name: string };

export function DocScanner() {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Сканиран документ");

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next: Page[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name}: само снимки`);
          continue;
        }
        const dataUrl = await fileToDataUrl(f);
        const dims = await imageDims(dataUrl);
        next.push({ id: crypto.randomUUID(), src: dataUrl, w: dims.w, h: dims.h, name: f.name });
      }
      setPages((p) => [...p, ...next]);
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
            <div className="text-[11px] text-amber-100/60">Качи снимки → генерирай PDF</div>
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
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 text-amber-100/70 hover:bg-amber-500/10">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
          <span className="text-xs">{busy ? "Зарежда…" : "Добави снимки"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
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

function imageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = rej;
    img.src = src;
  });
}
