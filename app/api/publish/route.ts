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

/** З URL PDF отримує ключ у бакеті, теку (може бути порожня) і базове ім'я без розширення. */
function extractFromPdfUrl(pdfUrl: string) {
  if (!pdfUrl.startsWith(R2_PUBLIC_URL + "/")) return null;
  const key = pdfUrl.slice(R2_PUBLIC_URL.length + 1); // "file.pdf" або "dir/file.pdf"
  if (!key) return null;

  const lastSlash = key.lastIndexOf("/");
  const dir = lastSlash >= 0 ? key.slice(0, lastSlash) : ""; // "" якщо на корені
  const fileName = lastSlash >= 0 ? key.slice(lastSlash + 1) : key; // "file.pdf"
  const dot = fileName.lastIndexOf(".");
  const baseNoExt = dot >= 0 ? fileName.slice(0, dot) : fileName; // "file"

  return { key, dir, baseNoExt };
}

/** Нормалізація slug: латиниця/цифри/- ; пробіли→- ; злиття дефісів; обрізання країв. */
function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${Date.now()}`;
}

function inferExtFromMime(mime: string | undefined | null) {
  if (!mime) return ".png";
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return ".png";
}

/* ---------- POST ---------- */
export async function POST(req: NextRequest) {
  try {
    /* --- Auth by cookie --- */
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
      // у JSON режимі очікуємо готовий URL у meta.featuredUrl (featuredFile не передаємо)
    } else if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      file = String(fd.get("file") || fd.get("pdfUrl") || "");
      const metaRaw = fd.get("meta");
      try {
        meta = metaRaw ? JSON.parse(String(metaRaw)) : {};
      } catch {
        meta = {};
      }
      const bmkRaw = fd.get("bookmarks");
      try {
        bookmarks = bmkRaw ? JSON.parse(String(bmkRaw)) : [];
      } catch {
        bookmarks = [];
      }
      featuredFile = (fd.get("featured") as File) || null; // файл картинки (не обов'язково)
    } else {
      return err("Unsupported content-type", 415);
    }

    if (!file) return err("`file` (PDF public URL) is required", 422);

    const parsed = extractFromPdfUrl(file);
    if (!parsed) return err("Invalid `file` URL (must be within CDN origin)", 422);
    const { dir, baseNoExt } = parsed;

    /* --- Сформувати/перевірити slug --- */
    const rawSlug = (meta?.slug ?? "").toString().trim();
    const titleForSlug = (meta?.title ?? "").toString().trim();
    const finalSlug = slugify(rawSlug || titleForSlug);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) return err("Invalid slug", 422);

    /* --- Якщо надіслали featured як файл — заливаємо в R2 і підставляємо URL --- */
    let featuredPublicUrl = meta?.featuredUrl || null;

    if (featuredFile) {
      const ext = inferExtFromMime(featuredFile.type);
      const featuredKey = dir ? `${dir}/featured${ext}` : `${baseNoExt}.featured${ext}`;
      const arr = await featuredFile.arrayBuffer();
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: featuredKey,
          Body: new Uint8Array(arr), // Edge-safe
          ContentType: featuredFile.type || "image/png",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      featuredPublicUrl = `${R2_PUBLIC_URL}/${featuredKey}`;
    }

    /* --- meta.json поруч із PDF: у теці або з префіксом імені файлу на корені --- */
    const metaJsonKey = dir ? `${dir}/meta.json` : `${baseNoExt}.meta.json`;

    const metaPayload = {
      meta: {
        title: (meta?.title || "").trim(),
        description: (meta?.description || "").trim(),
        featuredUrl: featuredPublicUrl ?? null,
        slug: finalSlug,
      },
      bookmarks: Array.isArray(bookmarks)
        ? bookmarks.map((b) => ({
            id: String(b.id || ""),
            page: Number.isFinite(Number(b.page)) ? Number(b.page) : 1,
            label: String(b.label || "").trim() || `Page ${Number(b.page || 1)}`,
            color: b.color ?? null,
          }))
        : [],
      file, // PDF public URL
      publishedAt: new Date().toISOString(),
    };

    // Записуємо meta.json (основний артефакт)
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: metaJsonKey,
        Body: JSON.stringify(metaPayload, null, 2),
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-cache",
      })
    );

    /* ---------- АЛІАСИ ДЛЯ ПУБЛІЧНОЇ СТОРІНКИ /catalog/[slug] ---------- */
    // ① легкий покажчик -> посилання на справжній meta.json
    const aliasKey = `_catalog/slug/${finalSlug}.json`;
    const aliasBody = JSON.stringify({ href: `${R2_PUBLIC_URL}/${metaJsonKey}` }, null, 2);
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: aliasKey,
        Body: aliasBody,
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-cache",
      })
    );

    // ② (необов’язково) повний дубль мета-даних — зручно як кеш або фолбек
    const aliasFullKey = `_catalog/slug/${finalSlug}.full.json`;
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: aliasFullKey,
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
        aliasUrl: `${R2_PUBLIC_URL}/${aliasKey}`,
        aliasFullUrl: `${R2_PUBLIC_URL}/${aliasFullKey}`,
      },
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
