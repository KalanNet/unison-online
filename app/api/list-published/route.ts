// app/api/list-published/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

type Env = {
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
};

const te = new TextEncoder();
const enc = (s: string) => te.encode(s);

function getEnv(): Env {
  // Edge Runtime: process.env доступний без globalThis
  const e = process.env;
  return {
    R2_ACCOUNT_ID: e.R2_ACCOUNT_ID!,
    R2_BUCKET: e.R2_BUCKET!,
    R2_ACCESS_KEY_ID: e.R2_ACCESS_KEY_ID!,
    R2_SECRET_ACCESS_KEY: e.R2_SECRET_ACCESS_KEY!,
  };
}

const toAB = (v: ArrayBuffer | ArrayBufferView): ArrayBuffer =>
  v instanceof ArrayBuffer ? v : v.buffer as ArrayBuffer;

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

async function hmac(keyData: ArrayBuffer | ArrayBufferView, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    toAB(keyData),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, toAB(enc(data)));
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", enc(s));
  return hex(d);
}

export async function GET() {
  try {
    const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = getEnv();
    if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return new Response(JSON.stringify({ links: [], error: "Missing R2 env" }), {
        status: 500, headers: { "content-type": "application/json" }
      });
    }

    const service = "s3";
    const region = "auto";
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const path = `/${encodeURIComponent(R2_BUCKET)}`;

    const q = new URLSearchParams({ "list-type": "2", prefix: "directory/", delimiter: "/" });
    const qs = q.toString();
    const url = `https://${host}${path}?${qs}`;

    // Дата для SigV4
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const MM = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const HH = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    const ss = String(now.getUTCSeconds()).padStart(2, "0");
    const shortDate = `${yyyy}${MM}${dd}`;
    const amzDate = `${shortDate}T${HH}${mm}${ss}Z`;

    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonical = [
      "GET",
      path,
      qs,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      "",
      signedHeaders,
      payloadHash,
    ].join("\n");

    const canonicalHash = await sha256Hex(canonical);
    const scope = `${shortDate}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, canonicalHash].join("\n");

    const kDate = await hmac(enc("AWS4" + R2_SECRET_ACCESS_KEY), shortDate);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, "aws4_request");
    const signature = hex(await hmac(kSigning, stringToSign));

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        "authorization": authorization,
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ links: [], error: txt || r.statusText }), {
        status: 500, headers: { "content-type": "application/json" }
      });
    }

    const xml = await r.text();
    // <Prefix>directory/<slug>/</Prefix>
    const slugs = Array.from(xml.matchAll(/<Prefix>directory\/([^/]+)\/<\/Prefix>/g)).map(m => m[1]);
    const links = slugs.map(s => `/directory/${s}`);

    return new Response(JSON.stringify({ links }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ links: [], error: e?.message || "err" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
}
