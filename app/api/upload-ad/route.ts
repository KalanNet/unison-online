// app/api/upload-ad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";

/* ---------- R2 (S3) config — як у upload-featured ---------- */
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

/** Дістає перше непорожнє значення з набору можливих ключів (підтримка ads[label], ad_label, тощо) */
function readField(form: FormData, keys: string[]): string | null {
  for (const k of keys) {
    const v = form.get(k);
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length) return t;
    }
  }
  // якщо прийшло як масив: label[] = "..." (беремо перший)
  for (const k of keys.map(k => `${k}[]`)) {
    const v = form.get(k);
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length) return t;
    }
  }
  return null;
}

/** Читає number із набору ключів, підтримує рядок, масив-рядок, кламп 0..4 */
function readSeq(form: FormData, keys: string[], clampMin = 0, clampMax = 4): number | null {
  const raw = readField(form, keys);
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const z = Math.trunc(n);
  return Math.min(clampMax, Math.max(clampMin, z));
}

/** Якщо прийшло JSON-полем (meta / data), підхопимо і звідти */
function readFromJsonBlobs(form: FormData): { label?: string|null; href?: string|null; seq?: number|null } {
  const out: { label?: string|null; href?: string|null; seq?: number|null } = {};
  const candidates = ["json", "meta", "data", "payload", "ad", "ads"];
  for (const k of candidates) {
    const v = form.get(k);
    if (typeof v === "string" && v.trim().startsWith("{")) {
      try {
        const j = JSON.parse(v);
        if (out.label == null && typeof j.label === "string") out.label = j.label.trim() || null;
        if (out.href  == null && typeof j.href  === "string") out.href  = j.href.trim()  || null;
        if (out.seq   == null && (typeof j.seq === "number" || typeof j.seq === "string")) {
          const n = Number(j.seq);
          if (Number.isFinite(n)) out.seq = Math.min(4, Math.max(0, Math.trunc(n)));
        }
      } catch { /* ignore */ }
    }
  }
  return out;
}

/* ---------- POST ---------- */
export async function POST(req: NextRequest) {
  try {
    // Та ж cookie-auth, що й у upload-featured
    const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
    const cookieHeader = req.headers.get("cookie") || "";
    const authed = cookieHeader.split(/;\s*/).some((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!authed) return err("Unauthorized", 401);

    const form = await req.formData();

    // 1) Файл
    const image = (form.get("image") || form.get("file")) as File | null;
    if (!image) return err("Missing image file", 400);
    if (!image.type || !image.type.startsWith("image/")) {
      return err("Only image/* allowed", 415);
    }

    // 2) Slug (обов'язково)
    const slug =
      readField(form, ["slug", "directory", "dir", "ads[slug]", "ad_slug"]) ||
      null;
    if (!slug) return err("Missing slug", 422);

    // 3) Метадані оголошення з КІЛЬКОХ можливих імен полів
    //    (щоб працювало незалежно від того, як названі інпути на формі)
    let label =
      readField(form, ["label", "name", "title", "ad_label", "ads[label]", "adsLabel", "ads_label"]) ||
      null;

    let href  =
      readField(form, ["href", "url", "link", "ad_href", "ads[href]", "adsUrl", "ads_link"]) ||
      null;

    let seq   =
      readSeq(form, ["seq", "order", "index", "position", "ad_seq", "ads[seq]"], 0, 4);

    // 3a) Якщо прилетіло JSON-полем — дозаповнимо звідти (не перетираючи вже знайдені)
    const jsonMeta = readFromJsonBlobs(form);
    if (label == null && jsonMeta.label != null) label = jsonMeta.label;
    if (href  == null && jsonMeta.href  != null) href  = jsonMeta.href;
    if (seq   == null && jsonMeta.seq   != null) seq   = jsonMeta.seq;

    // 4) Шлях у R2: directory/<slug>/ads/<ім'я>
    const dir = `directory/${encodeURIComponent(slug)}/ads`;
    const key = joinKey(dir, safeName("ad", image.name || image.type));

    // 5) Запис у R2
    const arr = await image.arrayBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: new Uint8Array(arr), // Edge-safe
      ContentType: image.type || "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));

    const url = `${R2_PUBLIC_URL}/${key}`;

    // 6) Повертаємо ВСЕ, що треба, без null-втрат:
    return ok({
      url,
      key,
      label: label ?? null,
      href : href  ?? null,
      seq  : typeof seq === "number" ? seq : null,
    });
  } catch (e: any) {
    return err(String(e?.message || e), 500);
  }
}
