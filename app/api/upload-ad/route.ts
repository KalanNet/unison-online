// app/api/upload-ad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const slug = (form.get("slug") as string | null) || "ads";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const ext = ".webp"; // після prepareAdImage повинно бути webp
    const nameSafe = file.name.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
    const ts = Date.now();
    const objectKey = `directory/${slug}/ads/${ts}-${nameSafe}${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Body: new Uint8Array(arrayBuffer),
        ContentType: "image/webp",
        ACL: "public-read",
      })
    );

    const url = `${R2_PUBLIC_URL}/${objectKey}`;
    return NextResponse.json({ url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
