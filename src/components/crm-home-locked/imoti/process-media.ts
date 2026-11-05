/**
 * Spec §6 media processing: keep originals; produce public variants.
 * Logo watermark when /crm-home-locked/agency-logo.png exists.
 * Non-exclusive: soft privacy blur (center-upper band heuristic) when exclusive is off.
 */

const LOGO_CANDIDATES = [
  "/crm-home-locked/agency-logo.png",
  "/crm-home-locked/logo.png",
  "/crm-home-locked/locked-logo.png",
];

let cachedLogo: HTMLImageElement | null | undefined;

async function loadLogo(): Promise<HTMLImageElement | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  for (const src of LOGO_CANDIDATES) {
    try {
      const img = await loadImage(src);
      cachedLogo = img;
      return img;
    } catch {
      /* try next */
    }
  }
  cachedLogo = null;
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`fail ${src}`));
    img.src = src;
  });
}

function loadImageFromBlob(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

async function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
  if (!blob) throw new Error("canvas export failed");
  return URL.createObjectURL(blob);
}

/**
 * Soft privacy pass: blur a mid-upper horizontal band (typical exterior windows).
 * Not ML window detection — Spec assumption when vision model is unavailable.
 */
function applySoftWindowBlur(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bandY = Math.floor(h * 0.18);
  const bandH = Math.floor(h * 0.42);
  const slice = ctx.getImageData(0, bandY, w, bandH);
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = bandH;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.putImageData(slice, 0, 0);
  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.drawImage(tmp, 0, bandY, w, bandH);
  ctx.restore();
}

function stampLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  w: number,
  h: number,
) {
  const maxW = Math.max(48, Math.floor(w * 0.14));
  const scale = maxW / logo.width;
  const lw = Math.floor(logo.width * scale);
  const lh = Math.floor(logo.height * scale);
  const pad = Math.max(10, Math.floor(w * 0.02));
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.drawImage(logo, w - lw - pad, h - lh - pad, lw, lh);
  ctx.restore();
}

export async function processPublicImage(
  sourceUrl: string,
  exclusive: boolean,
): Promise<string> {
  try {
    const img = await loadImageFromBlob(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return sourceUrl;
    ctx.drawImage(img, 0, 0);
    if (!exclusive) applySoftWindowBlur(ctx, canvas.width, canvas.height);
    const logo = await loadLogo();
    if (logo) stampLogo(ctx, logo, canvas.width, canvas.height);
    return await canvasToBlobUrl(canvas);
  } catch {
    return sourceUrl;
  }
}

export async function processGalleryForPublish(
  originals: string[],
  exclusive: boolean,
): Promise<string[]> {
  const out: string[] = [];
  for (const src of originals) {
    out.push(await processPublicImage(src, exclusive));
  }
  return out;
}
