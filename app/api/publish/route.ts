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

function inferExtFromMime(mime?: string | null) {
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
    let file = ""; // PDF public URL (канонічний URL до PDF; можемо вказувати будь-який публічний)
    let meta: { title?: string; description?: string; featuredUrl?: string | null; slug?: string } = {};
    let bookmarks: Array<{ id: string; page: number; label: string; color?: string | null }> = [];
    let featuredFile: File | null = null;

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      file = body?.file || body?.pdfUrl || "";
      meta = body?.meta || {};
      bookmarks = Array.isArray(body?.bookmarks) ? body.bookmarks : [];
      // featuredUrl у JSON-режимі — вже готовий URL (featuredFile не шлемо)
    } else if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      file = String(fd.get("file") || fd.get("pdfUrl") || "");
      try {
        meta = fd.get("meta") ? JSON.parse(String(fd.get("meta"))) : {};
      } catch {
        meta = {};
      }
      try {
        bookmarks = fd.get("bookmarks") ? JSON.parse(String(fd.get("bookmarks"))) : [];
      } catch {
        bookmarks = [];
      }
      featuredFile = (fd.get("featured") as File) || null; // опційно
    } else {
      return err("Unsupported content-type", 415);
    }

    if (!file) return err("`file` (PDF public URL) is required", 422);

    /* --- Сформувати/перевірити slug --- */
    const rawSlug = (meta?.slug ?? "").toString().trim();
    const titleForSlug = (meta?.title ?? "").toString().trim();
    const finalSlug = slugify(rawSlug || titleForSlug);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) return err("Invalid slug", 422);

    /* --- Куди пишемо артефакти --- */
    const basePrefix = `directory/${finalSlug}`;
    const metaJsonKey = `${basePrefix}/meta.json`;

    /* --- Якщо прийшов файл-картинка — заливаємо у directory/<slug>/featured.ext --- */
    let featuredPublicUrl = meta?.featuredUrl || null;
    if (featuredFile) {
      const ext = inferExtFromMime(featuredFile.type);
      const featuredKey = `${basePrefix}/featured${ext}`;
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

    /* --- Готуємо meta.json --- */
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
      file, // канонічний публічний URL PDF (може бути будь-де у CDN)
      publishedAt: new Date().toISOString(),
    };

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
        slug: finalSlug,
        metaJsonUrl: `${R2_PUBLIC_URL}/${metaJsonKey}`,
        featuredUrl: featuredPublicUrl,
      },
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
