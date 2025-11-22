import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";

/* R2 config */
const R2_BUCKET = "unison-catalog";
const R2_PUBLIC_URL = "https://cdn.unisonalberta.online";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (error: string, code = 400) => NextResponse.json({ error }, { status: code });

function getExt(nameOrType: string, fallback = ".webp") {
  const fromName = nameOrType.includes(".")
    ? "." + nameOrType.split(".").pop()!.toLowerCase()
    : "";
  if (fromName) return fromName;
  const t = nameOrType.toLowerCase();
  if (t.includes("png")) return ".png";
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  if (t.includes("webp")) return ".webp";
  if (t.includes("gif")) return ".gif";
  return fallback;
}
function safeName(prefix = "ad", nameOrMime = ".webp") {
  const ext = getExt(nameOrMime, ".webp");
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}
function joinKey(dir: string | null, fileName: string) {
  const d = (dir || "").trim().replace(/^\/+|\/+$/g, "");
  return d ? `${d}/${fileName}` : fileName;
}

export async function POST(req: NextRequest) {
  try {
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader.split(/;\s*/).some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    const form = await req.formData();
    const image = (form.get("image") || form.get("file")) as File | null;
    if (!image) return err("Missing image file", 400);
    if (!image.type || !image.type.startsWith("image/")) return err("Only image/* allowed", 415);

    const slug = (form.get("slug") as string | null)?.trim();
    if (!slug) return err("Missing slug", 422);

    const rawLabel = (form.get("label") as string) ?? "";
    const rawHref  = (form.get("href") as string) ?? "";
    const rawSeq   = form.get("seq");

    const label = rawLabel.trim() || null;
    const href  = rawHref.trim()  || null;
    const seq   = (rawSeq != null && !Number.isNaN(+rawSeq))
      ? Math.max(0, Math.min(4, Math.trunc(+rawSeq)))
      : null;

    const dir = `directory/${encodeURIComponent(slug)}/ads`;
    const key = joinKey(dir, safeName("ad", image.name || image.type));

    const arr = await image.arrayBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: new Uint8Array(arr),
      ContentType: image.type || "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));

    const url = `${R2_PUBLIC_URL}/${key}`;
    return ok({ url, key, label, href, seq });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
