// app/api/login/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge"; // CF Pages edge

function okJson(data: unknown) {
  return NextResponse.json(data, { status: 200 });
}
function badJson(error: string, code = 401) {
  return NextResponse.json({ error }, { status: code });
}

export async function POST(req: Request) {
  // Підтримка FormData і JSON
  let user = "", pass = "", next = "/";
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as any;
    user = body.user ?? "";
    pass = body.pass ?? "";
    next = body.next ?? "/";
  } else {
    const fd = await req.formData();
    user = String(fd.get("user") ?? "");
    pass = String(fd.get("pass") ?? "");
    next = String(fd.get("next") ?? "/");
  }

  // Креденшли з Cloudflare Variables/Secrets
  const EXPECT_USER =
    process.env.AUTH_USERNAME || process.env.AUTH_USER || "";
  const EXPECT_PASS =
    process.env.AUTH_PASSWORD || process.env.AUTH_PASS || "";

  if (!EXPECT_USER || !EXPECT_PASS) {
    return badJson("Auth not configured on server", 500);
  }
  if (user !== EXPECT_USER || pass !== EXPECT_PASS) {
    return badJson("Invalid credentials");
  }

  // Генерація простого токена
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const res = okJson({ ok: true, next });

  // Куки (назва + TTL у днях або max-age у секундах)
  const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
  const TTL_DAYS = Number(process.env.AUTH_COOKIE_TTL_DAYS ?? 7);
  const FALLBACK_MAX_AGE = Number(process.env.AUTH_COOKIE_MAX_AGE || 0);
  const MAX_AGE = Number.isFinite(FALLBACK_MAX_AGE) && FALLBACK_MAX_AGE > 0
    ? FALLBACK_MAX_AGE
    : Math.max(1, Math.floor((Number.isFinite(TTL_DAYS) ? TTL_DAYS : 7) * 24 * 60 * 60));

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return res;
}
