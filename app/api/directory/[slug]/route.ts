// app/api/directory/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- R2 config (як у upload-featured) ---------- */
const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";
const R2_BUCKET = process.env.R2_BUCKET || "unison-catalog";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

export type AdSlot = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
  order?: number; // 0..4, зліва направо
};

type MetaJson = {
  meta: { title: string; description: string; slug: string; featuredUrl?: string | null };
  bookmarks?: Bookmark[];
  ads?: AdSlot[];
  file: string;
  publishedAt: string;
};

/* ---------- Helpers ---------- */
const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (error: string, code = 400) => NextResponse.json({ error }, { status: code });

async function readPrev(slug: string): Promise<MetaJson | null> {
  try {
    const r = await fetch(`${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as MetaJson;
  } catch { return null; }
}

function sanitizeBookmarks(input: unknown): Bookmark[] {
  if (!Array.isArray(input)) return [];
  const out: Bookmark[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const any = it as Record<string, unknown>;
    const id = String(any.id ?? crypto.randomUUID());
    const pageNum = Number(any.page);
    const page = Number.isFinite(pageNum) ? Math.max(1, pageNum) : 1;
    const label = String(any.label ?? "").trim();
    const color = typeof any.color === "string" && any.color.trim() ? any.color : null;
    if (label) out.push({ id, page, label, color });
  }
  return out;
}

function sanitizeAds(input: unknown): AdSlot[] {
  if (!Array.isArray(input)) return [];
  const cleaned: AdSlot[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const any = it as Record<string, unknown>;
    const imageUrl = String(any.imageUrl ?? "").trim();
    if (!imageUrl) continue;
    const id = String(any.id ?? crypto.randomUUID());
    const href = typeof any.href === "string" && any.href.trim() ? any.href.trim() : null;
    const label = typeof any.label === "string" && any.label.trim() ? any.label.trim() : null;
    let order: number | undefined = undefined;
    if (typeof any.order === "number" && Number.isFinite(any.order)) {
      order = Math.max(0, Math.min(4, Math.trunc(any.order)));
    }
    cleaned.push({ id, imageUrl, href, label, order });
  }

  // нормалізуємо порядок: 0..4 у межах перших 5 елементів
  const top5 = cleaned
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 5)
    .map((a, i) => ({ ...a, order: i }));

  return top5;
}

/* ---------- GET ---------- */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  if (!slug) return err("Missing slug", 422);

  try {
    const url = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return err("Not found", 404);
    const j = await r.json();
    return ok(j, 200);
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}

/* ---------- POST (Publish) ---------- */
/**
 * Очікує JSON тіло:
 * {
 *   meta?: { title?, description?, featuredUrl? },
 *   bookmarks?: Bookmark[],
 *   ads?: AdSlot[],            // <-- НОВЕ
 *   file?: string,
 *   publishedAt?: string
 * }
 *
 * Якщо якесь поле не передано — лишається попереднє значення з meta.json.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return err("Missing slug", 422);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      meta?: { title?: string; description?: string; featuredUrl?: string | null };
      bookmarks?: Bookmark[];
      ads?: AdSlot[];
      file?: string;
      publishedAt?: string;
    };

    // 1) підтягнути попередню версію
    const prev = await readPrev(slug);
    if (!prev) return err("Not found", 404);

    // 2) санітаризації
    const nextBookmarks =
      typeof body.bookmarks === "undefined" ? (prev.bookmarks ?? []) : sanitizeBookmarks(body.bookmarks);
    const nextAds =
      typeof body.ads === "undefined" ? (prev.ads ?? []) : sanitizeAds(body.ads);

    // 3) зібрати next-мету
    const next: MetaJson = {
      meta: {
        title: (body.meta?.title ?? prev.meta.title).trim(),
        description: (body.meta?.description ?? prev.meta.description).trim(),
        slug,
        featuredUrl:
          typeof body.meta?.featuredUrl === "undefined"
            ? (prev.meta.featuredUrl ?? null)
            : (body.meta?.featuredUrl ?? null),
      },
      bookmarks: nextBookmarks,
      ads: nextAds,
      file: (body.file ?? prev.file).trim(),
      publishedAt: body.publishedAt || prev.publishedAt,
    };

    // 4) запис у R2
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `directory/${encodeURIComponent(slug)}/meta.json`,
      Body: new TextEncoder().encode(JSON.stringify(next, null, 2)),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache",
    }));

    // 5) підштовхнути оновлення індексу (як і раніше)
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/directory/list-published`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        meta: {
          title: next.meta.title,
          description: next.meta.description,
          featuredUrl: next.meta.featuredUrl ?? null,
        },
        file: next.file,
        publishedAt: next.publishedAt,
        bookmarks: next.bookmarks,
        ads: next.ads, // для інфо
        prev,
      }),
    }).catch(() => null);

    return ok({ ok: true, slug, urlPath: `/directory/${slug}`, meta: next });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
