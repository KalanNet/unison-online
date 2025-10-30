// app/api/upload-featured/route.ts
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

function getExt(nameOrType: string, fallback = ".png") {
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

/** простий safe name:  timestamp + random + ext */
function safeName(origName: string, mime: string) {
  const ext = getExt(origName || mime);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/** опц. підтека, якщо захочеш класти в папку; інакше на корінь бакета */
function joinKey(dir: string | null, fileName: string) {
  const d = (dir || "").trim().replace(/^\/+|\/+$/g, "");
  return d ? `${d}/${fileName}` : fileName;
}

/* ---------- POST ---------- */
export async function POST(req: NextRequest) {
  try {
    // auth за cookie (ідентично до інших роутів)
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader.split(/;\s*/).some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    const form = await req.formData();

    // приймаємо поле "image" (так само дозволимо "file" про всяк)
    const image = (form.get("image") || form.get("file")) as File | null;
    if (!image) return err("Missing image file", 400);
    if (!image.type || !image.type.startsWith("image/")) {
      return err("Only image/* allowed", 415);
    }

    // опційно можна передати "dir" щоб покласти у підтеку
    const dir = (form.get("dir") as string | null) || null;

    const key = joinKey(dir, safeName(image.name || "", image.type));
    const buf = Buffer.from(await image.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buf,
        ContentType: image.type,
        // ACL можна не ставити, якщо бакет public policy
      })
    );

    const url = `${R2_PUBLIC_URL}/${key}`;
    return ok({ url });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
