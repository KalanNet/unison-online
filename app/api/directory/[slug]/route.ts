// app/api/directory/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> } // ← Next 16: params — Promise
) {
  const { slug } = await ctx.params; // ← обов'язково await
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const url = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;

  const r = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
  if (!r.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await r.json();
  return NextResponse.json(json, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
