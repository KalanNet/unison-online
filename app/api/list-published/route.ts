// app/api/list-published/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- ENV (CDN для зчитування/запису index.json) ---------- */
const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";
const R2_BUCKET = process.env.R2_BUCKET || "unison-catalog";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

/* ---------- SITE base (для публічних посилань у відповіді API) ---------- */
const ENV_SITE_BASE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/g, "");

function siteBaseFromReq(req: NextRequest) {
  // Якщо в env заданий явний базовий URL — використовуємо його (dev/prod/sw).
  // Інакше — беремо origin поточного запиту.
  return ENV_SITE_BASE || req.nextUrl.origin;
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

type MetaJson = {
  meta: { title: string; description: string; featuredUrl?: string | null; slug: string };
  bookmarks?: Array<{ id: string; page: number; label: string; color?: string | null }>;
  file: string;
  publishedAt: string;
};

type IndexItem = {
  slug: string;
  title: string;
  description: string;
  featuredUrl: string | null;
  urlPath: string; // наприклад: "/directory/<slug>"
  file: string;
  publishedAt: string;
  updatedAt: string;
  version: number;
  changes: Array<{ ts: string; action: "title" | "description" | "featured" | "pdf" | "bookmarks" }>;
};

type IndexJson = { generatedAt: string; items: IndexItem[] };

const INDEX_KEY = "directory/index.json";

/* ---------- helpers ---------- */
const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (error: string, code = 400) => NextResponse.json({ error }, { status: code });

async function readIndexFromCDN(): Promise<IndexJson | null> {
  try {
    const r = await fetch(`${R2_PUBLIC}/${INDEX_KEY}`, { cache: "no-store" });
    if (!r.ok) return null;
    const json = (await r.json()) as IndexJson;
    return Array.isArray(json?.items) ? json : null;
  } catch {
    return null;
  }
}

async function writeIndexToR2(index: IndexJson) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: INDEX_KEY,
      Body: JSON.stringify(index, null, 2),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache",
    })
  );
}

async function ensureIndex(): Promise<IndexJson> {
  const got = await readIndexFromCDN();
  if (got) return got;
  const fresh: IndexJson = { generatedAt: new Date().toISOString(), items: [] };
  await writeIndexToR2(fresh);
  return fresh;
}

function bookmarksChanged(
  a: MetaJson["bookmarks"] | undefined,
  b: MetaJson["bookmarks"] | undefined
) {
  const norm = (arr?: MetaJson["bookmarks"]) =>
    JSON.stringify(
      (arr || [])
        .map((x) => ({
          page: Number(x.page) || 1,
          label: String(x.label || ""),
          color: x.color || null,
        }))
        .sort((x, y) => (x.page === y.page ? x.label.localeCompare(y.label) : x.page - y.page))
    );
  return norm(a) !== norm(b);
}

function buildLinks(index: IndexJson, base: string) {
  const b = base.replace(/\/+$/g, "");
  return index.items
    .map((it) => `${b}${it.urlPath || `/directory/${encodeURIComponent(it.slug)}`}`)
    .sort((a, c) => a.localeCompare(c));
}

/* ---------- GET: повертаємо links на домені сайту (а не CDN) ---------- */
export async function GET(req: NextRequest) {
  try {
    const index = await ensureIndex();
    const links = buildLinks(index, siteBaseFromReq(req));
    return ok({ links, index });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}

/* ---------- POST: upsert запис і change-log ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      slug?: string;
      meta?: { title?: string; description?: string; featuredUrl?: string | null };
      file?: string;
      publishedAt?: string;
      bookmarks?: Array<{ id?: string; page?: number; label?: string; color?: string | null }>;
      prev?: MetaJson | null;
    };

    const slug = (body.slug || "").trim();
    if (!slug) return err("Missing slug", 422);

    const now = new Date().toISOString();
    const index = await ensureIndex();

    const current = index.items.find((x) => x.slug === slug);
    const nextTitle = (body.meta?.title || current?.title || "").trim();
    const nextDesc = (body.meta?.description || current?.description || "").trim();
    const nextFeatured =
      typeof body.meta?.featuredUrl === "undefined" ? current?.featuredUrl ?? null : body.meta?.featuredUrl ?? null;
    const nextFile = (body.file || current?.file || "").trim();
    const publishedAt = body.publishedAt || current?.publishedAt || now;

    const changes: IndexItem["changes"] = [];

    if (current) {
      if (current.title !== nextTitle) changes.push({ ts: now, action: "title" });
      if (current.description !== nextDesc) changes.push({ ts: now, action: "description" });
      if ((current.featuredUrl || null) !== (nextFeatured || null)) changes.push({ ts: now, action: "featured" });
      if (current.file !== nextFile) changes.push({ ts: now, action: "pdf" });

      const prevMeta: MetaJson | null = body.prev || null;
      if (prevMeta) {
        const nextBookmarks = body.bookmarks as MetaJson["bookmarks"];
        if (bookmarksChanged(prevMeta.bookmarks, nextBookmarks))
          changes.push({ ts: now, action: "bookmarks" });
      } else if (body.bookmarks) {
        changes.push({ ts: now, action: "bookmarks" });
      }

      current.title = nextTitle;
      current.description = nextDesc;
      current.featuredUrl = nextFeatured ?? null;
      current.file = nextFile;
      current.updatedAt = now;
      current.version = (current.version || 1) + (changes.length ? 1 : 0);
      current.changes = [...(current.changes || []), ...changes];
    } else {
      index.items.push({
        slug,
        title: nextTitle,
        description: nextDesc,
        featuredUrl: nextFeatured ?? null,
        urlPath: `/directory/${slug}`,
        file: nextFile,
        publishedAt,
        updatedAt: now,
        version: 1,
        changes: [],
      });
    }

    index.generatedAt = now;
    await writeIndexToR2(index);

    const links = buildLinks(index, siteBaseFromReq(req));
    return ok({ ok: true, links, index });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
