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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://unisonalberta.online";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function ok(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code });
}
function err(error: string, code = 400) {
  return NextResponse.json({ error }, { status: code });
}

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

export async function POST(req: NextRequest) {
  try {
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader
      .split(/;\s*/)
      .some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    const ctype = req.headers.get("content-type") || "";
    let file = "";
    let meta: {
      title?: string;
      description?: string;
      featuredUrl?: string | null;
      slug?: string;
    } = {};
    let bookmarks: Array<{
      id: string;
      page: number;
      label: string;
      color?: string | null;
    }> = [];
    let featuredFile: File | null = null;
    let ads: AdItem[] = [];

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({} as any))) as any;
      file = body?.file || body?.pdfUrl || "";
      meta = body?.meta || {};
      bookmarks = Array.isArray(body?.bookmarks) ? body.bookmarks : [];
      ads = Array.isArray(body?.ads) ? body.ads : [];
    } else if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      file = String(fd.get("file") || fd.get("pdfUrl") || "");
      try {
        meta = fd.get("meta") ? JSON.parse(String(fd.get("meta"))) : {};
      } catch {
        meta = {};
      }
      try {
        bookmarks = fd.get("bookmarks")
          ? JSON.parse(String(fd.get("bookmarks")))
          : [];
      } catch {
        bookmarks = [];
      }
      try {
        ads = fd.get("ads") ? JSON.parse(String(fd.get("ads"))) : [];
      } catch {
        ads = [];
      }
      featuredFile = (fd.get("featured") as File) || null;
    } else {
      return err("Unsupported content-type", 415);
    }

    if (!file) return err("`file` (PDF public URL) is required", 422);

    const rawSlug = (meta?.slug ?? "").toString().trim();
    const titleForSlug = (meta?.title ?? "").toString().trim();
    const finalSlug = slugify(rawSlug || titleForSlug);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) return err("Invalid slug", 422);

    // ВИПРАВЛЕНО: directory -> unison-directory
    const basePrefix = `unison-directory/${finalSlug}`;
    const metaJsonKey = `${basePrefix}/meta.json`;

    let featuredPublicUrl = meta?.featuredUrl || null;
    if (featuredFile) {
      const ext = inferExtFromMime(featuredFile.type);
      const featuredKey = `${basePrefix}/featured${ext}`;
      const arr = await featuredFile.arrayBuffer();
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: featuredKey,
          Body: new Uint8Array(arr),
          ContentType: featuredFile.type || "image/png",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      featuredPublicUrl = `${R2_PUBLIC_URL}/${featuredKey}`;
    }

    const metaPayload: MetaJson = {
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
            label:
              String(b.label || "").trim() ||
              `Page ${Number(b.page || 1)}`,
            color: b.color ?? null,
          }))
        : [],
      ads: Array.isArray(ads)
        ? ads.map((a, i) => {
            const rawUrl =
              (a as any).url ||
              (a as any).imageUrl ||
              "";

            // якщо key не прийшов — пробуємо вирізати з CDN-URL
            let key = (a as any).key || "";
            if (!key && typeof rawUrl === "string" && rawUrl.startsWith(R2_PUBLIC_URL + "/")) {
              key = rawUrl.slice(R2_PUBLIC_URL.length + 1);
            }

            const seqRaw = (a as any).seq;
            const seq =
              Number.isFinite(Number(seqRaw)) ? Number(seqRaw) : i;

            return {
              id: String((a as any).id || `ad-${i}`),
              key: String(key),
              url: String(rawUrl),
              label: (a as any).label ?? null,
              href: (a as any).href ?? null,
              seq,
            };
          })
        : [],
      file,
      publishedAt: new Date().toISOString(),
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: metaJsonKey,
        Body: JSON.stringify(metaPayload, null, 2),
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-cache",
      }),
    );

    /* --- оновити unison-directory/index.json (через виклик list-published API) --- */
    try {
      const origin = new URL(req.url).origin;
      await fetch(`${origin}/api/list-published`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: finalSlug,
          meta: {
            title: metaPayload.meta.title,
            description: metaPayload.meta.description,
            featuredUrl: metaPayload.meta.featuredUrl ?? null,
          },
          file: metaPayload.file,
          publishedAt: metaPayload.publishedAt,
          bookmarks: metaPayload.bookmarks,
        }),
      }).catch(() => null);
    } catch {
      /* не ламаємо публікацію, якщо індекс не оновився */
    }

    return ok({
      ok: true,
      stored: {
        slug: finalSlug,
        metaJsonUrl: `${R2_PUBLIC_URL}/${metaJsonKey}`,
        featuredUrl: featuredPublicUrl,
      },
      urlPath: `/unison-directory/${finalSlug}`,
      publicUrl: `${SITE_URL}/unison-directory/${finalSlug}`,
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}

/* локальні типи */
type AdItem = {
  id?: string;
  key?: string;
  url?: string;
  imageUrl?: string;
  label?: string | null;
  href?: string | null;
  seq?: number | null;
};

type MetaJson = {
  meta: {
    title: string;
    description: string;
    featuredUrl?: string | null;
    slug: string;
  };
  bookmarks?: Array<{
    id: string;
    page: number;
    label: string;
    color?: string | null;
  }>;
  ads?: Array<{
    id: string;
    key: string;
    url: string;
    label: string | null;
    href: string | null;
    seq: number | null;
  }>;
  file: string;
  publishedAt: string;
};