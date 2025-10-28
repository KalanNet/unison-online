// app/api/publish/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

// helpers
function ok(data: unknown, code = 200) { return NextResponse.json(data, { status: code }); }
function err(error: string, code = 400) { return NextResponse.json({ error }, { status: code }); }

export async function POST(req: Request) {
  // Перевірка авторизації по cookie
  const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";
  const cookieHeader = req.headers.get("cookie") || "";
  const authed = cookieHeader.split(/;\s*/).some((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!authed) return err("Unauthorized", 401);

  // Приймаємо JSON або FormData
  const ctype = req.headers.get("content-type") || "";
  let pdfUrl = "", title = "", slug = "", description = "";

  if (ctype.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    pdfUrl = body.pdfUrl || "";
    title = body.title || "";
    slug = body.slug || "";
    description = body.description || "";
  } else {
    const fd = await req.formData();
    pdfUrl = String(fd.get("pdfUrl") || "");
    title = String(fd.get("title") || "");
    slug = String(fd.get("slug") || "");
    description = String(fd.get("description") || "");
  }

  if (!pdfUrl) return err("pdfUrl is required", 422);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return err("slug must match ^[a-z0-9-]+$", 422);

  // У цій версії ми нічого не зберігаємо — лише формуємо публічну адресу Viewer
  // (на базі вже доступного pdfUrl). У майбутньому:
  // 1) зберегти source.pdf в R2,
  // 2) зберегти meta.json (title, slug, description),
  // 3) повертати "чистий" URL типу /directory/2025/<slug>.
  const params = new URLSearchParams();
  params.set("file", pdfUrl);
  if (title) params.set("title", title);

  const urlPath = `/viewer?${params.toString()}`;

  // Повертаємо мінімум для редіректа та підтвердження
  return ok({ ok: true, urlPath });
}
