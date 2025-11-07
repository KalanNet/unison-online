// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // CF Pages edge

function okJson(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code });
}
function errJson(error: string, code = 401) {
  return NextResponse.json({ error }, { status: code });
}

function normalizeNext(raw?: string) {
  const def = "/secure/editor";
  if (!raw) return def;
  // забороняємо зовнішні URL та протокольні-агностичні
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return def;
  if (raw.startsWith("//")) return def;
  // має бути внутрішній шлях
  if (!raw.startsWith("/")) return def;
  // не пускаємо на домашню і на логін (щоб не було петель)
  if (raw === "/" || raw.startsWith("/login")) return def;
  return raw;
}

export async function POST(req: NextRequest) {
  let user = "", pass = "", next = "/secure/editor";
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as any;
    user = String(body.user ?? "");
    pass = String(body.pass ?? "");
    next = normalizeNext(String(body.next ?? ""));
  } else {
    const fd = await req.formData();
    user = String(fd.get("user") ?? "");
    pass = String(fd.get("pass") ?? "");
    next = normalizeNext(String(fd.get("next") ?? ""));
  }

  const EXPECT_USER = process.env.AUTH_USERNAME || process.env.AUTH_USER || "";
  const EXPECT_PASS = process.env.AUTH_PASSWORD || process.env.AUTH_PASS || "";

  if (!EXPECT_USER || !EXPECT_PASS) {
    return errJson("Auth not configured on server", 500);
  }
  if (user !== EXPECT_USER || pass !== EXPECT_PASS) {
    return errJson("Invalid credentials");
  }

  // Токен
  const token = crypto.randomUUID();

  const res = okJson({ ok: true, next });

  // Кука (узгоджено з білдом: AUTH_COOKIE_NAME=ua_auth)
  const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_auth";
  const TTL_DAYS = Number(process.env.AUTH_COOKIE_TTL_DAYS ?? 7);
  const maxAge = Math.max(1, Math.floor((Number.isFinite(TTL_DAYS) ? TTL_DAYS : 7) * 24 * 60 * 60));

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return res;
}
