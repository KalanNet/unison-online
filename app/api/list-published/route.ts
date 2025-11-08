// app/api/list-published/route.ts
export const runtime = "edge";

type Env = {
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
};

const te = new TextEncoder();
const encU8 = (s: string): Uint8Array => te.encode(s);

function env(): Env {
  const E: any = (typeof process !== "undefined" && (process as any).env) || (globalThis as any);
  return {
    R2_ACCOUNT_ID: E.R2_ACCOUNT_ID,
    R2_BUCKET: E.R2_BUCKET,
    R2_ACCESS_KEY_ID: E.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: E.R2_SECRET_ACCESS_KEY,
  } as Env;
}

// Проста утиліта, щоб мати Uint8Array
const u8 = (src: ArrayBuffer | Uint8Array): Uint8Array =>
  src instanceof Uint8Array ? src : new Uint8Array(src);

// HMAC-SHA256 (WebCrypto, edge). Явно приводимо до BufferSource.
async function hmac(keyData: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    u8(keyData) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, encU8(data) as unknown as BufferSource);
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", encU8(s) as unknown as BufferSource);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

export async function GET() {
  try {
    const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env();
    if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return new Response(JSON.stringify({ links: [], error: "Missing R2 env" }), { status: 500 });
    }

    const service = "s3";
    const region = "auto";
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const path = `/${encodeURIComponent(R2_BUCKET)}`;

    // canonical query (alphabetical)
    const q = new URLSearchParams();
    q.set("delimiter", "/");
    q.set("list-type", "2");
    q.set("prefix", "directory/");
    const qs = q.toString();

    const url = `https://${host}${path}?${qs}`;

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

    const kDate = await hmac(encU8("AWS4" + R2_SECRET_ACCESS_KEY).buffer as ArrayBuffer, shortDate);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, "aws4_request");
    const signature = toHex(await hmac(kSigning, stringToSign));

    const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        authorization: auth,
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ links: [], error: txt || r.statusText }), { status: 500 });
    }

    const xml = await r.text();
    const slugs = Array.from(xml.matchAll(/<Prefix>directory\/([^/]+)\/<\/Prefix>/g)).map(m => m[1]);
    const links = slugs.map(s => `/directory/${s}`);

    return new Response(JSON.stringify({ links }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ links: [], error: e?.message || "err" }), { status: 500 });
  }
}
