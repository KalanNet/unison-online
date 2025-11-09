// app/api/directory/list-published/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export const runtime = "edge";           // працює на CF Pages Edge
export const dynamic = "force-dynamic";

/* ---------- ENV / CONST ---------- */
const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

const R2_BUCKET = process.env.R2_BUCKET || "unison-catalog";
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
  urlPath: string;            // майбутній роут сайту (клік з редактора)
  file: string;               // публічний URL PDF
  publishedAt: string;        // з першої публікації або останнього meta.json
  updatedAt: string;          // останній апдейт
  version: number;            // лічильник змін
  changes: Array<{ ts: string; action: "title" | "description" | "featured" | "pdf" | "bookmarks" }>;
};

type IndexJson = {
  generatedAt: string;
  items: IndexItem[];
};

const INDEX_KEY = "directory/index.json";

/* ---------- helpers ---------- */
function ok(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code });
}
function err(error: string, code = 400) {
  return NextResponse.json({ error }, { status: code });
}

async function readIndexFromCDN(): Promise<IndexJson | null> {
  try {
    const r = await fetch(`${R2_PUBLIC}/${INDEX_KEY}`, { cache: "no-store" });
    if (!r.ok) return null;
    const json = (await r.json()) as IndexJson;
    if (!json || !Array.isArray(json.items)) return null;
    return json;
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

/** Побудувати початковий index.json, якщо його немає */
async function bootstrapIndexIfMissing(): Promise<IndexJson> {
  const existing = await readIndexFromCDN();
  if (existing) return existing;

  // Скануємо лише верхній рівень підпрефіксів directory/
  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: "directory/",
      Delimiter: "/",
    })
  );

  const prefixes =
    (list.CommonPrefixes || [])
      .map((p) =>
        typeof p.Prefix === "string"
          ? p.Prefix.replace(/^directory\/|\/$/g, "")
          : ""
      )
      .filter(Boolean) || [];

  // Відсіємо фальшиві "https-..." каталоги, та залишимо лише ті, що мають meta.json
  const items: IndexItem[] = [];
  for (const slug of prefixes) {
    if (slug.startsWith("https-")) continue;
    try {
      const r = await fetch(
        `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`,
        { cache: "no-store" }
      );
      if (!r.ok) continue;
      const meta = (await r.json()) as MetaJson;

      const now = new Date().toISOString();
      items.push({
        slug,
        title: (meta?.meta?.title || "").trim(),
        description: (meta?.meta?.description || "").trim(),
        featuredUrl: meta?.meta?.featuredUrl ?? null,
        urlPath: `/directory/${slug}`,
        file: meta?.file || "",
        publishedAt: meta?.publishedAt || now,
        updatedAt: now,
        version: 1,
        changes: [], // початковий імпорт без історії
      });
    } catch {
      /* ignore broken objects */
    }
  }

  const index: IndexJson = {
    generatedAt: new Date().toISOString(),
    items,
  };

  await writeIndexToR2(index);
  return index;
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
        .sort((x, y) =>
          x.page === y.page ? x.label.localeCompare(y.label) : x.page - y.page
        )
    );
  return norm(a) !== norm(b);
}

/* ---------- GET: віддати список URL-ів для поточного редактора (з index.json) ---------- */
export async function GET() {
  try {
    const index = await bootstrapIndexIfMissing();
    // Під поточний UI: віддаємо масив "links" як публічні каталоги у CDN (зворотна сумісність)
    const links = index.items
      .map((it) => `${R2_PUBLIC}/directory/${encodeURIComponent(it.slug)}`)
      .sort((a, b) => a.localeCompare(b));
    return ok({ links, index });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}

/* ---------- POST: upsert запис у directory/index.json та зафіксувати change-log ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      slug?: string;
      meta?: { title?: string; description?: string; featuredUrl?: string | null };
      file?: string;
      publishedAt?: string;
      // опційно — щоб виявити зміни в закладках
      bookmarks?: Array<{ id?: string; page?: number; label?: string; color?: string | null }>;
      // якщо передати "prev" — можна підсилити детекцію змін (не обовʼязково)
      prev?: MetaJson | null;
    };

    const slug = (body.slug || "").trim();
    if (!slug) return err("Missing slug", 422);

    const now = new Date().toISOString();
    const index = (await readIndexFromCDN()) || (await bootstrapIndexIfMissing());

    const current = index.items.find((x) => x.slug === slug);
    const nextTitle = (body.meta?.title || current?.title || "").trim();
    const nextDesc = (body.meta?.description || current?.description || "").trim();
    const nextFeatured =
      typeof body.meta?.featuredUrl === "undefined"
        ? current?.featuredUrl ?? null
        : body.meta?.featuredUrl ?? null;
    const nextFile = (body.file || current?.file || "").trim();
    const publishedAt = body.publishedAt || current?.publishedAt || now;

    const changes: IndexItem["changes"] = [];

    // визначення змін (проти того, що вже в index.json або prev meta)
    if (current) {
      if (current.title !== nextTitle) changes.push({ ts: now, action: "title" });
      if (current.description !== nextDesc) changes.push({ ts: now, action: "description" });
      if ((current.featuredUrl || null) !== (nextFeatured || null))
        changes.push({ ts: now, action: "featured" });
      if (current.file !== nextFile) changes.push({ ts: now, action: "pdf" });

      const prevMeta: MetaJson | null = body.prev || null;
      if (prevMeta) {
        // якщо прийшли попередні метадані — порівняємо з новими (bookmarks у тілі)
        const nextBookmarks = body.bookmarks as MetaJson["bookmarks"];
        if (bookmarksChanged(prevMeta.bookmarks, nextBookmarks))
          changes.push({ ts: now, action: "bookmarks" });
      } else if (body.bookmarks) {
        // якщо немає prev — все одно спробуємо зафіксувати зміни закладок відносно "невідомо"
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
      // новий елемент
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

    // Зворотна сумісність для існуючого UI (видаємо links)
    const links = index.items
      .map((it) => `${R2_PUBLIC}/directory/${encodeURIComponent(it.slug)}`)
      .sort((a, b) => a.localeCompare(b));

    return ok({ ok: true, links, index });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
