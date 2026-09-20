/**
 * „Направи React“: генерира готов React + TypeScript + Tailwind компонент
 * от поставен елемент (форма + вложено съдържание).
 *
 * Нищо не се пренарисува — генерираният компонент използва същата снимка/маска
 * и същите пропорции. Кодът е чист React, без външни зависимости.
 */
import { SHAPES_BY_ID } from "@/lib/crm-shapes";
import type { BlockChild, CustomBlock } from "@/lib/crm-page-settings/types";

function pascal(name: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z]/.test(base) ? base : `Shape${base || "Block"}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const jsxText = (s: string) => s.replace(/[{}]/g, (m) => `{"${m}"}`);

function childCode(c: BlockChild): string {
  const color = c.color ? ` style={{ color: "${c.color}" }}` : "";
  switch (c.type) {
    case "heading":
      return `      <h3 className="text-xl font-bold"${color}>${jsxText(c.text ?? "")}</h3>`;
    case "button":
      return `      <a href="${c.href ?? "#"}" className="inline-flex items-center justify-center rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-[#8B1A2B]">${jsxText(c.text ?? "Бутон")}</a>`;
    case "image":
      return `      <img src="${c.url ?? ""}" alt="${(c.text ?? "").replace(/"/g, "'")}" className="max-h-24 w-auto object-contain" loading="lazy" />`;
    case "text":
    default:
      return `      <p className="text-sm leading-relaxed"${color}>${jsxText(c.text ?? "")}</p>`;
  }
}

export function blockToReact(block: CustomBlock, componentName = "ShapeBlock"): string {
  const shape = block.shapeId ? SHAPES_BY_ID[block.shapeId] : undefined;
  const name = pascal(componentName);
  const fill = block.fill ?? "#8B1A2B";
  const keepImage = !!block.keepImage && !!shape?.imageUrl;

  const styleLines: string[] = [];
  if (shape?.borderRadius) styleLines.push(`  borderRadius: "${shape.borderRadius}",`);
  if (shape?.clipPath) styleLines.push(`  clipPath: "${shape.clipPath}",`);
  if (shape?.maskImage) {
    styleLines.push("  WebkitMaskImage: `url(${MASK})`,");
    styleLines.push("  maskImage: `url(${MASK})`,");
    styleLines.push('  WebkitMaskSize: "100% 100%",');
    styleLines.push('  maskSize: "100% 100%",');
    styleLines.push('  WebkitMaskRepeat: "no-repeat",');
    styleLines.push('  maskRepeat: "no-repeat",');
  }
  if (!keepImage) styleLines.push(`  backgroundColor: "${fill}",`);

  const assets: string[] = [];
  if (shape?.maskImage) assets.push(`const MASK = \`${esc(shape.maskImage)}\`;`);
  if (keepImage) assets.push(`const IMAGE = \`${esc(shape.imageUrl!)}\`;`);

  const children = (block.children ?? []).map(childCode).join("\n");

  return `/**
 * ${name} — генериран от CRM „Направи React“.
 * Същата форма, същата снимка и същите пропорции. Без външни зависимости.
 */
${assets.join("\n")}${assets.length ? "\n\n" : ""}const SHAPE_STYLE: React.CSSProperties = {
${styleLines.join("\n")}
};

export function ${name}({ className }: { className?: string }) {
  return (
    <div
      className={["relative overflow-hidden", className].filter(Boolean).join(" ")}
      style={{ ...SHAPE_STYLE, aspectRatio: "${(block.w ?? 40).toFixed(0)} / ${Math.max(1, Math.round((block.h ?? 240) / 6))}" }}
    >
${keepImage ? `      <img src={IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />\n` : ""}      <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-white">
${children}
      </div>
    </div>
  );
}

export default ${name};
`;
}

/** Свалящ файл в браузъра, без сървър. */
export function downloadTsx(fileName: string, code: string) {
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName.endsWith(".tsx") ? fileName : `${fileName}.tsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
