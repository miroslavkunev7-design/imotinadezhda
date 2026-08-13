import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, Sparkles } from "lucide-react";
import { scanClientFromImage } from "@/lib/crm-scan.functions";
import { toast } from "sonner";

type ScanResult = {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  client_type?: string | null;
  search_property_type?: string | null;
  search_status?: string | null;
  rooms_min?: number | null;
  rooms_max?: number | null;
  area_min?: number | null;
  area_max?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  city?: string | null;
  quarter?: string | null;
  deal_stage?: string | null;
  notes?: string | null;
  raw_text?: string;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function ClientScanModal({
  open,
  onClose,
  onExtracted,
  cities,
  quarters,
}: {
  open: boolean;
  onClose: () => void;
  onExtracted: (prefill: any) => void;
  cities: { id: string; name: string }[];
  quarters: { id: string; name: string; city_id: string }[];
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Моля, избери снимка (image/*).");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await scanClientFromImage({
        data: { imageBase64: base64, mimeType: file.type },
      });
      const r = res.data as ScanResult;

      // Map city/quarter names to ids
      const cityMatch = r.city
        ? cities.find((c) => c.name.toLowerCase() === r.city!.toLowerCase().trim())
        : null;
      const quarterMatch = r.quarter
        ? quarters.find(
            (q) =>
              q.name.toLowerCase() === r.quarter!.toLowerCase().trim() &&
              (!cityMatch || q.city_id === cityMatch.id),
          )
        : null;

      const prefill = {
        full_name: r.full_name ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        client_type: r.client_type ?? "buyer",
        status: "active",
        search_property_type: r.search_property_type ?? null,
        search_status: r.search_status ?? null,
        rooms_min: r.rooms_min ?? null,
        rooms_max: r.rooms_max ?? null,
        area_min: r.area_min ?? null,
        area_max: r.area_max ?? null,
        budget_min: r.budget_min ?? null,
        budget_max: r.budget_max ?? null,
        currency: r.currency ?? "EUR",
        search_city_id: cityMatch?.id ?? null,
        search_quarter_id: quarterMatch?.id ?? null,
        deal_stage: r.deal_stage ?? null,
        notes: [r.notes, r.raw_text ? `\n— Сканиран текст —\n${r.raw_text}` : ""].filter(Boolean).join(""),
      };

      toast.success("Информацията е разпозната. Прегледай и запази.");
      onExtracted(prefill);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при разпознаване");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="font-display text-xl text-accent-foreground">Сканирай клиент</h2>
          </div>
          <button onClick={onClose} aria-label="Затвори"><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Снимай страница от тетрадка, визитка или печатен документ. AI ще извлече име, телефон,
          какво търси клиентът и ще попълни формата автоматично.
        </p>

        {preview && (
          <div className="mb-4 overflow-hidden rounded-xl border">
            <img src={preview} alt="Сканирано" className="max-h-64 w-full object-contain bg-muted" />
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            className="gold-cta-button h-12"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Снимай
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="h-12"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Качи снимка
          </Button>
        </div>

        {busy && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            AI анализира снимката…
          </p>
        )}
      </div>
    </div>
  );
}
