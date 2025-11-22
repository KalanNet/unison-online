// app/api/upload-ad/route.ts
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

const ok  = (data: unknown, code = 200) => NextResponse.json(data, { status: code });
const err = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code });

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("image") as File | null;
    const slug = String(form.get("slug") ?? "").trim();
    const label = (form.get("label") as string | null) ?? null;
    const href  = (form.get("href")  as string | null) ?? null;
    // опційно: позиція в каруселі
    const seqRaw = form.get("seq");
    const seq = Number.isFinite(Number(seqRaw)) ? Number(seqRaw) : null;

    if (!file) return err("image is required", 400);
    if (!slug) return err("slug is required", 400);

    // ім’я й ключ у R2
    const now = Date.now();
    const ext = /\.webp$/i.test(file.name) ? ".webp" : ".webp"; // зберігаємо як webp
    const key = `directory/${encodeURIComponent(slug)}/ads/ad-${now}${ext}`;

    // кладемо у R2 (body як Blob/File приймаєтсья SDK)
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: file as unknown as Blob,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));

    // повертаємо шлях — клієнт збере публічний URL через R2_PUBLIC + key
    return ok({
      key,
      urlPath: `/${key}`,         // для складання `${R2_PUBLIC}${urlPath}`
      label,
      href,
      seq,
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
