// app/api/upload-ad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";

/* ---------- R2 (S3) config — аналогічно upload-featured ---------- */
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

/* ---------- helpers (ідентичний стиль до upload-featured) ---------- */
function ok(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code });
}
function err(error: string, code = 400) {
  return NextResponse.json({ error }, { status: code });
}

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
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}${ext}`;
}

function joinKey(dir: string | null, fileName: string) {
  const d = (dir || "").trim().replace(/^\/+|\/+$/g, "");
  return d ? `${d}/${fileName}` : fileName;
}

/* ---------- POST ---------- */
export async function POST(req: NextRequest) {
  try {
    // Та ж сама cookie-auth, що й у upload-featured
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader
      .split(/;\s*/)
      .some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    const form = await req.formData();

    // файл
    const image = (form.get("image") || form.get("file")) as File | null;
    if (!image) return err("Missing image file", 400);
    if (!image.type || !image.type.startsWith("image/")) {
      return err("Only image/* allowed", 415);
    }

    // обов'язково потрібен slug
    const slug = (form.get("slug") as string | null)?.trim();
    if (!slug) return err("Missing slug", 422);

    // додаткові мета-поля (повернемо у відповіді, щоб ви оновили meta.json так само, як для featuredUrl)
    const label = ((form.get("label") as string) || "").trim() || null;
    const href =
      (((form.get("href") as string) || "").trim() as string) || null;
    const seqRaw = form.get("seq");
    const seq =
      typeof seqRaw === "string" && seqRaw.trim() !== "" && !isNaN(+seqRaw)
        ? Number(seqRaw)
        : null;

    // шлях: directory/<slug>/ads/<ім'я>
    const dir = `directory/${encodeURIComponent(slug)}/ads`;
    const key = joinKey(dir, safeName("ad", image.name || image.type));

    // запис у R2
    const arr = await image.arrayBuffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: new Uint8Array(arr), // Edge-safe
        ContentType: image.type || "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const url = `${R2_PUBLIC_URL}/${key}`;

    // Повертаємо url + мета — далі ваш існуючий код оновлює meta.json (ads[])
    return ok({ url, key, label, href, seq });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
