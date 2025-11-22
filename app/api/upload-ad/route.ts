// app/api/upload-ad/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';


/**
 * Приймає multipart/form-data:
 *  - image: File (обов’язково; бажано вже webp ≤200KB)
 *  - slug: string (обов’язково)
 *  - label: string? (опційно)
 *  - href: string? (опційно)
 *  - order: number? (опційно, 0..4)
 *
 * Віддає:
 *  { key: string, urlPath: string, publicUrl?: string, label?: string|null, href?: string|null, order?: number|null }
 *
 * Примітка щодо типів: у середовищі Cloudflare Pages/Workers тип R2Bucket не доступний у TS за замовчуванням,
 * тому свідомо використовуємо `any`, щоб не ламати збірку.
 */
export async function POST(req: Request, ctx: any) {
  const env: any =
    (ctx?.env as any) ??
    (ctx?.platform?.env as any) ??
    (ctx as any) ??
    {};

  // Спробуємо кілька назв биндинга
  const bucket: any = env.R2 || env.R2_BUCKET || env.UNISON_R2;
  if (!bucket || typeof bucket.put !== "function") {
    return new Response(JSON.stringify({ error: "R2 binding missing" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Парсимо форму
  const form = await req.formData();

  const file = form.get("image") as File | null;
  const slug = String(form.get("slug") ?? "").trim();
  const label = (form.get("label") as string | null)?.trim() || null;
  const href = (form.get("href") as string | null)?.trim() || null;

  // order (0..4); якщо не число — null
  const orderRaw = form.get("order");
  const order =
    typeof orderRaw === "string" && orderRaw.trim() !== "" && !Number.isNaN(+orderRaw)
      ? Math.max(0, Math.min(4, Math.floor(+orderRaw)))
      : null;

  if (!file) {
    return new Response(JSON.stringify({ error: "image is required" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (!slug) {
    return new Response(JSON.stringify({ error: "slug is required" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Кладемо у R2 як webp (можна й інші формати — збережемо як на вході)
  const now = Date.now();
  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const ext = /\.webp$/i.test(file.name) ? "webp" : (file.type.split("/")[1] || "webp");
  const key = `directory/${safeSlug}/ads/ad-${now}.${ext}`;

  const arrBuf = await file.arrayBuffer();
  await bucket.put(key, arrBuf, {
    httpMetadata: { contentType: file.type || "image/webp" },
  });

  // Побудова публічної URL-ки (аналогічно /api/upload-featured)
  const base =
    (typeof process !== "undefined" && (process.env as any)?.NEXT_PUBLIC_SITE_URL) ||
    (typeof location !== "undefined" && (location as any).origin) ||
    "";

  const body = {
    key,
    urlPath: `/${key}`,
    publicUrl: base ? `${base}/${key}` : undefined,
    label,
    href,
    order,
  };

  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
