// app/api/list-published/route.ts
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const runtime = "node"; // <-- увімкни Node!
export const dynamic = "force-dynamic";

export async function GET() {
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
  const R2_BUCKET = process.env.R2_BUCKET!;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;

  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return new Response(JSON.stringify({ links: [], error: "Missing R2 env" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });

  try {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: "directory/",
      Delimiter: "/"
    }));

    // ПЕРЕВІРКА щоб уникнути undefined
    const slugs = (result.CommonPrefixes || [])
      .map(p => typeof p.Prefix === "string" ? p.Prefix.replace(/^directory\/|\/$/g, "") : "")
      .filter(Boolean);

    const links = slugs.map(s => `/directory/${s}`);

    return new Response(JSON.stringify({ links }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ links: [], error: String(e?.message || e) }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
}
