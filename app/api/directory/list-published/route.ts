// app/api/directory/list-published/route.ts
import { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Проксі на канонічний /api/list-published */
const target = (req: NextRequest) => new URL("/api/list-published", req.url).toString();

export async function GET(req: NextRequest) {
  return fetch(target(req), { method: "GET", headers: req.headers, cache: "no-store" });
}

export async function POST(req: NextRequest) {
  return fetch(target(req), { method: "POST", headers: req.headers, body: req.body });
}

// (не обов’язково, але іноді корисно для preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
