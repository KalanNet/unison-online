// app/lib/imageWebp.ts

/**
 * Утиліта підготовки зображення до WEBP ≤ 200 KB і ширини ≤ 1080 px.
 * Логіка:
 *  - Якщо це вже WEBP і він ≤ maxBytes та width ≤ maxWidth — повертаємо як є.
 *  - Інакше масштабуємо (зберігаючи пропорції) та кодуємо у WEBP,
 *    підбираючи якість; якщо не вміщається — зменшуємо ширину та повторюємо.
 */

export type PrepOpts = {
  /** Цільовий верхній ліміт розміру, байт (за замовчуванням 200 KB) */
  maxBytes?: number;
  /** Максимальна ширина в пікселях (за замовчуванням 1080) */
  maxWidth?: number;
  /** Нижня межа ширини, щоб не стискати до абсурду (за замовчуванням 320) */
  minWidth?: number;
  /**
   * Діапазон якості для бінарного пошуку (0..1).
   * Висока = верхня межа, низька = нижня межа.
   * За замовчуванням [0.95, 0.3].
   */
  qualityRange?: [number, number];
  /** Максимальна кількість ітерацій бінарного пошуку якості (за замовчуванням 8) */
  qualitySteps?: number;
  /** Крок зменшення ширини, якщо не влізли в розмір (за замовчуванням 0.9 = мінус 10%) */
  widthStep?: number;
};

export async function prepareWebP200k(
  file: File,
  opts: PrepOpts = {}
): Promise<File> {
  const {
    maxBytes = 200 * 1024,
    maxWidth = 1080,
    minWidth = 320,
    qualityRange = [0.95, 0.3],
    qualitySteps = 8,
    widthStep = 0.9,
  } = opts;

  const isWebP = isWebpFile(file);

  // Завантажуємо графіку (ImageBitmap або HTMLImageElement)
  const src = await loadBitmapOrImage(file);
  const origWidth = getSourceWidth(src);
  const origHeight = getSourceHeight(src);

  // PASS-THROUGH: вже оптимальний WEBP
  if (isWebP && file.size <= maxBytes && origWidth <= maxWidth) {
    return file;
  }

  // Початкова цільова ширина
  let targetWidth = Math.min(origWidth, maxWidth);
  const name = ensureWebpExt(file.name);

  let bestBlob: Blob | null = null;

  // Зменшуємо ширину, доки не впишемося або не дійдемо до мінімуму
  while (targetWidth >= Math.min(minWidth, maxWidth)) {
    const { canvas } = makeCanvasMaintainingAR(src, targetWidth, origWidth, origHeight);

    // Бінарно підбираємо якість у діапазоні [hi..lo]
    const blob = await encodeToWebpUnderLimit(canvas, maxBytes, qualityRange, qualitySteps);

    // Запам'ятовуємо найменший результат, навіть якщо > maxBytes
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;

    // Якщо влізли — завершуємо
    if (blob.size <= maxBytes) {
      closeImageBitmapIfNeeded(src);
      return new File([blob], name, { type: "image/webp" });
    }

    // Не влізли — зменшуємо ширину і пробуємо знову
    targetWidth = Math.floor(targetWidth * widthStep);
  }

  // Якщо так і не досягли ліміту — віддаємо найменший з отриманих
  if (bestBlob) {
    closeImageBitmapIfNeeded(src);
    return new File([bestBlob], name, { type: "image/webp" });
  }

  closeImageBitmapIfNeeded(src);
  throw new Error("Cannot encode image to WebP.");
}

/* ----------------- helpers ----------------- */

function isWebpFile(file: File): boolean {
  return /image\/webp/i.test(file.type) || /\.webp$/i.test(file.name);
}

function ensureWebpExt(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, ".webp");
}

function getSourceWidth(src: CanvasImageSource): number {
  // ImageBitmap | HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement
  // @ts-ignore
  return src.width ?? 0;
}

function getSourceHeight(src: CanvasImageSource): number {
  // @ts-ignore
  return src.height ?? 0;
}

async function loadBitmapOrImage(file: File): Promise<CanvasImageSource> {
  // Перевага — ImageBitmap (швидше та економніша пам'ять)
  try {
    // @ts-ignore
    if (typeof createImageBitmap === "function") {
      // @ts-ignore
      const bmp = await createImageBitmap(file);
      if (bmp && getSourceWidth(bmp) && getSourceHeight(bmp)) return bmp as CanvasImageSource;
    }
  } catch {
    // fall through
  }

  // Фолбек — HTMLImageElement
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
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

function makeCanvasMaintainingAR(
  src: CanvasImageSource,
  targetWidth: number,
  origWidth: number,
  origHeight: number
) {
  const ratio = origHeight / Math.max(1, origWidth);
  const cw = Math.max(1, Math.floor(targetWidth));
  const ch = Math.max(1, Math.floor(targetWidth * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2D context not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // @ts-ignore - drawImage приймає CanvasImageSource
  ctx.drawImage(src, 0, 0, cw, ch);

  return { canvas, ctx };
}

/**
 * Кодує canvas у WEBP, підбираючи якість бінарним пошуком у межах qualityRange.
 * Повертає Blob навіть якщо він більший за maxBytes (найкращий знайдений на фінальному кроці).
 */
async function encodeToWebpUnderLimit(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  qualityRange: [number, number],
  steps: number
): Promise<Blob> {
  let [hi, lo] = qualityRange; // hi >= lo
  hi = clamp(hi, 0, 1);
  lo = clamp(lo, 0, 1);
  if (hi < lo) [hi, lo] = [lo, hi];

  // Стартуємо з високої якості — це зазвичай один із найкращих результатів
  let best: Blob = await toBlobAsync(canvas, "image/webp", hi);

  // Якщо одразу влізли — повертаємо
  if (best.size <= maxBytes) return best;

  // Далі — бінарний пошук якості
  let left = lo, right = hi;
  for (let i = 0; i < steps; i++) {
    const mid = (left + right) / 2;
    const blob = await toBlobAsync(canvas, "image/webp", mid);

    // Оновлюємо "найкращий" як найменший знайдений
    if (blob.size < best.size) best = blob;

    if (blob.size > maxBytes) {
      // Все ще завеликий — знижуємо якість
      right = mid;
    } else {
      // Влізли — пробуємо трохи підвищити якість (щоб не втрачати забагато)
      left = mid;
      // Так як влізли — це валідний кандидат, зберігаємо його
      best = blob;
    }

    // Дрібна оптимізація: якщо розмір дуже близько до ліміту (±1%), вважаємо успіхом
    if (Math.abs(best.size - maxBytes) / maxBytes < 0.01) break;
  }

  return best;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function toBlobAsync(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => {
    const done = (b: Blob | null) => (b ? res(b) : rej(new Error("toBlob failed")));
    // Деякі браузери ігнорують якість поза [0..1]
    const q = typeof quality === "number" ? clamp(quality, 0, 1) : undefined;
    canvas.toBlob(done, type, q);
  });
}

function closeImageBitmapIfNeeded(src: CanvasImageSource) {
  // Закриваємо ImageBitmap, якщо використовувався (звільняємо пам'ять)
  // @ts-ignore
  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) {
    // @ts-ignore
    try { src.close?.(); } catch { /* ignore */ }
  }
}
