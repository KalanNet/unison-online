// app/api/login/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge"; // під CF Pages

function okJson(data: unknown) {
  return NextResponse.json(data, { status: 200 });
}
function badJson(error: string, code = 401) {
  return NextResponse.json({ error }, { status: code });
}

export async function POST(req: Request) {
  // Підтримуємо FormData (з твоєї форми) і JSON (якщо знадобиться з постмана)
  let user = "", pass = "", next = "/";
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    user = body.user ?? "";
    pass = body.pass ?? "";
    next = body.next ?? "/";
  } else {
    const fd = await req.formData();
    user = (fd.get("user") as string) || "";
    pass = (fd.get("pass") as string) || "";
    next = (fd.get("next") as string) || "/";
  }

  // Очікувані креденшли з Variables/Secrets у Cloudflare
  const EXPECT_USER = process.env.AUTH_USER || "";
  const EXPECT_PASS = process.env.AUTH_PASS || "";

  if (!EXPECT_USER || !EXPECT_PASS) {
    return badJson("Auth not configured on server", 500);
  }
  if (user !== EXPECT_USER || pass !== EXPECT_PASS) {
    return badJson("Invalid credentials");
  }

  // Генеруємо простий токен (Edge має crypto)
  const tokenBytes = new Uint8Array(16);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const res = okJson({ ok: true });

  // Назва/налаштування cookie (також можна задати через Variables)
  const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
  const MAX_AGE = Number(process.env.AUTH_COOKIE_MAX_AGE || 60 * 60 * 24 * 7); // 7d

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return res;
}
