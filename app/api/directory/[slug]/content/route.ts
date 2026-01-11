// app/api/directory/[slug]/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- R2 config ---------- */
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
type TocItem = { id: string; label: string; page: number; isSection?: boolean };

/* ---------- Helpers ---------- */
const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (error: string, code = 400) => NextResponse.json({ error }, { status: code });

// ВИПРАВЛЕНО: directory -> unison-directory
function keyOf(slug: string) {
  return `unison-directory/${encodeURIComponent(slug)}/content.json`;
}

async function readPrevContent(slug: string): Promise<TocItem[] | null> {
  try {
    const r = await fetch(`${R2_PUBLIC}/${keyOf(slug)}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as TocItem[];
  } catch {
    return null;
  }
}

function sanitizeContent(input: unknown): TocItem[] {
  const src = Array.isArray(input)
    ? input
    : (typeof input === "object" && input && Array.isArray((input as any).items))
      ? (input as any).items
      : [];

  const out: TocItem[] = [];
  for (const it of src) {
    if (!it || typeof it !== "object") continue;
    const any = it as any;
    const id = String(any.id ?? crypto.randomUUID()).trim();
    const label = String(any.label ?? "").trim();
    const pageRaw = Number(any.page);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1;
    const isSection = Boolean(any.isSection);
    if (id && label) out.push({ id, label, page, isSection });
  }

  out.sort((a, b) => (a.page - b.page) || a.label.localeCompare(b.label));
  return out;
}

/* ---------- GET ---------- */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  if (!slug) return err("Missing slug", 422);

  try {
    const url = `${R2_PUBLIC}/${keyOf(slug)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return err("Not found", 404);

    const data = await r.json().catch(() => []);
    return ok(sanitizeContent(data), 200);
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}

/* ---------- POST ---------- */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  if (!slug) return err("Missing slug", 422);

  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const prev = (await readPrevContent(slug)) ?? [];

    const items =
      body === null || typeof body === "undefined"
        ? prev
        : sanitizeContent(body);

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: keyOf(slug),
      Body: new TextEncoder().encode(JSON.stringify(items, null, 2)),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache",
    }));

    return ok({ ok: true, slug, saved: items.length, path: `/${keyOf(slug)}` }, 200);
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}