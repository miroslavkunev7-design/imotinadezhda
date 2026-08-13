/** Клиентска обработка на снимки от камера/галерия преди изпращане към AI:
 *  намаляване на размера, авто-контраст и леко изостряне, за да се чете текст. */

const MAX_SIDE = 2000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Изображението не може да се прочете")); };
    img.src = url;
  });
}

/** Авто-контраст (нормализация на хистограмата) + лека гама корекция. */
function autoContrast(data: Uint8ClampedArray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    hist[l]++;
  }
  const total = data.length / 4;
  const clip = total * 0.01;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > clip) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > clip) { hi = i; break; } }
  if (hi - lo < 20) return;
  const scale = 255 / (hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const v = Math.min(255, Math.max(0, (i - lo) * scale));
    lut[i] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(v / 255, 0.92))));
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

export type EnhancedImage = { dataUrl: string; width: number; height: number };

/** Връща обработен JPEG data URL. Ако нещо се обърка — хвърля грешка. */
export async function enhanceDocumentImage(file: File): Promise<EnhancedImage> {
  const img = await loadImage(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas не е достъпен");
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const frame = ctx.getImageData(0, 0, w, h);
    autoContrast(frame.data);
    ctx.putImageData(frame, 0, 0);
  } catch {
    /* при cross-origin ограничение оставяме оригинала */
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: w, height: h };
}

/** Чете произволен файл като data URL (за PDF и др.). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Файлът не може да се прочете"));
    reader.readAsDataURL(file);
  });
}
