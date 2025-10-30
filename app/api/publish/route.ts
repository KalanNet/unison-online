// app/api/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";

/* ---------- R2 config ---------- */
const R2_BUCKET = "unison-catalog";
const R2_PUBLIC_URL = "https://cdn.unisonalberta.online";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/* ---------- helpers ---------- */
function ok(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code });
}
function err(error: string, code = 400) {
  return NextResponse.json({ error }, { status: code });
}

/** З URL PDF отримує шлях у бакеті й теку, куди класти meta.json / featured.* */
function extractDirFromPdfUrl(pdfUrl: string) {
  if (!pdfUrl.startsWith(R2_PUBLIC_URL + "/")) return null;
  const key = pdfUrl.slice(R2_PUBLIC_URL.length + 1);
  if (!key || !key.includes("/")) return null;
  const lastSlash = key.lastIndexOf("/");
  const dir = key.slice(0, lastSlash);
  return { key, dir };
}

/** Нормалізація слагу: латиниця/цифри/- ; пробіли→- ; злиття дефісів; трим країв. */
function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\s+/g, "-")           // пробіли → дефіси
    .replace(/[^a-z0-9-]/g, "")     // прибрати все, крім лат/цифр/-
    .replace(/-+/g, "-")            // звести повторні дефіси
    .replace(/^-+|-+$/g, "");       // обрізати дефіси по краях
  return base || `item-${Date.now()}`;
}

function inferExtFromMime(mime: string | undefined | null) {
  if (!mime) return ".png";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".png";
}

/* ---------- POST ---------- */
export async function POST(req: NextRequest) {
  try {
    /* --- Auth by cookie (як у тебе) --- */
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader.split(/;\s*/).some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    /* --- Parse body: JSON або multipart/form-data --- */
    const ctype = req.headers.get("content-type") || "";
    let file = ""; // PDF public URL
    let meta: { title?: string; description?: string; featuredUrl?: string | null; slug?: string } = {};
    let bookmarks: Array<{ id: string; page: number; label: string; color?: string | null }> = [];
    let featuredFile: File | null = null;

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      file = body?.file || body?.pdfUrl || "";
      meta = body?.meta || {};
      bookmarks = Array.isArray(body?.bookmarks) ? body.bookmarks : [];
    } else if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      file = String(fd.get("file") || fd.get("pdfUrl") || "");
      const metaRaw = fd.get("meta");
      try {
        meta = metaRaw ? JSON.parse(String(metaRaw)) : {};
      } catch { meta = {}; }
      const bmkRaw = fd.get("bookmarks");
      try {
        bookmarks = bmkRaw ? JSON.parse(String(bmkRaw)) : [];
      } catch { bookmarks = []; }
      featuredFile = (fd.get("featured") as File) || null;
    } else {
      return err("Unsupported content-type", 415);
    }

    if (!file) return err("`file` (PDF public URL) is required", 422);

    const parsed = extractDirFromPdfUrl(file);
    if (!parsed) return err("Invalid `file` URL (must be within CDN origin)", 422);
    const { dir } = parsed;

    /* --- Сформувати/перевірити slug --- */
    const rawSlug = (meta?.slug ?? "").toString().trim();
    const titleForSlug = (meta?.title ?? "").toString().trim();
    const finalSlug = slugify(rawSlug || titleForSlug);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) return err("Invalid slug", 422);

    /* --- Якщо надіслали featured як файл — заливаємо в R2 і записуємо URL у meta --- */
    let featuredPublicUrl = meta?.featuredUrl || null;

    if (featuredFile) {
      const ext = inferExtFromMime(featuredFile.type);
      const featuredKey = `${dir}/featured${ext}`;
      const arr = await featuredFile.arrayBuffer();
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: featuredKey,
          Body: Buffer.from(arr),
          ContentType: featuredFile.type || "image/png",
        })
      );
      featuredPublicUrl = `${R2_PUBLIC_URL}/${featuredKey}`;
    }

    /* --- Зібрати payload метаданих --- */
    const metaJsonKey = `${dir}/meta.json`;
    const metaPayload = {
      meta: {
        title: (meta?.title || "").trim(),
        description: (meta?.description || "").trim(),
        featuredUrl: featuredPublicUrl ?? null,
        slug: finalSlug, // <-- ДОДАНО
      },
      bookmarks: Array.isArray(bookmarks)
        ? bookmarks.map(b => ({
            id: String(b.id || ""),
            page: Number(b.page || 1),
            label: String(b.label || "").trim() || `Page ${Number(b.page || 1)}`,
            color: b.color ?? null, // <-- ДОДАНО
          }))
        : [],
      file, // PDF public URL
    };

    /* --- Записати meta.json у R2 --- */
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: metaJsonKey,
        Body: JSON.stringify(metaPayload, null, 2),
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-cache",
      })
    );

    /* --- Відповідь --- */
    return ok({
      ok: true,
      stored: {
        metaJsonUrl: `${R2_PUBLIC_URL}/${metaJsonKey}`,
        featuredUrl: featuredPublicUrl,
        slug: finalSlug,
      },
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
