// app/lib/imageWebp.ts

type PrepOpts = {
  maxBytes?: number;   // цільовий верхній ліміт (байт)
  maxWidth?: number;   // максимальна ширина
  minWidth?: number;   // нижня межа, щоб не стискати до абсурду
  qualities?: number[]; // градації якості WebP
};

/**
 * Головна функція:
 * - пропускає WEBP ≤ 200 KB і width ≤ 1080 без змін
 * - інакше конвертує до WEBP ≤ 200 KB з maxWidth = 1080 та фіксованими пропорціями
 */
export async function prepareWebP200k(
  file: File,
  opts: PrepOpts = {}
): Promise<File> {
  const {
    maxBytes = 200 * 1024, // 200 KB
    maxWidth = 1080,
    minWidth = 320,
    qualities = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25]
  } = opts;

  const isWebP = /image\/webp/i.test(file.type) || /\.webp$/i.test(file.name);

  // Завантажуємо зображення, щоб знати фактичну ширину
  const src = await loadBitmapOrImage(file);
  const origWidth = getSourceWidth(src);
  const origHeight = getSourceHeight(src);

  // ----- PASS-THROUGH: якщо це вже оптимальний WebP -----
  if (isWebP && file.size <= maxBytes && origWidth <= maxWidth) {
    return file;
  }

  // Базова цільова ширина
  let targetWidth = Math.min(origWidth, maxWidth);

  let bestBlob: Blob | null = null;
  let bestName = file.name.replace(/\.\w+$/, ".webp");

  // Зменшуємо ширину ступенями, поки не впишемося у maxBytes або не дійдемо до minWidth
  while (targetWidth >= Math.min(minWidth, maxWidth)) {
    const { canvas, ctx } = makeCanvasMaintainingAR(src, targetWidth, origWidth, origHeight);
    // Перебираємо якості від кращої до нижчої
    for (const q of qualities) {
      const blob = await toBlobAsync(canvas, "image/webp", q);
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;

      if (blob.size <= maxBytes) {
        return new File([blob], bestName, { type: "image/webp" });
      }
    }
    // Не влізли — ще зменшимо ширину на 10%
    targetWidth = Math.floor(targetWidth * 0.9);
  }

  // Якщо так і не досягли 200 KB — повертаємо найменший з отриманих
  if (bestBlob) {
    return new File([bestBlob], bestName, { type: "image/webp" });
  }
  throw new Error("Cannot encode image to WebP.");
}

/* ----------------- helpers ----------------- */

function getSourceWidth(src: CanvasImageSource): number {
  // ImageBitmap | HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement
  // @ts-ignore
  return src.width;
}
function getSourceHeight(src: CanvasImageSource): number {
  // @ts-ignore
  return src.height;
}

async function loadBitmapOrImage(file: File): Promise<CanvasImageSource> {
  try {
    // створюємо ImageBitmap, якщо можливо (швидше)
    // @ts-ignore
    if (typeof createImageBitmap === "function") {
      // @ts-ignore
      return await createImageBitmap(file);
    }
  } catch { /* fallback нижче */ }

  // Фолбек: HTMLImageElement
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return img as unknown as CanvasImageSource;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = (e) => rej(e);
    img.decoding = "async";
    img.src = src;
  });
}

function makeCanvasMaintainingAR(
  src: CanvasImageSource,
  targetWidth: number,
  origWidth: number,
  origHeight: number
) {
  const ratio = origHeight / origWidth;
  const cw = Math.max(1, Math.floor(targetWidth));
  const ch = Math.max(1, Math.floor(targetWidth * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cw, ch);
  return { canvas, ctx };
}

function toBlobAsync(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality);
  });
}
