import { createFileRoute } from "@tanstack/react-router";

import qTsentar from "@/assets/shumen-quarters/tsentar.jpeg.asset.json";
import qTrakiya from "@/assets/shumen-quarters/trakiya.png.asset.json";
import qBoyan1 from "@/assets/shumen-quarters/boyan-1.png.asset.json";
import qBoyan2 from "@/assets/shumen-quarters/boyan-2.png.asset.json";
import qBolnitsata from "@/assets/shumen-quarters/bolnitsata.png.asset.json";
import qHerson from "@/assets/shumen-quarters/herson.png.asset.json";
import qPazara from "@/assets/shumen-quarters/pazara.png.asset.json";
import qDobrudzhanski from "@/assets/shumen-quarters/dobrudzhanski.png.asset.json";
import qPozharnata from "@/assets/shumen-quarters/pozharnata.png.asset.json";
import qVoenno from "@/assets/shumen-quarters/voenno.png.asset.json";

export const Route = createFileRoute("/admin/debug/quarters")({
  component: DebugQuarters,
});

type Row = { name: string; slug: string; asset: typeof qTsentar };

const ROWS: Row[] = [
  { name: "Център",            slug: "tsentar",            asset: qTsentar },
  { name: "Тракия",            slug: "trakiya",            asset: qTrakiya },
  { name: "Боян Българанов 1", slug: "boyan-balgaranov-1", asset: qBoyan1 },
  { name: "Боян Българанов 2", slug: "boyan-balgaranov-2", asset: qBoyan2 },
  { name: "Болницата",         slug: "bolnitsata",         asset: qBolnitsata },
  { name: "Херсон",            slug: "herson",             asset: qHerson },
  { name: "Пазара",            slug: "pazara",             asset: qPazara },
  { name: "Добруджански",      slug: "dobrudzhanski",      asset: qDobrudzhanski },
  { name: "Пожарната",         slug: "pozharnata",         asset: qPozharnata },
  { name: "Военно училище",    slug: "voenno-uchilishte",  asset: qVoenno },
];

function DebugQuarters() {
  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-sans">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Debug: Квартали в Шумен</h1>
      <p className="text-sm text-gray-600 mb-6">
        За всеки квартал: реално изображение, име на файл, asset ID и линк към оригинала.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROWS.map((r) => (
          <div key={r.slug} className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <div className="aspect-square bg-gray-200">
              <img src={r.asset.url} alt={r.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 text-xs space-y-1">
              <div className="text-base font-bold text-black">{r.name}</div>
              <div><span className="text-gray-500">slug:</span> <code>{r.slug}</code></div>
              <div><span className="text-gray-500">файл:</span> <code>{r.asset.original_filename}</code></div>
              <div><span className="text-gray-500">размер:</span> {(r.asset.size / 1024).toFixed(0)} KB</div>
              <div className="truncate"><span className="text-gray-500">asset_id:</span> <code>{r.asset.asset_id}</code></div>
              <a
                href={r.asset.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1 text-blue-600 underline break-all"
              >
                Отвори оригинала ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
