// middleware.ts (в корені)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ua_sid";

export const config = {
  // Які маршрути захищати (можеш змінити на потрібні)
  matcher: ["/secure/:path*"],
};

export function middleware(req: NextRequest) {
  const isAuthed = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  if (!isAuthed) {
    const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
  }

  return NextResponse.next();
}
