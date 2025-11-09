import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

type Bookmark = { id: string; page: number; label: string; color?: string | null };
type MetaJson = {
  meta: { title: string; description: string; slug: string; featuredUrl?: string | null };
  bookmarks?: Bookmark[];
  file: string;
  publishedAt: string;
};

const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (error: string, code = 400) => NextResponse.json({ error }, { status: code });

// GET залишаємо без змін

async function readPrev(slug: string): Promise<MetaJson | null> {
  try {
    const r = await fetch(`${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as MetaJson;
  } catch { return null; }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return err("Missing slug", 422);

  const origin = new URL(req.url).origin;
  const body = (await req.json().catch(() => ({}))) as {
    meta?: { title?: string; description?: string; featuredUrl?: string | null };
    bookmarks?: Bookmark[];
    file?: string;
    publishedAt?: string; // опційно збережемо оригінал
  };

  // 1) підтягуємо попередню версію, щоб нічого не втратити
  const prev = await readPrev(slug);
  if (!prev) return err("Not found", 404);

  // 2) мерджимо все, що прийшло, з тим що вже є
  const next: MetaJson = {
    meta: {
      title: (body.meta?.title ?? prev.meta.title).trim(),
      description: (body.meta?.description ?? prev.meta.description).trim(),
      slug,
      // якщо картинку поміняли — у тілі буде новий URL (інше ім’я файлу => кеш-лейк не заважає)
      featuredUrl: typeof body.meta?.featuredUrl === "undefined" ? (prev.meta.featuredUrl ?? null) : (body.meta?.featuredUrl ?? null),
    },
    // закладки нікуди не зникають: якщо не передали — лишаємо як було
    bookmarks: Array.isArray(body.bookmarks) ? body.bookmarks : (prev.bookmarks ?? []),
    // файл теж можна замінити, інакше — попередній
    file: (body.file ?? prev.file).trim(),
    // зберігаємо первісну дату публікації якщо не передали нову
    publishedAt: body.publishedAt || prev.publishedAt,
  };

  // 3) записуємо оновлений meta.json у R2
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `directory/${encodeURIComponent(slug)}/meta.json`,
    Body: JSON.stringify(next, null, 2),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "no-cache",
  }));

  // 4) синхронізуємо directory/index.json через вже наявний роут
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
      prev, // для change-log у твоєму існуючому коді
    }),
  }).catch(() => null);

  return ok({ ok: true, slug, urlPath: `/directory/${slug}` });
}
